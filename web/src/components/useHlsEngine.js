import { useCallback, useEffect, useRef, useState } from "react";
import Hls from "hls.js";

// Engine hls.js com recuperacao de erros.
//
// Responsabilidade unica: criar a instancia hls.js, carregar a fonte, expor
// os niveis de qualidade e tentar recuperar de erros fatais (rede/media) antes
// de desistir e chamar onErro.
//
// Devolve: { hls, niveis, nivelAuto, ativo, mudarQualidade, setNiveis }
export function useHlsEngine({ src, videoRef, onErro }) {
  const hlsRef = useRef(null);
  const errosRef = useRef({ network: 0, media: 0 });
  const onErroRef = useRef(onErro);
  onErroRef.current = onErro;

  const [niveis, setNiveis] = useState([]); // rotulos, ou [] quando nao ha o que escolher
  const [nivelAuto, setNivelAuto] = useState(true);
  const [ativo, setAtivo] = useState(0);

  // Escolha de qualidade do utilizador (null = auto, numero = nivel fixo).
  // Persiste entre episodios (localStorage) para nao perder a fixacao.
  const nivelEscolhidoRef = useRef(null);

  // Qualidade escolhida pelo utilizador, guardada em localStorage.
  const QUALIDADE_KEY = "meida:qualidade";

  // Ler a escolha guardada no arranque do hook.
  useEffect(() => {
    try {
      const v = localStorage.getItem(QUALIDADE_KEY);
      if (v != null) {
        const n = Number(v);
        if (Number.isFinite(n)) nivelEscolhidoRef.current = n;
      }
    } catch (e) {
      // localStorage indisponível (modo privado, etc.): ignora.
    }
  }, []);

  const mudarQualidade = useCallback((valor) => {
    const hls = hlsRef.current;
    if (!hls) return;
    const auto = valor === "auto";
    const n = auto ? null : Number(valor);
    nivelEscolhidoRef.current = n;
    setNivelAuto(auto);
    hls.currentLevel = auto ? -1 : n;
    // Lembrar a escolha para episodios seguintes.
    try {
      if (n == null) localStorage.removeItem(QUALIDADE_KEY);
      else localStorage.setItem(QUALIDADE_KEY, String(n));
    } catch (e) {}
  }, []);

  useEffect(() => {
    const video = videoRef.current;

    if (!src || !(Hls.isSupported() && src.isM3U8 !== false)) {
      // Safari (HLS nativo) ou ficheiro progressivo.
      if (video) video.src = src;
      hlsRef.current = null;
      setNiveis([]);
      setNivelAuto(true);
      setAtivo(0);
      return;
    }

    // Novo episodio: o hls.js arranca sempre em Auto, por isso resetamos o
    // estado do React para nao ficar dessincronizado. A escolha do utilizador
    // e' reaplicada abaixo em MANIFEST_PARSED.
    errosRef.current = { network: 0, media: 0 };
    setNivelAuto(true);
    setAtivo(0);

    const hls = new Hls({ enableWorker: true });
    hls.loadSource(src);
    hlsRef.current = hls;

    hls.on(Hls.Events.MANIFEST_PARSED, (_e, dados) => {
      const nivel = dados?.levels?.length || 0;
      setNiveis(nivel > 1 ? dados.levels.map((l, i) => rotuloNivel(l, i)) : []);
      // Reaplicar a escolha guardada do utilizador, se o nivel existir aqui.
      // Se o nivel exato nao existir (outro episodio com menos variantes),
      // escolhe o mais proximo abaixo para nao sobrecarregar a ligacao.
      const guardado = nivelEscolhidoRef.current;
      if (guardado != null && nivel > 0) {
        let alvo = guardado;
        if (alvo >= nivel) alvo = nivel - 1;
        hls.currentLevel = alvo;
        setNivelAuto(false);
        setAtivo(alvo);
      }
    });

    hls.on(Hls.Events.LEVEL_SWITCHED, (_e, dados) => setAtivo(dados?.level ?? 0));

    // Repõe o contador de erros de rede quando um segmento carrega com sucesso.
    // Uma rede instável pode gerar erros esporádicos ao longo de um filme longo;
    // sem esta reposição, três erros ao longo de todo o vídeo bastam para
    // trocar de fonte. Assim, apenas erros consecutivos contam para o limite.
    hls.on(Hls.Events.FRAG_LOADED, () => {
      errosRef.current.network = 0;
    });

    // Erro fatal: tenta recuperar conforme o tipo. Se esgotar as tentativas,
    // destroi o hls e avisa o chamador para passar à fonte seguinte.
    hls.on(Hls.Events.ERROR, (_event, dados) => {
      if (!dados || !dados.fatal) return;
      const hlsInst = hlsRef.current;
      if (!hlsInst) return;
      if (dados.type === Hls.ErrorTypes.NETWORK_ERROR) {
        if (errosRef.current.network < 3) {
          errosRef.current.network += 1;
          hlsInst.startLoad();
          return;
        }
      } else if (dados.type === Hls.ErrorTypes.MEDIA_ERROR) {
        if (errosRef.current.media < 1) {
          errosRef.current.media += 1;
          hlsInst.recoverMediaError();
          return;
        }
      }
      hlsInst.destroy();
      hlsRef.current = null;
      onErroRef.current?.();
    });

    return () => {
      hls?.destroy();
      hlsRef.current = null;
    };
  }, [src, onErro]);

  return { hls: hlsRef.current, niveis, nivelAuto, ativo, mudarQualidade, setNiveis };
}

// Rotulo de um nivel de qualidade para o menu.
function rotuloNivel(level, index) {
  const h = level.height ?? index;
  return h ? `${h}p` : `Qualidade ${index + 1}`;
}
