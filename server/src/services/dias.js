// O dia local de um instante. Uma fonte de verdade para o mapa de calor e para
// as rachas, que antes tinham cada uma a sua copia em UTC.
//
// **O problema:** `toISOString().slice(0, 10)` da o dia em **UTC**, e o mapa de
// calor desenha dias **locais** (`chaveDia` em `web/src/components/heatmap.js`
// usa `getFullYear/getDate`). A diferenca de horas e' uma celula na coluna
// errada. Em UTC-3, o que se ve depois das 21:00 cai no dia de amanha e o
// heatmap esconde-a (`fora: true`, "depois de hoje nao existe"); em Portugal no
// verao, 00:00 a 00:59 conta como o dia anterior. O cliente ja rodava as HORAS
// no histograma (`serieStats.js`) — os dias nunca foram rodados.
//
// **Porquê um `tz` do cliente e não um fuso no servidor:** o servidor e' o mesmo
// para toda a gente e nao sabe onde esta cada pessoa. O Render e o FadeHost estao
// em UTC; quem esta' no Brasil nao. E a unica forma de o heatmap e a racha
// concordarem com o que o utilizador ve no ecra.
//
// **O `format()` e' o que se usa, e nao `toLocaleDateString()` ponto a ponto.**
// Medido em 15 000 linhas (uma biblioteca grande):
//
//   toISOString().slice(0,10)                    0,98 us   (o que havia)
//   toLocaleDateString("en-CA", { timeZone })   45,96 us   <-- 47x, 689 ms por pedido
//   formatToParts() com o formatador em cache    2,34 us
//   format() com o formatador em cache           1,19 us   <-- o que fica
//
// A diferenca entre a primeira e a ultima e' irrelevante; a segunda custava meio
// segundo por pedido, e foi assim que este bug se escondeu tanto tempo: uma
// correccao que custa 47x mais nao entra na mesma versao.
//
// `en-CA` foi escolhido porque e' o unico locale cujo formato curto ja e'
// "YYYY-MM-DD" — o que e' exactamente o formato das chaves. Verificado com
// `formatToParts`: {year, literal, month, literal, day}.

// ---------------------------------------------------------------------------
// Formatadores
// ---------------------------------------------------------------------------

// `timeZone` tanto mais valido e' melhor, mas o cliente escolhe: um fuso
// desconhecido **atira** `RangeError` (medido), e um pedido nao pode morrer por
// causa do que um browser disse. Da' `try`/`catch` e queda-se em UTC.
const formatadores = new Map();
const LIMITE_FUSOS = 32; // fusos em uso a um tempo. Ha ~600 validos; 32 e' folgado.

// `en-CA` foi escolhido porque e' o unico locale cujo formato curto ja e'
// "YYYY-MM-DD". **Isso e' verificado ao arrancar, e nao assumido:** se um runtime
// vier sem esse locale (ou com ICU reduzido), o `format()` devolveria
// "17/10/2026", as chaves deixavam de bater com o `chaveDia` do heatmap e o
// mapa desenhava vazio **sem erro nenhum**. A alternativa de baixo custo e'
// `formatToParts`, que monta a chave a mao — e que fica 2x mais lenta.
//
// Uma vez so, no arranque: e' a forma de o erro ser visivel aqui em vez de
// aparecer como um heatmap em branco.
const EN_CA_YMD = (() => {
  try {
    const s = new Intl.DateTimeFormat("en-CA", { timeZone: "UTC" }).format(
      new Date("2026-01-02T00:00:00Z")
    );
    return /^\d{4}-\d{2}-\d{2}$/.test(s);
  } catch {
    return false;
  }
})();

function formatadorDe(tz) {
  if (typeof tz !== "string") return null;
  const limpo = tz.trim();
  // Os nomes IANA mais longos tem ~32 caracteres ("America/Argentina/ComodRivadavia").
  // O limite corta o que nao pode ser um fuso e trava o crescimento do cache.
  if (!limpo || limpo.length > 64) return null;
  if (formatadores.has(limpo)) return formatadores.get(limpo);

  let f;
  try {
    const bruto = new Intl.DateTimeFormat("en-CA", { timeZone: limpo });
    f = EN_CA_YMD
      ? bruto
      : {
          // Runtime sem o formato esperado: monta-se a chave a partir das partes.
          format: (d) => {
            const p = bruto.formatToParts(d);
            const porTipo = (tipo) => (p.find((x) => x.type === tipo) || {}).value || "";
            return `${porTipo("year")}-${porTipo("month")}-${porTipo("day")}`;
          },
        };
  } catch {
    return null; // fuso invalido: o chamador cai em UTC
  }
  // Sem este limite, um pedido com `?tz=` aleatorio ia encher o mapa. Um cliente
  // so' consegue acrescentar uma entrada por fuso VALIDO, e sao poucos.
  if (formatadores.size >= LIMITE_FUSOS) formatadores.clear();
  formatadores.set(limpo, f);
  return f;
}

// ---------------------------------------------------------------------------
// A funcao
// ---------------------------------------------------------------------------

/**
 * "YYYY-MM-DD" do dia **local de quem pede**, a partir de um instante.
 *
 * Aceita `Date`, numero ou string ISO. Sem `tz` (ou com um `tz` que o Node nao
 * reconhece) devolve o dia em **UTC** — que e' o que a app fazia antes, e o que
 * o heatmap ja' desalinhava. Nao e' um sitio ideal, mas e' melhor do que atirar.
 *
 * @param {string|Date|number|null|undefined} iso  o instante
 * @param {string} [tz]  nome de fuso IANA (o que o cliente envia)
 * @returns {string|null} a chave do dia, ou `null` se o instante nao serve
 */
export function dayOf(iso, tz) {
  if (iso === null || iso === undefined || iso === "") return null;
  const d = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(d.getTime())) return null;

  const f = formatadorDe(tz);
  if (!f) return d.toISOString().slice(0, 10);
  try {
    return f.format(d);
  } catch {
    // `format` tambem pode atirar (uma data fora do intervalo do ICU). Nao ha
    // dia local a dar, por isso volta-se ao UTC em vez de perder a linha.
    return d.toISOString().slice(0, 10);
  }
}

/** O dia de "agora" no fuso pedido. E' o `today` das rachas. */
export function hojeEm(tz, agora = new Date()) {
  return dayOf(agora, tz);
}

/**
 * O fuso que veio no pedido, ja normalizado para string.
 *
 * Va para as rotas e' isto e nao o `req.query.tz` cru: uma query pode chegar
 * como array (`?tz=a&tz=b`) e o `dayOf` nao quer um array.
 */
export function tzDoPedido(req) {
  const bruto = req?.query?.tz;
  if (Array.isArray(bruto)) return typeof bruto[0] === "string" ? bruto[0] : null;
  return typeof bruto === "string" ? bruto : null;
}
