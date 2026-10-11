// Este ficheiro responde a uma unica pergunta: **esta interface e' a do site,
// ou a app que ja esta instalada?**
//
// Tudo o que oferece para DESCARREGAR a app depende desta resposta. Na app de
// desktop oferecer "descarregar a app" e' absurdo — a pessoa ja a tem; no site
// e' exactamente o que se procura.
//
// A regra e' deliberadamente simples: e' web quando NAO e' Electron E o host
// nao e' local. As tres condicoes juntas, porque cada uma cobre um caso
// diferente:
//
//   - `!window.electronAPI` → dentro da app de desktop. (A app expoe esta
//     objecto pelo `contextBridge`; ver `electron/preload.cjs`.)
//   - host nao e' `localhost`/`127.0.0.1`/`[::1]` → desenvolvimento local. Onde
//     `npm run dev` corre e onde os testes de browser correm. Um botao para
//     descarregar a app apareceria no ecra de quem esta' a desenvolver, e ia
//     para o sitio errado.
//   - o que resta e' uma versao hospedada: hoje `https://meida.onrender.com`.
//
// **PORQUE NAO HA' UM `MEIDA_E_WEB` NO runtime-config:** dava para o servidor
// dizer "sou o Render" por `/runtime-config.json`. Nao vale a pena. Esse
// ficheiro esta' tambem em `web/public/`, portanto o `npm run dev` le-o igual e
// passaria a mostrar o botao em desenvolvimento. Detectar pelo `hostname` nao
// depende do servidor, funciona em qualquer hospedagem, e da' o mesmo resultado.
//
// E' uma funcao pura (recebe o que precisa em vez de ir buscar), para o teste
// nao precisar de um `window` nem de um `location`.
export function ehVersaoWeb({ electronAPI, hostname } = {}) {
  if (electronAPI) return false;
  // O `hostname` do browser nunca traz a porta, mas um teste (ou um `URL`)
  // pode trazer "localhost:5173". Cortar na `:` e no ultimo `:` torna a regra
  // correcta nos dois casos, e nao custa nada.
  let host = String(hostname || "").toLowerCase().trim();
  if (host.startsWith("[")) {
    // URL com ipv6: "[::1]:5173" -> "::1"
    const fecho = host.indexOf("]");
    if (fecho >= 0) host = host.slice(1, fecho);
  } else if (host.includes(":")) {
    host = host.slice(0, host.indexOf(":"));
  }
  if (!host) return false;
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
    return false;
  }
  return true;
}

/** A mesma pergunta, para o browser. Isola o `window` num sitio so. */
export function noBrowser() {
  if (typeof window === "undefined") return false;
  return ehVersaoWeb({
    electronAPI: window.electronAPI,
    hostname: window.location?.hostname,
  });
}

/**
 * Onde fica o instalador.
 *
 * A release do GitHub (`/releases/latest`) e' um alvo estavel: o GitHub
 * redireciona para a versao mais recente. O URL do `.exe` lleva a versao
 * escrita no nome (`MEIDA-Setup-1.4.0.exe`), por isso um link directo passaria
 * a apontar para uma versao antiga apos a proxima release — e, pior, o
 * `electron-updater` so olha para o `latest.yml`. O link para a pagina mostra o
 * instalador E as notas, que e' o que interessa quando se chega de fora.
 */
export const URL_RELEASE = "https://github.com/boda07/meida/releases/latest";