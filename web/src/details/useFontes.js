// Fontes (embeds) e qual esta' aberta.
//
// O `playerIndex` tem de andar junto do `active`: e' o indice por onde o
// `Player` arranca. Quando so' o `active` mudava, a fonte escolhida ficava
// marcada no seletor mas o video comecava noutra.
//
// A fonte escolhida a mao trava o auto-fallback: sem isso, clicavas no VidLove
// e 15 s depois aparecia o VidLink sem teres pedido nada. So o auto-fallback
// inicial (sem escolha) e' que salta de fonte sozinho.
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api/client.js";
import useProviderHealth from "../components/useProviderHealth.js";

// A ultima fonte escolhida, POR TIPO (filme / serie / anime), das Definicoes.
//
// **Antes vivia numa chave que tinha o episodio dentro**
// (`...:${season}:${episode}`), o que anulava a ideia: a escolha de um episodio
// nunca aparecia no seguinte, que e' exactamente o que se queria evitar. Quem
// escolheu o MegaPlay porque e' o unico com legendas tinha de o escolher em
// cada episodio.
//
// So' vale se o provider ainda existir nesta lista de fontes; se foi removido
// ou mudou de id, cai na primeira viva como antes.
//
// E' uma funcao, e nao um valor calculado no render. Era um valor, e isso era o
// segundo bug: quando as fontes chegam (dentro do `.then`) o `embeds` do estado
// ainda era o antigo - vazio - logo a fonte guardada dava `null` e o player
// arrancava na primeira. O botao do seletor aparecia certo, porque esse e'
// desenhado num render seguinte, com a lista ja cheia. Da' a situacao mais
// enganadora que ha: "a fonte esta' marcada mas o video e' outro".
export function fonteGuardada(porTipo, tipo, lista) {
  if (!tipo || !porTipo || typeof porTipo !== "object") return null;
  const v = porTipo[tipo];
  if (typeof v !== "string" || !v) return null;
  return (lista || []).some((e) => e.provider === v) ? v : null;
}

export function useFontes({ details, season, episode, animeAudio, settings, update, onError }) {
  const [embeds, setEmbeds] = useState([]);
  const [active, setActive] = useState(null);
  // Indice activo do player (para o Player fazer fallback/timeout a partir dele).
  const [playerIndex, setPlayerIndex] = useState(0);
  // A pessoa escolheu a fonte a mao?
  const [fonteManual, setFonteManual] = useState(false);
  // Watch Party: fonte (provider) que o host escolheu, para os convidados verem
  // a mesma — senao cada um fica no 1o provider, que pode estar partido.
  const wantedSourceRef = useRef(null);
  // Ultimo provider escolhido (ref, para nao reiniciar os timers de presenca).
  const activeProviderRef = useRef(null);
  // Health-check dos providers (ids mortos; null = ainda desconhecido).
  const deadProviders = useProviderHealth();

  // A mesma coisa, mas ja' com a lista do estado - e' o que o `SourceSelector`
  // recebe para pintar o botao certo.
  const fonteSalva = fonteGuardada(settings.lastSource, details?.type, embeds);

  // Titulo novo: solta-se a TRANCA do auto-fallback, mas nao a escolha. A fonte
  // continua guardada nas Definicoes e e' por onde o player arranca (ver
  // `abrirEscolhendo`) — o que muda e' que a partir de agora, se essa fonte nao
  // responder, o player salta para a seguinte em vez de ficar preso nela.
  useEffect(() => {
    setActive(null);
    setFonteManual(false);
  }, [details]);

  // Mantem o ref do ultimo provider escolhido a par do estado ativo (e' o que
  // o progresso manda ao servidor: "em que fonte e' que estavas").
  useEffect(() => {
    activeProviderRef.current = active?.provider ?? null;
  }, [active]);

  // Fonte inicial: a escolhida pelo host da watch party, ou a primeira viva
  // (salta os que o health-check marcou como mortos).
  const pickDefault = useCallback(
    (embedsList, saved) => {
      const want = wantedSourceRef.current;
      // Se ha uma fonte salva e nao esta morta pelo health-check, usa-a como
      // ponto de partida. Se nao existe ja (o provider foi removido ou mudou o
      // id), cai no primeiro vivo como antes.
      const alive = embedsList.filter((e) => !deadProviders?.has(e.provider));
      const aliveSaved = saved ? alive.find((e) => e.provider === saved) : null;
      return (
        (want &&
          (alive.find((e) => e.provider === want) || embedsList.find((e) => e.provider === want))) ||
        aliveSaved ||
        alive[0] ||
        embedsList[0] ||
        null
      );
    },
    [deadProviders]
  );

  // Escolhe a fonte inicial E posiciona o player nela.
  const abrirEscolhendo = useCallback(
    (embedsList) => {
      const escolhido = pickDefault(embedsList, fonteGuardada(settings.lastSource, details?.type, embedsList));
      setActive(escolhido);
      const idx = embedsList.findIndex((e) => e.provider === escolhido?.provider);
      setPlayerIndex(idx >= 0 ? idx : 0);
      return escolhido;
    },
    [pickDefault, settings.lastSource, details?.type]
  );

  // Escolher a fonte a mao. **Uma so funcao para os dois `SourceSelector`** (o de
  // cima e' o de sempre, o de baixo o do separador p2p/torrents) — estavam
  // duplicados e qualquer correccao a um tinha de ser feita duas vezes, que e'
  // como nasce um "aqui funciona, ali nao".
  //
  // Os tres passos, e o terceiro e' o que faltava:
  //   1. abre nesta fonte e posiciona o player nela;
  //   2. trava o auto-fallback (a escolha e' da pessoa);
  //   3. guarda nas Definicoes, POR TIPO, para o proximo episodio ja abrir nela.
  function escolherFonte(e) {
    setActive(e);
    const idx = embeds.findIndex((x) => x.provider === e?.provider);
    setPlayerIndex(idx >= 0 ? idx : 0);
    setFonteManual(true);
    const tipo = details?.type;
    if (!e?.provider || !tipo) return;
    update({
      lastSource: {
        movie: "",
        tv: "",
        anime: "",
        // O que ja estava gravado, para nao perder a escolha de outro tipo. E os
        // tres chaves acima, para o objecto ter a forma certa mesmo que as
        // Definicoes venham de uma versao antiga sem `lastSource`.
        ...(settings.lastSource || {}),
        [tipo]: e.provider,
      },
    });
  }

  // Carregar fontes quando temos contexto suficiente.
  useEffect(() => {
    if (!details) return;
    setActive(null);
    // Anime: fontes por id do MyAnimeList (MegaPlay/VidLink/VidSrc.cc), sem TMDB.
    if (details.isAnime) {
      api
        .sources({
          // **`type` tem de vir.** O servidor usa-o para saber que e' um anime:
          // sem `type`, um anime que nao tem fontes caia na mensagem de filme
          // ("falta o parametro tmdb"), que manda quem investiga para o lado
          // errado — o problema e' a AniList, nao o TMDB. Ate' 2026-10-20 este
          // `type` faltava e a mensagem de anime nunca era mostrada.
          type: "anime",
          mal: details.malId,
          anilist: details.anilistId,
          episode: details.isMovie ? 1 : episode,
          audio: animeAudio,
        })
        .then((d) => {
          setEmbeds(d.embeds);
          abrirEscolhendo(d.embeds);
        })
        .catch((e) => onError(e.message));
      return;
    }

    const opts = { type: details.type, tmdb: details.id, imdb: details.imdbId };
    if (details.type === "tv") {
      opts.season = season;
      opts.episode = episode;
    }
    api
      .sources(opts)
      .then((d) => {
        setEmbeds(d.embeds);
        abrirEscolhendo(d.embeds);
      })
      .catch((e) => onError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [details, season, episode, animeAudio]);

  return {
    embeds,
    active,
    setActive,
    playerIndex,
    setPlayerIndex,
    fonteManual,
    fonteSalva,
    escolherFonte,
    abrirEscolhendo,
    wantedSourceRef,
    activeProviderRef,
    deadProviders,
  };
}