// O mapa de calor e a racha contavam dias em UTC; o heatmap desenha dias LOCAIS.
//
// O heatmap (`web/src/components/heatmap.js`, `chaveDia`) usa
// `getFullYear/getDate`, que sao locais. O servidor usava
// `toISOString().slice(0, 10)`, que e' UTC. A diferenca de horas mandava o que se
// via depois das 21:00 (UTC-3) para a celula de AMANHA — que o heatmap esconde,
// porque `semanasDoMapa` marca `fora: true` para `cursor > chave`.
//
// **E porque nao se mede o calor das horas em segundos:** os testes com relogio
// sao instaveis. O que se mede aqui e' o **numero de construcoes de
// `Intl.DateTimeFormat`**, que e' deterministico: a versao ingenua
// (`toLocaleDateString` a cada `dayOf`) constroi um formatador POR LINHA —
// 45,96 us em vez de 1,19 us, medido, ou seja 689 ms num pedido de 15 000 datas.
import path from "node:path";
import fs from "node:fs";
import { spawn } from "node:child_process";
import { DatabaseSync } from "node:sqlite";

import { dayOf, hojeEm, tzDoPedido } from "../server/src/services/dias.js";
import { computeStreak } from "../server/src/routes/achievements.js";

const RAIZ = process.cwd();
const PORTA = 5950 + (process.pid % 30);
const BASE = `http://127.0.0.1:${PORTA}`;
const SENHA = "senha-correta-123";

let ok = 0;
let falhou = 0;
function ok_(nome, cond, extra = "") {
  if (cond) { ok++; console.log("  OK    " + nome); }
  else { falhou++; console.log("  FALHA " + nome + (extra ? "  ->  " + extra : "")); }
}
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const ler = (p) => fs.readFileSync(path.join(RAIZ, p), "utf8");

// **Nada neste teste pode atirar.** `dayOf` devolve `null` para o que nao serve e
// cai em UTC para o fuso invalido, portanto no codigo bom nunca lanca. Se uma
// mutacao o fizer atirar, um teste que deixasse a excecao subir abortava o
// modulo **sem linha de resumo** — e o harness de mutacoes le "sem resumo" como
// "mutacao nao detectada". O mesmo ja aconteceu com um `JSON.parse` sem guarda.
// Por isso tudo passa por aqui e o atiro vira uma verificacao que FALHA.
const ATIROU = "ATIROU: ";
function dia(iso, tz) {
  try { return dayOf(iso, tz); } catch (e) { return ATIROU + (e && e.message ? e.message : String(e)); }
}
function racha(days, tz, agora) {
  try { return computeStreak(days, tz, agora); }
  catch (e) { return { streak: ATIROU + e.message, bestStreak: -1 }; }
}

// ---------------------------------------------------------------------------
console.log("");
console.log("  1) o dia local, instante a instante");

// Os dois casos que o utilizador deu, mais a volta completa do dia.
const CASOS = [
  // [instante, fuso, dia esperado]
  ["2026-10-18T01:30:00Z", "America/Sao_Paulo", "2026-10-17"], // 22:30 de 17/out
  ["2026-07-10T23:30:00Z", "Europe/Lisbon", "2026-07-11"],      // 00:30 de 11/jul, verao
  ["2026-10-18T01:30:00Z", "Europe/Lisbon", "2026-10-18"],
  ["2026-07-10T23:30:00Z", "America/Sao_Paulo", "2026-07-10"],
  // A fronteira: 1 minuto antes e 1 minuto depois da meia-noite local.
  ["2026-10-18T02:59:00Z", "America/Sao_Paulo", "2026-10-17"],
  ["2026-10-18T03:00:00Z", "America/Sao_Paulo", "2026-10-18"],
  ["2026-10-17T22:59:00Z", "America/Sao_Paulo", "2026-10-17"],
  ["2026-10-17T23:00:00Z", "America/Sao_Paulo", "2026-10-17"],
  // O mesmo instante em tres fusos, todos em UTC+0 excepto o primeiro.
  ["2026-03-15T12:00:00Z", "UTC", "2026-03-15"],
  ["2026-03-15T12:00:00Z", "Europe/Lisbon", "2026-03-15"],
  ["2026-03-15T12:00:00Z", "Asia/Tokyo", "2026-03-15"],
  ["2026-03-15T23:30:00Z", "Asia/Tokyo", "2026-03-16"], // ja e' o dia seguinte
  // Meios fusos (a India entra em 30 min) e fusos de 45 min.
  ["2026-06-01T18:30:00Z", "Asia/Kolkata", "2026-06-02"],
  ["2026-06-01T13:15:00Z", "Asia/Kathmandu", "2026-06-01"],
];
for (const [iso, tz, esperado] of CASOS) {
  const obtido = dia(iso, tz);
  ok_(iso + " em " + tz.padEnd(18) + " -> " + esperado, obtido === esperado, "veio " + obtido);
}

// Sem fuso, ou com um fuso que o Node nao conhece: UTC, como era antes.
for (const [iso, tz, porquema] of [
  ["2026-10-18T01:30:00Z", null, "sem fuso"],
  ["2026-10-18T01:30:00Z", "Inventado/Inventado", "fuso inventado"],
  ["2026-10-18T01:30:00Z", "", "fuso vazio"],
  ["2026-10-18T01:30:00Z", "a".repeat(200), "fuso gigante"],
  ["2026-10-18T01:30:00Z", { toString: () => "UTC" }, "fuso que nao e' string"],
  ["2026-10-18T01:30:00Z", 12345, "fuso que e' numero"],
]) {
  const obtido = dia(iso, tz);
  ok_(porquema.padEnd(22) + " -> cai em UTC (2026-10-18)", obtido === "2026-10-18", "veio " + obtido);
}

// O que o Node faz com um fuso invalido, para o `try`/`catch` ter razao.
let atirou = false;
try { new Intl.DateTimeFormat("en-CA", { timeZone: "Inventado/Inventado" }); } catch { atirou = true; }
ok_("um fuso invalido atira mesmo (o try/catch nao e' vao)", atirou);

// Entradas que nao servem.
for (const [entrada, nome] of [[null, "null"], [undefined, "undefined"], ["", "string vazia"],
  ["nao-e-uma-data", "texto qualquer"], [new Date("nope"), "Date invalido"]]) {
  ok_("dayOf(" + nome + ") -> null", dia(entrada, "Europe/Lisbon") === null,
    "veio " + JSON.stringify(dia(entrada, "Europe/Lisbon")));
}
ok_("dayOf aceita um Date", dia(new Date("2026-10-18T01:30:00Z"), "America/Sao_Paulo") === "2026-10-17");
ok_("hojeEm() e' o dia de agora", /^\d{4}-\d{2}-\d{2}$/.test(hojeEm("Europe/Lisbon")));

// ---------------------------------------------------------------------------
console.log("");
console.log("  1b) a racha: o 'hoje' e' o de quem ve o ecra");
// `agora` e' passado a mao. Sem isto o teste dependia da hora a que corria, e
// meio dia nao distinguia os dois regimes. E' o mesmo caminho que se abriu para
// o `buildActivity()` do Discord.
{
  // --- O que a contagem faz, e o que ela NAO faz ---
  //
  // **Num fuso de desvio FIXO a contagem nao muda.** Em Sao Paulo (UTC-3, sem
  // hora de verao desde 2019) o conjunto de dias e' o mesmo de antes, so' que
  // deslocado em 1 — e o "hoje" desloca-se com ele. O `computeStreak` conta a
  // partir do "hoje" para tras, por isso da 2 nos dois regimes.
  //
  // **A correccao do fuso NAO muda, portanto, o numero da racha em Sao Paulo.**
  // O que estava partido ali sao as CHAVES: e' elas que vao parar a celula de
  // amanha no heatmap, que a esconde. O numero que parte e' o de Lisboa, logo
  // abaixo. (Dizer que a racha partia no Brasil sem medir e' um palpite; medido,
  // o numero e' o mesmo e a razao da queixa e' o heatmap.)
  const AGORA_SP = new Date("2026-10-19T01:30:00Z");
  ok_("as 01:30 de UTC, Sao Paulo ainda esta' no dia ANTERIOR",
    dia(AGORA_SP, "America/Sao_Paulo") === "2026-10-18" && dia(AGORA_SP, null) === "2026-10-19",
    "SP " + dia(AGORA_SP, "America/Sao_Paulo") + " / UTC " + dia(AGORA_SP, null));
  const spDias = new Set(["2026-10-17", "2026-10-18"]);
  const spLocal = racha(spDias, "America/Sao_Paulo", AGORA_SP);
  const spUtc = racha(new Set(["2026-10-18", "2026-10-19"]), null, AGORA_SP);
  ok_("em Sao Paulo a contagem da o mesmo numero (2) nos dois regimes — ver a nota",
    spLocal.streak === 2 && spUtc.streak === 2,
    "SP " + spLocal.streak + " / UTC " + spUtc.streak);

  // --- Onde a contagem parte mesmo: a noite da mudanca de hora ---
  //
  // Lisboa nao desvia sempre -1: a mudanca acontece. As 22:30 e as 23:30 de UTC
  // do dia 24 sao as 23:30 do dia 24 e as **00:30 do dia 25** em Lisboa — dois
  // dias locais seguidos, portanto uma racha de 2. Em UTC sao as duas o dia 24:
  // uma racha de 1. E' aqui que o NUMERO parte, e nao so as chaves.
  const AGORA_LIS = new Date("2026-10-25T12:00:00Z");
  const NOITES = ["2026-10-24T22:30:00Z", "2026-10-24T23:30:00Z"];
  const emLisboa = new Set(NOITES.map((i) => dia(i, "Europe/Lisbon")));
  const emUtc = new Set(NOITES.map((i) => dia(i, null)));
  ok_("as duas noites caem em dias LOCAIS diferentes em Lisboa",
    [...emLisboa].sort().join(", ") === "2026-10-24, 2026-10-25", [...emLisboa].join(", "));
  ok_("e em UTC caem as duas no mesmo dia", [...emUtc].sort().join(", ") === "2026-10-24", [...emUtc].join(", "));

  const lisboaStreak = racha(emLisboa, "Europe/Lisbon", AGORA_LIS);
  const utcStreak = racha(emUtc, null, AGORA_LIS);
  ok_("em Lisboa a racha e' 2", lisboaStreak.streak === 2, "veio " + lisboaStreak.streak);
  ok_("em UTC a mesma atividade da racha 1 — o numero parte", utcStreak.streak === 1, "veio " + utcStreak.streak);
  ok_("os dois regimes NAO dao o mesmo numero", lisboaStreak.streak !== utcStreak.streak,
    "os dois deram " + lisboaStreak.streak + " — o fuso nao esta' a mudar nada");

  // Uma racha que nao esta' viva: atividade antiga, "hoje" longe.
  const velha = racha(new Set(["2026-01-05", "2026-01-06"]), "Europe/Lisbon", AGORA_LIS);
  ok_("atividade de ha meses nao e' racha viva", velha.streak === 0, "veio " + velha.streak);
  ok_("mas conta como melhor racha", velha.bestStreak === 2, "veio " + velha.bestStreak);

  ok_("sem atividade da 0 em qualquer fuso",
    racha(new Set(), "Asia/Tokyo", AGORA_LIS).streak === 0 &&
    racha(new Set(), null, AGORA_LIS).streak === 0);

  // O historico mais longo tem de ser o mesmo em qualquer fuso.
  const corrido = new Set(["2026-01-05", "2026-01-06", "2026-01-07"]);
  ok_("a melhor racha historica nao depende do fuso",
    racha(corrido, "Pacific/Auckland", AGORA_LIS).bestStreak ===
    racha(corrido, "UTC", AGORA_LIS).bestStreak);
}

// ---------------------------------------------------------------------------
console.log("");
console.log("  2) o formato da chave tem de ser YYYY-MM-DD (o heatmap depende)");
// `chaveDia` no cliente produz "YYYY-MM-DD". Se `format()` devolvesse outra
// coisa, as chaves nao batiam e o mapa desenhava vazio SEM DAR ERRO.
{
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: "UTC" });
  const s = f.format(new Date("2026-01-02T00:00:00Z"));
  ok_("en-CA da YYYY-MM-DD neste runtime", /^\d{4}-\d{2}-\d{2}$/.test(s), "deu '" + s + "'");
  ok_("e o mesmo formato que a chaveDia do cliente", s === chaveDiaDoCliente(new Date("2026-01-02T00:00:00Z")),
    s + " vs " + chaveDiaDoCliente(new Date("2026-01-02T00:00:00Z")));
}

function chaveDiaDoCliente(d) {
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dia = String(d.getUTCDate()).padStart(2, "0");
  return `${d.getUTCFullYear()}-${m}-${dia}`;
}

// ---------------------------------------------------------------------------
console.log("");
console.log("  3) o formatador e' construido uma vez, nao uma por linha");
// Determinista: conta construcoes, nao mede segundos (o relogio engana).
{
  const Original = Intl.DateTimeFormat;
  let construcoes = 0;
  Intl.DateTimeFormat = function (...a) { construcoes++; return new Original(...a); };
  const antes = construcoes;
  for (let i = 0; i < 2000; i++) dia("2026-10-18T01:30:00Z", "Pacific/Auckland");
  const delta = construcoes - antes;
  Intl.DateTimeFormat = Original;
  // A versao ingenua constroi 2000. Com cache sao 0 (ja estava em cache) ou 1.
  ok_("2000 dayOf com o mesmo fuso construiram " + delta + " formatador(es)", delta <= 1,
    "foram " + delta + " — o cache nao esta' a ser usado");
}

// ---------------------------------------------------------------------------
console.log("");
console.log("  4) ha UMA fonte de verdade, e o cliente envia o fuso");
{
  const stats = ler("server/src/stats.js");
  const ach = ler("server/src/routes/achievements.js");
  const cli = ler("web/src/api/client.js");

  ok_("stats.js importa dayOf do modulo partilhado", /import \{[^}]*dayOf[^}]*\} from "\.\/services\/dias\.js"/.test(stats));
  ok_("achievements.js tambem", /import \{[^}]*dayOf[^}]*\} from "\.\.\/services\/dias\.js"/.test(ach));
  // A copia em UTC e' o que ha nos dois sitios, e o que este bug era.
  ok_("stats.js ja nao tem o toISOString().slice(0, 10)", !/toISOString\(\)\.slice\(0, 10\)/.test(stats));
  ok_("achievements.js tambem nao", !/function dayOf\(iso\)/.test(ach));
  ok_("todas as chamadas de dayOf em stats.js levam o fuso", !/dayOf\([^,)]*\)/.test(stats));

  // O cliente tem de mandar o fuso nos DOIS pedidos, nao so no `/stats`: a
  // racha e' a outra ponta da mesma coisa.
  ok_("o cliente tem fusoParams()", /function fusoParams\(\)/.test(cli));
  ok_("stats manda o fuso", /stats: \(\) => get\("\/api\/stats", fusoParams\(\)\)/.test(cli));
  ok_("achievements tambem (e' a racha)", /achievements: \(\) => get\("\/api\/achievements", fusoParams\(\)\)/.test(cli));
  ok_("e o fuso vem do Intl do proprio browser",
    /Intl\.DateTimeFormat\(\)\.resolvedOptions\(\)\.timeZone/.test(cli));
  ok_("o heatmap continua a desenhar dias locais (nao foi 'corrigido' para UTC)",
    /getFullYear\(\)/.test(ler("web/src/components/heatmap.js")));

  // As rotas tem de ler o `?tz` e passa-lo.
  ok_("a rota /stats le o tz do pedido", /tzDoPedido\(req\)/.test(ler("server/src/routes/stats.js")));
  ok_("a rota /achievements tambem", /tzDoPedido\(req\)/.test(ach));
  // A racha e' testada A SÉRIO na secção 1b, por isso aqui nao se volta a
  // procurar o texto do "hoje" — essa verificacao partiu assim que a assinatura
  // ganhou o `agora`. Fica so' o que nao muda: o fuso entra na racha, e o
  // "agora" e' um argumento (e' o que torna a 1b deterministica).
  ok_("computeStreak recebe o fuso", /computeStreak\(days, tz[,)]/.test(ach));
  ok_("e o 'agora' e' um argumento, nao new Date() dentro",
    /computeStreak\(days, tz, agora = new Date\(\)\)/.test(ach) &&
    /hojeEm\(tz, agora\)/.test(ach));
  ok_("a rota passa o fuso para a racha", /computeStreak\(counts\.days, tz\)/.test(ach));
}

// O `?tz` repetido chega como array. Um array nao e' um fuso.
{
  ok_("tzDoPedido com ?tz=A&tz=B devolve so' o primeiro",
    tzDoPedido({ query: { tz: ["A", "B"] } }) === "A");
  ok_("tzDoPedido sem tz devolve null", tzDoPedido({ query: {} }) === null);
  ok_("tzDoPedido com um array de nao-strings devolve null",
    tzDoPedido({ query: { tz: [123] } }) === null);
  ok_("tzDoPedido aguenta um req inexistente", tzDoPedido(undefined) === null);
}

// ---------------------------------------------------------------------------
console.log("");
console.log("  5) contra o servidor real");
const dbDir = fs.mkdtempSync(path.join(process.env.TEMP, "meida-test-tz-"));
const filho = spawn(process.execPath, [path.join(RAIZ, "server", "src", "index.js")], {
  cwd: RAIZ,
  env: { ...process.env, PORT: String(PORTA), DB_DIR: dbDir, HOST: "127.0.0.1", JWT_SECRET: "t-tz" },
  stdio: ["ignore", "pipe", "pipe"],
});
let saida = "";
filho.stdout.on("data", (d) => (saida += d));
filho.stderr.on("data", (d) => (saida += d));
const pedir = (c, o = {}) => fetch(BASE + c, { signal: AbortSignal.timeout(8000), ...o });

// Tres instantes escolhidos para cairem em dias diferentes em fusos diferentes.
const INSTANTES = [
  "2026-10-18T01:30:00Z", // 22:30 de 17/out em Sao Paulo
  "2026-07-10T23:30:00Z", // 00:30 de 11/jul em Lisboa
  "2026-10-19T01:30:00Z", // 22:30 de 18/out em Sao Paulo
];

try {
  let pronto = false;
  for (let i = 0; i < 120 && !pronto; i++) {
    try { const r = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(3000) }); if (r.ok) pronto = true; }
    catch { await dormir(150); }
  }
  ok_("o servidor arrancou", pronto, saida.slice(-400));

  if (pronto) {
    const nome = "tz_" + Math.random().toString(36).slice(2, 6) + "_u";
    await pedir("/api/auth/register", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: nome, password: SENHA }),
    });
    const login = await (await pedir("/api/auth/login", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: nome, password: SENHA }),
    })).json();
    const auth = { authorization: "Bearer " + login.token };

    for (let n = 0; n < INSTANTES.length; n++) {
      const r = await pedir("/api/library", {
        method: "POST", headers: { ...auth, "content-type": "application/json" },
        body: JSON.stringify({ type: "movie", tmdbId: 810000 + n, title: "F" + n, watched: true }),
      });
      if (!r.ok) ok_("o titulo " + n + " foi criado", false, r.status + " " + (await r.text()).slice(0, 80));
    }
    // As datas que interessam vao na base: a rota `/library` grava "agora".
    const db = new DatabaseSync(path.join(dbDir, "meida.db"));
    const marcar = db.prepare("UPDATE library SET watched_at = ?, updated_at = ? WHERE media_type = 'movie' AND external_id = ?");
    INSTANTES.forEach((iso, n) => marcar.run(iso, iso, 810000 + n));
    db.close();

    const comFuso = async (rota, tz) => {
      const u = new URL(BASE + rota);
      if (tz) u.searchParams.set("tz", tz);
      return (await (await fetch(u, { headers: auth, signal: AbortSignal.timeout(8000) })).json());
    };
    // `dias` pode nao vir: um 500 devolve `{error}`, e `s.dias.map(...)` rebenta
    // e leva o modulo inteiro abaixo da linha de resumo — que e' o que o harness
    // de mutacoes le como "mutacao nao detectada". Devolve a lista vazia e deixa
    // a verificacao que a usa falhar com a mensagem certa.
    const diasDe = (s) => (Array.isArray(s && s.dias) ? s.dias.map((d) => d.dia).sort() : []);

    ok_("ha tres dias com atividade", diasDe(await comFuso("/api/stats", null)).length === 3,
      JSON.stringify(diasDe(await comFuso("/api/stats", null))));

    const sp = diasDe(await comFuso("/api/stats", "America/Sao_Paulo"));
    const lisboa = diasDe(await comFuso("/api/stats", "Europe/Lisbon"));
    const utc = diasDe(await comFuso("/api/stats", null));

    ok_("Sao Paulo: " + sp.join(", "), JSON.stringify(sp) === JSON.stringify(["2026-07-10", "2026-10-17", "2026-10-18"]),
      JSON.stringify(sp));
    ok_("Lisboa:    " + lisboa.join(", "), JSON.stringify(lisboa) === JSON.stringify(["2026-07-11", "2026-10-18", "2026-10-19"]),
      JSON.stringify(lisboa));
    ok_("sem fuso continua UTC: " + utc.join(", "), JSON.stringify(utc) === JSON.stringify(["2026-07-10", "2026-10-18", "2026-10-19"]),
      JSON.stringify(utc));

    // **A afirmação que importa, e que não depende de qual é o dia de hoje:**
    // os dias que o servidor devolve são exactamente os que a função do cliente
    // (`chaveDia`, que é local) daria para cada instante, no fuso de quem pede.
    // A de UTC dá outros — e o heatmap esconde o que fica depois de hoje.
    const esperado = (tz) => INSTANTES.map((iso) => dia(iso, tz)).sort();
    ok_("Sao Paulo devolve os dias locais de cada instante",
      JSON.stringify(sp) === JSON.stringify(esperado("America/Sao_Paulo")),
      "veio " + JSON.stringify(sp) + ", esperado " + JSON.stringify(esperado("America/Sao_Paulo")));
    ok_("Lisboa tambem, e sao diferentes dos de Sao Paulo",
      JSON.stringify(lisboa) === JSON.stringify(esperado("Europe/Lisbon")) &&
      JSON.stringify(lisboa) !== JSON.stringify(sp));
    ok_("e sem fuso sao os de UTC, que sao diferentes dos dois",
      JSON.stringify(utc) === JSON.stringify(esperado(null)) &&
      JSON.stringify(utc) !== JSON.stringify(sp) &&
      JSON.stringify(utc) !== JSON.stringify(lisboa));

    // Um fuso que o Node nao conhece nao pode derrubar o pedido.
    const mau = await comFuso("/api/stats", "Inventado/Inventado");
    ok_("fuso inventado -> responde", Array.isArray(mau.dias));
    ok_("fuso inventado -> os mesmos dias de UTC", JSON.stringify(diasDe(mau)) === JSON.stringify(utc),
      "inventado " + JSON.stringify(diasDe(mau)) + " vs UTC " + JSON.stringify(utc));
    ok_("e o servidor continua vivo", (await fetch(BASE + "/api/health", { signal: AbortSignal.timeout(3000) })).ok);
    const achMau = await comFuso("/api/achievements", "Inventado/Inventado");
    ok_("o /achievements tambem nao morre", typeof achMau.streak === "number",
      "veio " + JSON.stringify(achMau).slice(0, 90));
    const achBom = await comFuso("/api/achievements", "Europe/Lisbon");
    ok_("a racha responde com o fuso a valer",
      typeof achBom.streak === "number", "veio " + JSON.stringify(achBom).slice(0, 90));

    // O `?tz` repetido nao pode dar 500.
    const repetido = await fetch(BASE + "/api/stats?tz=UTC&tz=Inventado", { headers: auth, signal: AbortSignal.timeout(8000) });
    ok_("?tz repetido nao da 500", repetido.status === 200, "status " + repetido.status);
  }
} finally {
  try { filho.kill(); } catch { /* ja parado */ }
  await Promise.race([new Promise((r) => filho.once("exit", r)), dormir(5000)]);
  try { filho.stdout.destroy(); filho.stderr.destroy(); filho.unref(); } catch { /* ja fechado */ }
  try { fs.rmSync(dbDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch { /* ja foi */ }
}

console.log("");
console.log("  " + ok + " ok, " + falhou + " falha(s)");
process.exitCode = falhou ? 1 : 0;
