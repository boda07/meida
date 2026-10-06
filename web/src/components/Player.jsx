import { useEffect, useMemo, useRef, useState } from "react";
import FullscreenButton from "./FullscreenButton.jsx";
import { useSettings } from "../settings/SettingsContext.jsx";

// Um provider pode devolver um `data:` URL (vi um a servir
// `data:application/pdf;base64,...` — um PDF disfarçado de página). Não é um
// player: o Chromium aborta o carregamento, o iframe nunca dispara `load`, e o
// auto-fallback acabava a trocar de fonte sozinho. Also não dá para acrescentar
// `?autoplay=` a um data: URL (vira lixo). Recusamos à partida.
function ePlayerValido(url) {
  return /^https?:\/\//i.test(String(url || ""));
}

function applyPlaybackPrefs(src, { autoplay, autoskip }) {
  let url = src;
  const val = autoplay ? "true" : "false";
  if (/autoplay=/i.test(url)) {
    url = url.replace(/(autoplay|autoPlay)=(true|false)/gi, `$1=${val}`);
  } else {
    url += (url.includes("?") ? "&" : "?") + `autoplay=${val}&autoPlay=${val}`;
  }
  if (autoskip && !/autoSkipIntro=/i.test(url)) {
    url += (url.includes("?") ? "&" : "?") + "autoSkipIntro=true&autoSkip=true";
  }
  return url;
}

// Player por iframe (providers externos). Auto-fallback: se uma fonte demorar
// demais (>TIMEOUT ms) ou falhar, passa automaticamente para a proxima da lista,
// saltando os providers marcados como mortos (deadIds). Evita o "loading" infinito
// quando o provider activo esta down (ex.: IPs de datacenter, bot detection).
const TIMEOUT_MS = 15000;
export default function Player({ embeds, deadIds, title, startIndex = 0 }) {
  const iframeRef = useRef(null);
  const { settings } = useSettings();
  const [reloadKey, setReloadKey] = useState(0);
  // Só entram fontes com URL http(s) — um `data:` URL não é um player (ver
  // ePlayerValido). Filtrar aqui evita que o auto-fallback fique a rodar sobre
  // uma fonte que nunca pode carregar.
  const lista = useMemo(
    () => (embeds || []).filter((e) => ePlayerValido(e.embedUrl)),
    [embeds]
  );
  // Indice da fonte activa dentro da lista `lista` (nao o providerId).
  const [index, setIndex] = useState(() => firstAlive(lista, deadIds, startIndex));
  const [loaded, setLoaded] = useState(false);
  // Fonte que foi trocada sozinha (para o utilizador saber o que aconteceu em
  // vez de o player mudar de marca sem explicação).
  const [trocada, setTrocada] = useState(null);

  // Com o autoplay DESLIGADO, o iframe so nasce depois de um clique.
  //
  // Porque nao basta a `Permissions-Policy: autoplay=()` (electron/autoplay.cjs):
  // o cabecalho e' injetado e o log confirma que sai, mas o MegaPlay arrancou na
  // mesma. O que ele pune no HTML e' `autoPlay: "1"` fixo, sem um unico parametro
  // de autoplay na query string, e o Chromium deixa-o passar porque ja tem a origem
  // marcada como "engaged" depois de semanas de anime com som. Um clique nosso nao
  // depende de nada disso: enquanto o iframe nao existir, nao ha video para arrancar.
  // E' a diferenca entre "o browser talvez obedeca" e "nao ha player no ecra".
  //
  // Vale so para o primeiro carregamento: a partir dai o auto-fallback de 15 s pode
  // trocar de fonte sozinho, como sempre, sem pedir outro clique.
  const [arrancado, setArrancado] = useState(() => settings.autoplay);

  const active = lista?.[index];
  const finalSrc = active ? applyPlaybackPrefs(active.embedUrl, settings) : null;

  useEffect(() => {
    // Re-inicia o indice activo quando a lista ou a origem mudarem.
    setIndex(() => firstAlive(lista, deadIds, startIndex));
    setReloadKey((k) => k + 1);
    setLoaded(false);
  }, [lista, deadIds, startIndex]);

  // Fonte nova (episodio novo, titulo novo, trocar de audio): o portao volta a
  // aparecer se o autoplay estiver desligado. NAO se mexe quando so o indice muda,
  // para o auto-fallback de 15 s poder trocar de fonte sem pedir outro clique.
  useEffect(() => {
    setArrancado(settings.autoplay);
  }, [lista, settings.autoplay]);

  useEffect(() => {
    if (!active) return;
    setLoaded(false);
    let done = false;
    const timer = setTimeout(() => {
      if (!done) {
        // Timeout: o iframe nao carregou. Só se avança quando há outra fonte;
        // se esta era a última, fica a mostrar a mensagem em vez de ficar em
        // loop a recarregar a mesma fonte.
        const proximo = nextAlive(index, lista, deadIds);
        if (proximo === index) {
          setLoaded(true); // sem mais fontes: para de tentar
          return;
        }
        done = true;
        setTrocada(active?.name || null);
        setIndex(proximo);
        setReloadKey((k) => k + 1);
        setLoaded(false);
      }
    }, TIMEOUT_MS);

    const iframe = iframeRef.current;
    const onload = () => {
      if (!done) {
        done = true;
        clearTimeout(timer);
        setLoaded(true);
      }
    };
    iframe?.addEventListener("load", onload);
    return () => {
      clearTimeout(timer);
      iframe?.removeEventListener("load", onload);
    };
    // `reloadKey` TEM de estar nesta lista, e nao e' por cerimonia: o efeito de
    // cima faz `setReloadKey(k + 1)` ao abrir, e o `key` do iframe obriga o
    // React a deitar fora o elemento e criar outro. Sem esta dependencia, este
    // efeito nao voltava a correr e o `load` ficava ligado ao iframe que ja
    // tinha ido para o caixote — ou seja, nunca chegava. O aviso "a carregar"
    // ficava no ecra com o video a dar, e o auto-fallback de 15s chegava a
    // trocar de fonte com o video a reproduzir bem.
  }, [active, lista, deadIds, index, reloadKey]);

  if (!active) return null;

  return (
    <div className="player">
      {arrancado ? (
        <iframe
          key={reloadKey}
          ref={iframeRef}
          src={finalSrc}
          title={title || active.name || "player"}
          allowFullScreen
          referrerPolicy="origin"
          // "autoplay" so entra quando a definicao esta ligada. Com a permissao
          // sempre presente, o player do provider arrancava sozinho mesmo com o
          // autoplay desligado nas Definicoes.
          allow={`${settings.autoplay ? "autoplay; " : ""}encrypted-media; fullscreen; picture-in-picture`}
        />
      ) : (
        <button
          type="button"
          className="player-arrancar"
          onClick={() => setArrancado(true)}
          title="Carregar o video"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" width="34" height="34" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
          <span>Carregar video</span>
        </button>
      )}
      {arrancado && (
        <button
          type="button"
          className="player-reload"
          title="Recarregar fonte (se nao carregar / erro 520)"
          aria-label="Recarregar fonte"
          onClick={() => {
            setReloadKey((k) => k + 1);
            setLoaded(false);
          }}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 0 14.85-3.36L23 10M1 14l4.64 4.36A20.49 15 0 0 0 20.49 15" />
          </svg>
        </button>
      )}
      {arrancado && !loaded && active.name && (
        <span className="player-loading-hint muted" style={{ position: "absolute", right: 8, bottom: 8, fontSize: 12 }}>
          {active.name} · a carregar...
        </span>
      )}
      {arrancado && trocada && loaded && (
        <span className="player-loading-hint muted" style={{ position: "absolute", left: 8, bottom: 8, fontSize: 12 }}>
          {trocada} nao carregou · a usar {active?.name}
        </span>
      )}
      {arrancado && <FullscreenButton targetRef={iframeRef} />}
    </div>
  );
}

// Primeiro embed "vivo" (nao em deadIds), ou o primeiro conhecido.
function firstAlive(list, dead, start) {
  if (!list?.length) return 0;
  const s = Math.max(0, start);
  for (let i = s; i < list.length; i++) if (!dead?.has(list[i].provider)) return i;
  for (let i = 0; i < s; i++) if (!dead?.has(list[i].provider)) return i;
  return s < list.length ? s : 0;
}

// Proximo indice vivo a partir de `i` (exclusive: a propria fonte nao conta).
// Comeca em `i + 1` de proposito — comecando em `i`, a fonte que estava a
// falhar era logo devolvida como "proxima" e o timeout de 15 s nunca saia
// dela. Devolve `i` quando nao ha mais nenhuma.
function nextAlive(i, list, dead) {
  if (!list?.length) return 0;
  for (let j = i + 1; j < list.length; j++) if (!dead?.has(list[j].provider)) return j;
  for (let j = 0; j < i; j++) if (!dead?.has(list[j].provider)) return j;
  return i;
}
