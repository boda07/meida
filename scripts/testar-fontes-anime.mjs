// A mensagem "falta o parametro tmdb" num ANIME mandava quem investiga para o
// lado errado: o problema nao e' o TMDB, e' a AniList.
//
// Medido antes da correccao (servidor real):
//   /api/sources?mal=21              -> 400 "falta o parametro tmdb"   <-- o que a app mandava
//   /api/sources?type=anime&mal=21   -> 400 "Nao consegui obter as fontes deste anime agora..."
//
// A causa: o ramo anime do frontend (Details.jsx) mandava {mal, anilist, episode,
// audio} **sem `type`**, e o servidor so' conseguia dizer "isto e' um anime"
// pelo `type` que nunca chegava. A mensagem de anime, posta no servidor
// precisamente para este caso (2026-10-08, o Dragon Ball), era INALCANCAVEL.
import path from "node:path";
import fs from "node:fs";
import { spawn } from "node:child_process";

const RAIZ = process.cwd();
const PORTA = 5970 + (process.pid % 20);
const BASE = `http://127.0.0.1:${PORTA}`;

let ok = 0;
let falhou = 0;
function ok_(nome, cond, extra = "") {
  if (cond) { ok++; console.log("  OK    " + nome); }
  else { falhou++; console.log("  FALHA " + nome + (extra ? "  ->  " + extra : "")); }
}
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
console.log("");
console.log("  1) o frontend manda o `type` no ramo anime");
// (Isto e' uma verificacao de texto porque o pedido e' feito no browser. O
// comportamento de VERDADE esta' na seccao 2, contra o servidor a correr.)
{
  const f = fs.readFileSync(path.join(RAIZ, "web", "src", "pages", "Details.jsx"), "utf8");
  const ramo = f.split("if (details.isAnime) {")[1] || "";
  const pedido = ramo.split("api")[1] || "";
  ok_("o ramo anime manda type: 'anime'", /type:\s*"anime"/.test(pedido.split("})")[0] || ramo),
    "nao encontrei 'type: \"anime\"' no ramo anime");
  ok_("e continua a mandar mal e anilist", /mal:\s*details\.malId/.test(pedido) && /anilist:\s*details\.anilistId/.test(pedido));
}

console.log("");
console.log("  2) o servidor sabe que e' um anime sem depender do `type`");
{
  const f = fs.readFileSync(path.join(RAIZ, "server", "src", "routes", "sources.js"), "utf8");
  ok_("o `type` e' derivado quando vem mal/anilist sem type",
    /!tipoCru && \(mal \|\| anilist\)/.test(f));
  ok_("e a mensagem de anime e' a que se chega nesse caso",
    /type === "anime"/.test(f));
}

const dbDir = fs.mkdtempSync(path.join(process.env.TEMP, "meida-test-anime-"));
const filho = spawn(process.execPath, [path.join(RAIZ, "server", "src", "index.js")], {
  cwd: RAIZ,
  env: { ...process.env, PORT: String(PORTA), DB_DIR: dbDir, HOST: "127.0.0.1", JWT_SECRET: "t-anime" },
  stdio: ["ignore", "pipe", "pipe"],
});
let saida = "";
filho.stdout.on("data", (d) => (saida += d));
filho.stderr.on("data", (d) => (saida += d));

const pedir = async (q) => {
  try {
    const r = await fetch(BASE + q, { signal: AbortSignal.timeout(30000) });
    const t = await r.text();
    try {
      const j = JSON.parse(t);
      return { status: r.status, error: j.error || null, embeds: (j.embeds || []).length };
    } catch { return { status: r.status, error: t.slice(0, 90), embeds: 0 }; }
  } catch (e) { return { status: "EXC", error: e.message, embeds: 0 }; }
};

try {
  let pronto = false;
  for (let i = 0; i < 120 && !pronto; i++) {
    try { const r = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(3000) }); if (r.ok) pronto = true; }
    catch { await dormir(150); }
  }
  ok_("o servidor arrancou", pronto, saida.slice(-400));

  if (pronto) {
    // Um id de MAL que nao resolve para nada. Escolhido para o teste ser
    // IGUAL com a AniList de pe ou em baixo: sem correspondencia nao ha fontes,
    // em qualquer dos dois casos.
    const MAL_SEM_FONTES = "999999999";

    const semType = await pedir("/api/sources?mal=" + MAL_SEM_FONTES);
    ok_("?mal=... sem `type` -> a mensagem de ANIME, nao a de 'falta o parametro tmdb'",
      semType.error && !/falta o parametro tmdb/.test(semType.error) && /anime/i.test(semType.error),
      "veio: " + JSON.stringify(semType.error));

    const comType = await pedir("/api/sources?type=anime&mal=" + MAL_SEM_FONTES);
    ok_("?type=anime&mal=... -> a mesma mensagem de anime",
      comType.error && /anime/i.test(comType.error) && !/falta o parametro tmdb/.test(comType.error),
      "veio: " + JSON.stringify(comType.error));

    ok_("e as duas dizem a mesma coisa (o `type` ja nao muda nada)",
      semType.error === comType.error,
      "sem type: " + JSON.stringify(semType.error) + " | com type: " + JSON.stringify(comType.error));

    // Um filme SEM tmdb continua a dar a mensagem de filme. A correccao nao
    // pode ter trocado uma mensagem pela outra.
    const filme = await pedir("/api/sources?type=movie");
    ok_("um filme sem tmdb continua a dar 'falta o parametro tmdb'",
      filme.error === "falta o parametro tmdb", "veio: " + JSON.stringify(filme.error));

    const serie = await pedir("/api/sources?type=tv");
    ok_("uma serie sem tmdb tambem", serie.error === "falta o parametro tmdb", "veio: " + JSON.stringify(serie.error));

    // E com o tmdb presente, um filme nao deve ser confundido com anime.
    const comTmdb = await pedir("/api/sources?type=movie&tmdb=550");
    ok_("um filme com tmdb nao da 400 de anime",
      comTmdb.status === 200, "status " + comTmdb.status + " " + JSON.stringify(comTmdb.error));

    // O id do AniList nao muda, por isso vive em DISCO. E' o que faz o anime
    // continuar com fontes quando a AniList esta' em baixo.
    console.log("");
    console.log("  3) o id do AniList fica guardado em disco");
    {
      const jikan = await import(
        "file:///" + path.join(RAIZ, "server", "src", "services", "jikan.js").replace(/\\/g, "/")
      );
      const cache = await import(
        "file:///" + path.join(RAIZ, "server", "src", "services", "cache.js").replace(/\\/g, "/")
      );
      // Um id de MAL qualquer, com um id do AniList inventado, gravado no disco
      // como se a AniList o tivesse devolvido antes.
      const MAL = 987654321;
      cache.cacheSet("anilistid:" + MAL, 12345);
      // A cache em memoria esta' vazia (o processo e' novo), por isso isto so
      // funciona se o id estiver mesmo em DISCO.
      const doDisco = await jikan.malToAnilist(String(MAL));
      ok_("com o id em disco, o malToAnilist devolve-o sem pedir a API", doDisco === 12345, "veio " + JSON.stringify(doDisco));

      const meta = await jikan.getAnilistMeta(String(MAL));
      ok_("e o getAnilistMeta tambem usa o do disco", meta?.id === 12345, "veio " + JSON.stringify(meta));
    }
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
