// O onboarding: uma folha que aparece a quem cria a conta e ainda nao tem nada.
//
// Aparece **fora do ErrorBoundary** e fora do `<main>`, porque tem de aparecer
// MESMO quando uma pagina rebenta — e esse e' o caso mais provavel: quem acabou
// de criar a conta pode estar a ver um erro de rede, e um wizard que depende
// dessa pagina para aparecer e' um wizard que nunca aparece.
//
// Nao e' um modal com fundo escuro: e' uma **folha de lado**, porque em
// `/library` e' a biblioteca que esta a ser escrita e o contexto importa. E a
// barra de baixo do telefone tem de ficar acessivel — a pessoa pode estar a ler
// isto a meio de um video.
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useT } from "../i18n/I18nContext.jsx";
import { useSettings } from "../settings/SettingsContext.jsx";
import { useLibrary } from "../library/LibraryContext.jsx";
import { api } from "../api/client.js";
import {
  PASSOS,
  ULTIMO,
  MAX_GENEROS,
  primeiroPasso,
  passoSeguinte,
  deveMostrar,
  opcoesDe,
  alternaGenero,
  generosParaOferecer,
  generosParaDiscover,
  fechoDe,
} from "./onboarding.js";

// Os mesmos presets que as Definicoes. **Nao estao em `onboarding.js`** porque
// aquele ficheiro e' puro e nao pode importar nada: um preset que aparecesse
// aqui e nao la, ou o contrario, e' a diferenca entre escolher uma cor que existe
// e escolher uma cor que o browser corrige para preto.
export const CORES = [
  "#c90303",
  "#e50914",
  "#1db954",
  "#2563eb",
  "#8b5cf6",
  "#ec4899",
  "#f59e0b",
  "#06b6d4",
];

const CHAVE = "meida_onboarding_v1";

/** Ja se fez, ou ja se dispensou? Ficou neste PC, nao no servidor. */
function lerEstado() {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE) || "null");
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}
function guardarEstado(v) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(v));
  } catch {
    /* sem espaco: o onboarding volta a aparecer, que e' melhor do que travar */
  }
}

/**
 * @param {object} e
 * @param {boolean} [e.forcar]     a pessoa pediu explicitamente (Definicões):
 *   mostra mesmo com titulos. E' a unica forma de o wizard aparecer a quem ja
 *   tem biblioteca, e sem ela nao ha caminho para o wizard depois do primeiro dia.
 * @param {() => void} e.onFechar
 */
export default function Onboarding({ forcar = false, onFechar }) {
  const t = useT();
  const navigate = useNavigate();
  const { settings, update } = useSettings();
  const { count, refresh } = useLibrary();

  const [passo, setPasso] = useState(primeiroPasso);
  const [generos, setGeneros] = useState([]);
  const [oferta, setOferta] = useState([]);
  const [cor, setCor] = useState(settings.accent || CORES[0]);
  const [fontes, setFontes] = useState([]);
  const [importados, setImportados] = useState(0);
  const [ocupado, setOcupado] = useState(null); // id da porta a trabalhar
  const [erro, setErro] = useState(null);
  const [msg, setMsg] = useState(null);
  const [usernameLB, setUsernameLB] = useState("");
  const [ficheiro, setFicheiro] = useState(null);

  // O estado guardado (jaDispensado, generos, ligacoes). **Tem de ser declarado
  // ANTES de `deveMostrar`, que e' chamado durante o desenho e o le** — a
  // primeira versao tinha-o 60 linhas abaixo e a app nao arrancava.
  const [estado, setEstado] = useState({ ligacoes: {} });
  const caixa = useRef(null);

  // ---- A DECISAO: este wizard mostra-se? -------------------------------
  //
  // E' aqui, e nao no `App.jsx`, porque **quem decide precisa de estar montado
  // para decidir**. A primeira versao gateava a montagem em `ob &&` no `App`, e
  // o unico jeito de `ob` ser `true` era alguem o ligar: como nao havia quem o
  // ligasse, o wizard nunca aparecia a ninguem — e nenhuma verificacao o
  // apanhava, porque o `deveMostrar` estava la dentro, fora do alcance.
  //
  // `count === null` e' a biblioteca **ainda a carregar**, e devolve `false`:
  // mostrar o wizard a quem tem 300 titulos porque o pedido ainda nao voltou e'
  // o erro mais caro desta funcionalidade, porque importa por cima do que a
  // pessoa ja tinha.
  const mostrar = deveMostrar({
    forcar,
    bibliotecaVazia: count === 0,
    jaDispensado: estado.jaDispensado,
  });
  const visivel = mostrar && (count !== null || forcar);

  // ---- Os generos e as ligacoes: so se pergunta quando HA WIZARD --------
  //
  // **Enquanto nao vierem, nao se avanca.** E' a diferenca entre "estou a carregar"
// e "nao ha nada para escolher": com a resposta em branco, a pessoa carrega duas
// vezes e conclui que a app nao responde.
  useEffect(() => {
    if (!visivel) return;
    let vivo = true;
    Promise.all([
      api.genres("movie").catch(() => ({ genres: [] })),
      api.malStatus().catch(() => ({ linked: false })),
      api.malEnabled().catch(() => ({ enabled: false })),
      api.anilistStatus().catch(() => ({ linked: false })),
      api.anilistEnabled().catch(() => ({ enabled: false })),
      // **O `catch` de cada um tem de devolver a MESMA forma que a resposta de
      // sucesso.** Um `catch` que devolvesse um objeto vazio deixaria o campo a
      // `undefined`, e `undefined` e' falsy — resultado certo por acidente, e uma
      // falha de rede nao se distingue de "nao esta ligado". Por isso cada um
      // repete o formato.
      api.letterboxdStatus().catch(() => ({ username: null })),
    ]).then(([g, mal, malOn, al, alOn, lb]) => {
      if (!vivo) return;
      setOferta(generosParaOferecer(g.genres));
      setEstado((v) => ({
        ...v,
        ligacoes: {
          mal: !!(mal && mal.linked) && !!(malOn && malOn.enabled),
          anilist: !!(al && al.linked) && !!(alOn && alOn.enabled),
          /**
           * **O Letterboxd nao tem `linked` — tem `username`.**
           * `/api/letterboxd/status` responde `{ username: ... }` (o mesmo que o
           * `LetterboxdSection` das Definicoes le), e a primeira versao deste
           * codigo perguntava pelo campo de ObviouslyWrong — que nao existe em lado nenhum
           * lado nenhum: dava `undefined` e a porta do Letterboxd **nunca
           * aparecia**. Nao deu erro nenhum — a opcao era so silenciosamente
           * ausente. Foi o teste de ponta a ponta que apanhou, a ver a resposta
           * real da rota.
           *
           * (O nome do campo errado nao esta' escrito aqui de proposito: a
           * verificacao proibe a expressao em TODO o ficheiro, comentario
           * incluido, e da primeira vez o comentario da regra era o que a
           * acusava.)
           */
          letterboxd: !!(lb && lb.username),
        },
      }));
    });
    return () => {
      vivo = false;
    };
  }, [visivel]);

  // O estado guardado so e' lido **quando se abre**, para nao contar como
  // "dispensado" um onboarding que nunca chegou a aparecer.
  useEffect(() => {
    if (!visivel) return;
    const guardado = lerEstado();
    setEstado((v) => ({ ...v, ...guardado, ligacoes: { ...(v.ligacoes || {}), ...(guardado.ligacoes || {}) } }));
  }, [visivel]);

  // ---- Porta: importar ---------------------------------------------------
  const fechar = useCallback(() => {
    guardarEstado({ ...estado, jaDispensado: true });
    onFechar();
  }, [estado, onFechar]);

  const avancar = useCallback(() => {
    const proximo = passoSeguinte(passo, { temGeneros: oferta.length > 0, temCores: CORES.length > 0 });
    if (proximo === null) {
      // A cor ja foi guardada ao carregar nela. Aqui so fica o que ainda nao
      // estava guardado: os generos e a marca de "ja fez".
      guardarEstado({ ...estado, jaDispensado: true, generos });
      onFechar();
      return;
    }
    setPasso(proximo);
  }, [passo, oferta.length, generos, estado, onFechar]);

  const registarFonte = useCallback((id, n) => {
    setFontes((v) => (v.includes(id) ? v : [...v, id]));
    if (Number(n) > 0) setImportados((v) => v + Number(n));
  }, []);

  const importarLetterboxd = async () => {
    const nome = usernameLB.trim();
    if (!nome) return;
    setOcupado("letterboxd");
    setErro(null);
    try {
      await api.letterboxdLink(nome);
      const d = await api.letterboxdImport("all");
      registarFonte("letterboxd", (d.imported || 0) + (d.watchlist || 0));
      await refresh();
      setMsg(t("Importados {n} títulos do Letterboxd.", { n: (d.imported || 0) + (d.watchlist || 0) }));
      setEstado((v) => ({ ...v, ligacoes: { ...v.ligacoes, letterboxd: true } }));
    } catch (e) {
      setErro(e.message || t("Não foi possível importar do Letterboxd."));
    } finally {
      setOcupado(null);
    }
  };

  const importarFicheiro = async () => {
    if (!ficheiro) return;
    setOcupado("ficheiro");
    setErro(null);
    try {
      const texto = await ficheiro.text();
      const ehCsv = ficheiro.name.toLowerCase().endsWith(".csv") || texto.includes("# biblioteca");
      const d = await api.importData(ehCsv ? { format: "csv", text: texto } : texto);
      const n = (d.imported && d.imported.library) || 0;
      registarFonte("ficheiro", n);
      await refresh();
      setMsg(t("Importados {n} títulos do ficheiro.", { n }));
    } catch (e) {
      setErro(e.message || t("Não foi possível importar o ficheiro."));
    } finally {
      setOcupado(null);
    }
  };

  const importar = async (id) => {
    if (id === "letterboxd") return importarLetterboxd();
    if (id === "ficheiro") return importarFicheiro();
    setOcupado(id);
    setErro(null);
    try {
      const d = id === "mal" ? await api.malImport() : await api.anilistImport();
      const n = d.imported || 0;
      registarFonte(id, n);
      await refresh();
      setMsg(t("Importados {n} títulos.", { n }));
    } catch (e) {
      setErro(e.message || t("Não foi possível importar."));
    } finally {
      setOcupado(null);
    }
  };

  // ---- Desenho -----------------------------------------------------------

  const ligacoes = estado.ligacoes || {};
  if (!visivel) return null;

  const passoImportar = () => {
    const opcoes = opcoesDe({ ...ligacoes });
    return (
      <div className="ob-painel">
        <p className="ob-texto">
          {t("Traz os teus títulos de outra app, ou começa do zero — podes fazer isto mais tarde nas Definições.")}
        </p>
        {!opcoes.some((o) => o.id !== "ficheiro") && (
          <p className="ob-nota">
            {t("Nenhuma conta está ligada. A escrever o teu username do Letterboxd é o caminho mais rápido; nas Definições podes ligar o MyAnimeList e o AniList.")}
          </p>
        )}
        <div className="ob-portas">
          {opcoes.map((o) => {
            const ocupadoAqui = ocupado === o.id;
            if (o.id === "letterboxd") {
              return (
                <div key={o.id} className="ob-porta">
                  <label>
                    {t("Letterboxd")}
                    <input
                      value={usernameLB}
                      onChange={(e) => setUsernameLB(e.target.value)}
                      placeholder={t("o teu username")}
                      disabled={ocupado !== null}
                    />
                  </label>
                  <button type="button" className="set-choice active" disabled={!usernameLB.trim() || ocupado !== null} onClick={importar}>
                    {ocupadoAqui ? t("A importar...") : t("Importar")}
                  </button>
                </div>
              );
            }
            if (o.id === "ficheiro") {
              return (
                <div key={o.id} className="ob-porta">
                  <label>
                    {t("Ficheiro (JSON ou CSV exportado da MEIDA)")}
                    <input type="file" accept=".json,.csv,text/csv,text/anytext" onChange={(e) => setFicheiro(e.target.files?.[0] || null)} disabled={ocupado !== null} />
                  </label>
                  <button type="button" className="set-choice active" disabled={!ficheiro || ocupado !== null} onClick={importar}>
                    {ocupadoAqui ? t("A importar...") : t("Importar")}
                  </button>
                </div>
              );
            }
            return (
              <div key={o.id} className="ob-porta">
                <button type="button" className="set-choice active" disabled={ocupado !== null} onClick={() => importar(o.id)}>
                  {ocupadoAqui ? t("A importar...") : t("Importar de {fonte}", { fonte: o.id === "mal" ? "MyAnimeList" : "AniList" })}
                </button>
              </div>
            );
          })}
        </div>
        <p className="ob-nota">
          {t("Só entram ficheiros exportados da MEIDA — o formato do Letterboxd tem de ser ligado pelo username, acima.")}
        </p>
      </div>
    );
  };

  const passoGeneros = () => (
    <div className="ob-painel">
      <p className="ob-texto">
        {t("Escolhe até {n} gêneros. Vamos pôr títulos desse género em primeiro lugar na tua página inicial.", { n: MAX_GENEROS })}
      </p>
      <div className="ob-generos">
        {oferta.map((g) => {
          // O genero esta escolhido se **o nome** estiver na lista: o que se guarda e'
          // `{ id, name }` (o discover precisa do id), e comparar com `includes`
          // sobre o objeto dava sempre falso — o botao nunca ficava marcado.
          const escolhido = generos.some((x) => (typeof x === "object" ? x.name : x) === g.name);
          return (
            <button
              key={g.id}
              type="button"
              // i18n: `className` e' codigo, nao texto de interface
              className={"ob-genero" + (escolhido ? " on" : "")}
              aria-pressed={escolhido}
              onClick={() => setGeneros((v) => alternaGenero(v, g))}
            >
              {g.name}
            </button>
          );
        })}
      </div>
      <p className="ob-nota">
        {t("Podes mudar isto depois nas Definições.")}
      </p>
    </div>
  );

  const passoCor = () => (
    <div className="ob-painel">
      <p className="ob-texto">{t("Escolhe a cor da app. Podes mudá-la quando quiseres.")}</p>
      <div className="ob-cores">
        {CORES.map((c) => (
          <button
            key={c}
            type="button"
            className={"ob-cor" + (cor === c ? " on" : "")}
            style={{ background: c }}
            aria-label={c}
            aria-pressed={cor === c}
            onClick={() => {
                /*
                 * **A cor aplica-se logo, e nao no fim.** Duas razoes, e a segunda
                 * e' a que custa: no fim, fechar pelo X ou pelo link "Definicoes"
                 * perdia a escolha — a pessoa tinha mudado a cor, via o botao
                 * escolhido, e a app voltava a vermelho sem dizer nada.
                 *
                 * E aplica-se ao vivo porque **e' a unica forma de saber se a cor
                 * escolhida se le no fundo da app**; um botao "continuar" com a
                 * cor errada e' so' visivel depois de carregar nele.
                 */
                setCor(c);
                // **`update`, nao `setSetting`.** O `SettingsContext` expoe
                // `update(patch)`; eu escrevi `setSetting("accent", c)`, que dava
                // `undefined is not a function` dentro do `onClick` — a cor
                // mudava **nem no ecra**, muito menos no guardado. Nem o lint
                // viu: `setSetting` vinha da destructuracao, que o lint conta
                // como usada. Apanhado a usar a folha no browser.
                update({ accent: c });
              }}
          />
        ))}
      </div>
    </div>
  );

  const fecho = fechoDe({ total: count, importados, fontes });
  const passoPronto = () => (
    <div className="ob-painel">
      {fecho.mostrarNumeros ? (
        <p className="ob-texto">{t("A tua biblioteca tem {n} títulos.", { n: fecho.n })}</p>
      ) : (
        <p className="ob-texto">{t("Pronto! A tua biblioteca está vazia — começa por guardar alguma coisa, ou procura no catálogo.")}</p>
      )}
      {generosParaDiscover(generos) ? (
        <p className="ob-nota">{t("Vais ver {g} em primeiro na página inicial.", {
          // Os **nomes**, para a pessoa reconhecer o que escolheu. O id vai
          // para o pedido, nunca para o texto.
          g: generos.map((x) => (typeof x === "object" ? x.name : x)).join(", "),
        })}</p>
      ) : null}
      <p className="ob-nota">
        {t("Mais tarde podes importar, ligar contas e mudar tudo isto nas Definições.")}
      </p>
    </div>
  );

  const paineis = { importar: passoImportar, generos: passoGeneros, cor: passoCor, pronto: passoPronto };
  const iPasso = PASSOS.indexOf(passo);

  return (
    <aside className="ob-folha" role="dialog" aria-modal="false" aria-label={t("Primeiros passos")} ref={caixa}>
      <div className="ob-cabeca">
        <strong>{t("Primeiros passos")}</strong>
        <button type="button" className="icon-btn" aria-label={t("Fechar")} onClick={fechar}>
          ✕
        </button>
      </div>

      <ol className="ob-passos" aria-label={t("Passos")}>
        {PASSOS.map((p, i) => (
          <li key={p} className={"ob-passo" + (i <= iPasso ? " on" : "")} aria-current={i === iPasso ? "step" : undefined}>
            {t(p === "importar" ? "Importar" : p === "generos" ? "Géneros" : p === "cor" ? "Cor" : "Pronto")}
          </li>
        ))}
      </ol>

      {msg ? <p className="ob-msg">{msg}</p> : null}
      {erro ? <p className="ob-erro">{erro}</p> : null}

      <div className="ob-corpo">{paineis[passo] ? paineis[passo]() : null}</div>

      <div className="ob-acoes">
        {passo !== ULTIMO ? (
          <>
            <button type="button" className="btn ghost" onClick={avancar}>{t("Continuar")}</button>
            {passo === "importar" ? <button type="button" className="btn ghost" onClick={avancar}>{t("Agora não")}</button> : null}
          </>
        ) : (
          <>
            <button type="button" className="btn" onClick={() => { avancar(); navigate("/"); }}>{t("Ver a minha biblioteca")}</button>
            <Link className="btn ghost" to="/settings" onClick={fechar}>{t("Definições")}</Link>
          </>
        )}
      </div>
    </aside>
  );
}