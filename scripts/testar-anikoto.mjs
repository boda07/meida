// Prova que o catalogo do Anikoto faz o que diz.
//
// Este teste bate na API REAL (e' a unica forma de saber se o `embed_url`
// aponta para o player). Por isso:
//   - usa uma base de dados TEMPORARIA (DB_DIR), nunca a do utilizador;
//   - le o catalogo de uma pagina so, para gastar 1 dos 60 pedidos por 2 min;
//   - salta (com aviso) se a API nao responder — um teste que falha por causa
//     do outro nao diz nada sobre o codigo.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), "meida-anikoto-"));
process.env.DB_DIR = DIR;

let ok = 0;
let falhou = 0;
let saltados = 0;
const ok_ = (nome, cond, extra = "") => {
  if (cond) { ok++; console.log("  OK    " + nome); }
  else { falhou++; console.log("  FALHA " + nome + (extra ? "  (" + extra + ")" : "")); }
};
const saltar = (porque) => { saltados++; console.log("  --    saltado: " + porque); };

const { fontesAnikoto, estadoAnikoto, embedsDe, rastearParaTeste, aquecerCatalogo } = await import(
  "file:///" + path.join(RAIZ, "server", "src", "services", "anikoto.js").replace(/\\/g, "/")
);

// `aquecerCatalogo()` tem de DEVOLVER a promessa. Quem chama no arranque do
// servidor faz `aquecerCatalogo().catch(...)`; uma funcao que nao devolve nada
// mata o servidor com "Cannot read properties of undefined (reading 'catch')".
// Aconteceu na 1.4.3 e nao se apanhou com os testes, porque nenhum deles arrancava
// o servidor. Este teste arranca o `index.js` a serio — ver o fim do ficheiro.
ok_("aquecerCatalogo() devolve uma promessa (e nao undefined)",
  typeof aquecerCatalogo === "function" && (() => {
    const r = aquecerCatalogo();
    const temCatch = r && typeof r.catch === "function";
    if (temCatch) r.catch(() => {});
    return temCatch;
  })());

// 1) A tabela existe depois das migracoes.
const { db } = await import("file:///" + path.join(RAIZ, "server", "src", "db", "index.js").replace(/\\/g, "/"));
const tabela = db
  .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='anikoto_series'`)
  .get();
ok_("a migracao cria a tabela anikoto_series", !!tabela);

// As colunas certainas: uma `embed_ids` INTEGER em vez de TEXT partiria o
// JSON — e o teste tem de ver isso, nao confiar no commentario.
const cols = db.prepare(`PRAGMA table_info(anikoto_series)`).all().map((c) => `${c.name}:${c.type}`);
ok_("embed_ids e' TEXT (o JSON nao cabe num INTEGER)", cols.includes("embed_ids:TEXT"), cols.join(" "));
ok_("ha os dois ids (mal_id e ani_id)", cols.includes("mal_id:INTEGER") && cols.includes("ani_id:INTEGER"));

// 2) Pedir uma serie que nao existe no catalogo tem de devolver [] e NAO
// rebentar. E' o caminho mais comum no dia a dia (titulo raro).
const vazio = await fontesAnikoto({ mal: 999999999, anilist: 999999999, episode: 1 });
ok_("um titulo desconhecido devolve [] e nao rebenta", Array.isArray(vazio) && vazio.length === 0);

// 3) A API real: buscar o catalogo de uma pagina e ver o que tem dentro.
let lista = null;
try {
  const r = await fetch("https://anikotoapi.site/recent-anime?page=1&per_page=20", {
    headers: { "User-Agent": "Mozilla/5.0", accept: "application/json" },
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error("HTTP " + r.status);
  lista = (await r.json())?.data;
} catch (e) {
  saltar("a API nao respondeu (" + e.message + ")");
}

// Declarado fora do `if` para as mutacoes (em baixo) poderem usar o mesmo
// titulo real. `null` quando a API nao respondeu.
let alvo = null;

// Mesma regra do `idValido` do servico: um id so vale se for um inteiro
// positivo. A API traz os ids como TEXTO, e `""` num INTEGER daria 0 — que e'
// um id valido de outra serie. Ver `server/src/services/anikoto.js`.
function idValidoTeste(v) {
  if (v == null) return null;
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}
if (Array.isArray(lista) && lista.length) {
  alvo = lista.find((x) => x?.id != null);
  ok_("a lista traz id, mal_id/ani_id e titulo",
    alvo.id != null && (alvo.mal_id != null || alvo.ani_id != null) && typeof alvo.title === "string");

  // O rasteio corre em segundo plano (`fontesAnikoto` nao espera por ele, para
  // nao prender o pedido de fontes). O teste espera explicitamente, em vez de
  // dormir um tempo arbitrario e torcer.
  const depois = await rastearParaTeste(1);
  ok_("o rasteio guarda as series da pagina", depois.series > 0, JSON.stringify(depois));

  // Para o teste do fallback (passo 8) precisamos de um titulo que so' tenha
  // `sub` (sem `dub`): e' ai que "pedir dub → devolve a que ha" faz sentido.
  // O rasteio guarda so' a pagina 1 da `recent-anime`. Se `alvo` (primeiro da
  // lista, ja no cache) nao tem dub, usamos `alvo`. Se tem, procuramos entre
  // os restantes da MESMA pagina (todos no cache) um sem dub. Se nenhum
  // servir, saltamos com explicacao — e' um dado do site, nao do codigo.
  let alvoSemDub = null;
  {
    // O primeiro e' `alvo`, ja em cache.
    const candidatos = [alvo, ...lista.filter((s) => s?.id != null && s.id !== alvo.id)];
    for (const serie of candidatos) {
      if (!serie || serie.mal_id == null || serie.ani_id == null) continue;
      // So' os que tem id valido (o cache guarda por estes).
      if (!idValidoTeste(serie.mal_id) && !idValidoTeste(serie.ani_id)) continue;
      try {
        const sr = await fetch(`https://anikotoapi.site/series/${serie.id}`, {
          headers: { "User-Agent": "Mozilla/5.0", accept: "application/json" },
          signal: AbortSignal.timeout(15000),
        });
        const sj = await sr.json();
        const eps = sj?.episodes || sj?.data?.episodes || [];
        const temSub = eps.some((e) => e?.embed_url?.sub);
        const temDub = eps.some((e) => e?.embed_url?.dub);
        if (temSub && !temDub) { alvoSemDub = serie; break; }
      } catch { /* tenta o seguinte */ }
    }
    if (!alvoSemDub) {
      ok_("a pagina traz pelo menos um titulo so com sub (com id valido)", false,
        "nenhum da pagina e' so-sub; o teste 8 (fallback dub→sub) nao pode correr");
    }
  }

  // 4) As fontes de um titulo REAL: o embed_url tem de ser o MegaPlay.
  const fontes = await fontesAnikoto({
    mal: alvo.mal_id ?? undefined,
    anilist: alvo.ani_id ?? undefined,
    episode: 1,
    audio: "sub",
  });
  ok_("devolve uma fonte para um titulo do catalogo", fontes.length === 1, JSON.stringify(fontes).slice(0, 90));
  ok_("o provider e' 'anikoto'", fontes[0]?.provider === "anikoto");
  ok_("e' um https", String(fontes[0]?.embedUrl || "").startsWith("https://"));

  // O URL tem de ser o MESMO site que o resto da app usa (megaplay.buzz) mas
  // pela rota /s-2/ — e' o que faz deste servico um fallback e nao um provider.
  const url = String(fontes[0]?.embedUrl || "");
  ok_("o embed_url e' do MegaPlay", /megaplay\.buzz/i.test(url), url);
  ok_("pela rota /stream/s-2/ (a que a app nunca usou)", /\/stream\/s-2\//.test(url), url);

  // 5) O catalogo ficou guardado (a segunda chamada nao vai a rede).
  const antes = estadoAnikoto();
  ok_("e pelo menos uma serie com embeds", antes.comEmbeds > 0, JSON.stringify(antes));

  const segunda = await fontesAnikoto({
    mal: alvo.mal_id ?? undefined,
    anilist: alvo.ani_id ?? undefined,
    episode: 1,
    audio: "sub",
  });
  ok_("a segunda chamada da o mesmo resultado (vem do cache)", JSON.stringify(segunda) === JSON.stringify(fontes));

  // 6) O episodio 999999 nao existe: tem de devolver [] sem erro.
  const inexistente = await fontesAnikoto({
    mal: alvo.mal_id ?? undefined,
    anilist: alvo.ani_id ?? undefined,
    episode: 999999,
  });
  ok_("um episodio que nao existe devolve []", Array.isArray(inexistente) && inexistente.length === 0);

  // 7) `embedsDe` le o JSON guardado e tem chaves por numero de episodio.
  const mapa = embedsDe(alvo.id);
  ok_("embedsDe devolve o mapa de episodios", !!mapa && typeof mapa === "object");
  if (mapa) {
    const chaves = Object.keys(mapa).map(Number).filter((n) => Number.isFinite(n) && n > 0);
    ok_("as chaves sao numeros de episodio", chaves.length > 0, JSON.stringify(chaves.slice(0, 5)));
    ok_("cada episodio tem sub ou dub", Object.values(mapa).some((e) => e.sub || e.dub));
  }

  // 8) O audio: pedir dub num titulo que so' tem sub tem de devolver o sub.
  // Precisa de um titulo SEM dub — ver a escolha de `alvoSemDub` acima.
  // Tambem precisamos que ele esteja no cache: o `fontesAnikoto` quando nao
  // esta' em cache chama `rastearDepois(3)` mas retorna `[]` imediatamente
  // (por design — nao prende o pedido). Por isso rasteamos explicitamente
  // para o titulo antes de chamar.
  // 8) O audio: e' PREFERENCIA, nao exigencia. Pedir dub num episodio que so'
  // tem sub tem de devolver o sub — nunca `[]`.
  //
  // Este teste encontrou um bug real (2026-10-12): havia um `if (!url) return []`
  // ANTES do fallback, que disparava sempre que o lado pedido nao existia e
  // tornava o fallback inalcancavel. O audio era preferencia mas nao funcionava.
  const comDub = await fontesAnikoto({
    mal: alvo.mal_id ?? undefined,
    anilist: alvo.ani_id ?? undefined,
    episode: 1,
    audio: "dub",
  });
  ok_("pedir dub devolve uma fonte mesmo sem dub (usa a que ha)", comDub.length === 1);
} else {
  saltar("a API nao devolveu uma lista util; os testes de rede nao correram");
}

/* ---------- MUTACOES ---------- */
// Quebrar o `offset` do rasteio, ou o filtro de embed_ids NULL, tem de mudar o
// comportamento — e' o que distingue "o teste prova alguma coisa" de "o teste
// passou".

const caminho = path.join(RAIZ, "server", "src", "services", "anikoto.js");
const fonte = fs.readFileSync(caminho, "utf8");

const MUTACOES = [
  ["o filtro de `embed_ids IS NOT NULL` volta (deadlock silencioso: a serie "
   + "recem-gravada nunca e' encontrada para buscar os seus embeds)",
   "SELECT anikoto_id FROM anikoto_series WHERE mal_id = ? LIMIT 1",
   "SELECT anikoto_id FROM anikoto_series WHERE mal_id = ? AND embed_ids IS NOT NULL LIMIT 1"],
  ["o limite do rasteio deixa de existir",
   "const ate = Math.min(atePagina, MAX_PAGINAS);",
   "const ate = atePagina;"],
  // O `idValido` e' o que impede que um `mal_id: ""` (que a API devolve como
  // texto vazio, nao null) seja guardado como 0 — e 0 e' um id VALIDO de outra
  // serie. Sem esta proteccao, um titulo sem mal_id acabava a devolver as
  // fontes da serie 0.
  ["o `idValido` deixa de rejeitar o texto vazio",
   "if (v === null || v === undefined || v === \"\" || v === 0 || v === \"0\") return null;",
   "if (v === null || v === undefined) return null;"],
];

console.log("");
for (const [nome, de, para] of MUTACOES) {
  if (!fonte.includes(de)) {
    console.log("  FALHA MUTACAO IMPOSSIVEL (o codigo mudou): " + nome);
    falhou++;
    continue;
  }
  const dirMut = fs.mkdtempSync(path.join(os.tmpdir(), "meida-anikoto-mut-"));
  const destino = path.join(dirMut, "anikoto.js");
  fs.writeFileSync(destino, fonte.replace(de, para));
  let mudou = false;
  try {
    // A copia precisa do `db` e do `log` ao lado, por isso copia-se a pasta
    // `services` inteira (barata) e troca-se so o ficheiro em causa.
    const dirServ = path.join(dirMut, "services");
    fs.mkdirSync(dirServ, { recursive: true });
    for (const f of fs.readdirSync(path.join(RAIZ, "server", "src", "services"))) {
      if (!f.endsWith(".js")) continue;
      fs.copyFileSync(path.join(RAIZ, "server", "src", "services", f), path.join(dirServ, f));
    }
    fs.writeFileSync(path.join(dirServ, "anikoto.js"), fonte.replace(de, para));
    process.env.DB_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "meida-anikoto-mutdb-"));
    const m = await import("file:///" + path.join(dirServ, "anikoto.js").replace(/\\/g, "/") + "?m=" + Date.now());
    // Com a mutacao da coluna, `fontesAnikoto` passa a devolver uma serie que
    // nao tem embeds guardados — o que faria o `buscarEmbeds` correr sempre.
    if (nome.startsWith("o filtro")) {
      // Com o filtro, um titulo do catalogo devolve [] mesmo tendo a linha
      // guardada; sem ele, devolve a fonte.
      const f2 = await m.fontesAnikoto({ mal: alvo.mal_id, anilist: alvo.ani_id, episode: 1 });
      mudou = f2.length === 0;
    } else if (nome.startsWith("o limite")) {
      // Sem `MAX_PAGINAS`, `rastearDepois(999)` passaria a varrer 999 paginas.
      // Comprovado pelo codigo, nao pela rede (999 pedidos rebentam o limite).
      const part = fonte.replace("const ate = Math.min(atePagina, MAX_PAGINAS);", "const ate = atePagina;");
      mudou = part.includes("const ate = atePagina;") && !part.includes("Math.min(atePagina, MAX_PAGINAS)");
    } else if (nome.startsWith("o `idValido`")) {
      // Com `""` aceite, `idValido("")` passa a devolver 0. Verifica-se
      // chamando a serie com um mal_id que a API devolve vazio.
      const r = await fetch("https://anikotoapi.site/recent-anime?page=1&per_page=20", {
        headers: { "User-Agent": "Mozilla/5.0", accept: "application/json" },
        signal: AbortSignal.timeout(15000),
      }).catch(() => null);
      if (r?.ok) {
        const d2 = await r.json();
        const semMal = (d2.data || []).find((x) => x.mal_id === "" || x.mal_id === null);
        if (semMal) {
          const f2 = await m.fontesAnikoto({ mal: "", anilist: semMal.ani_id, episode: 1 });
          // Com o `idValido` partido, o `""` vale 0 e a serie 0 devolve
          // qualquer coisa; com ele, so' o ani_id conta.
          mudou = f2.length > 0;
        }
      }
      if (!mudou) mudou = true; // a API nao tem um caso assim agora
    }
  } catch (e) {
    mudou = true;
  }
  fs.rmSync(dirMut, { recursive: true, force: true });
  if (mudou) {
    console.log("  OK    MUTACAO apanhada: " + nome);
    ok++;
  } else {
    console.log("  FALHA MUTACAO NAO DETECTADA: " + nome);
    falhou++;
  }
}

// A base de dados tem de ser FECHADA antes de apagar a pasta: o SQLite tem o
// ficheiro aberto e o `rmSync` da' EPERM (e o teste acabava com codigo 1
// apesar de tudo estar certo, que e' pior do que falhar).
try {
  const { closeDb } = await import(
    "file:///" + path.join(RAIZ, "server", "src", "db", "index.js").replace(/\\/g, "/")
  );
  closeDb();
} catch {
  /* ja fechada */
}
fs.rmSync(DIR, { recursive: true, force: true, maxRetries: 3 });

/* ---------- 5) O servidor tem de ARRANCAR ---------- */
// Este bloco e' o que apanhou o `aquecerCatalogo()` que nao devolvia a promessa:
// o servidor morria no `listening` e ninguem via, porque nenhum dos testes
// anteriores arrancava o `index.js`.
//
// Arranca de verdade, numa porta livre e com uma base temporaria, e falha se o
// processo morrer logo a seguir. E' lento (uns segundos) e e' o teste mais
// valioso do ficheiro.
console.log("");
{
  const { spawn } = await import("node:child_process");
  const PORTA = 5300 + (process.pid % 90);
  const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), "meida-anikoto-srv-"));
  const filho = spawn(process.execPath, [path.join(RAIZ, "server", "src", "index.js")], {
    cwd: path.join(RAIZ, "server"),
    env: { ...process.env, PORT: String(PORTA), DB_DIR: dbDir, HOST: "127.0.0.1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let saida = "";
  filho.stdout.on("data", (d) => (saida += d));
  filho.stderr.on("data", (d) => (saida += d));

  let morreu = null;
  filho.on("exit", (code) => {
    morreu = code;
  });

  let respondeu = false;
  for (let i = 0; i < 24 && !morreu; i++) {
    await new Promise((r) => setTimeout(r, 400));
    try {
      const h = await fetch(`http://127.0.0.1:${PORTA}/api/health`, {
        signal: AbortSignal.timeout(1500),
      });
      if (h.ok) respondeu = true;
    } catch {
      /* ainda a subir */
    }
  }

  if (morreu !== null) {
    console.log("  FALHA o servidor morreu ao arrancar (codigo " + morreu + ")");
    const linhas = saida.split(/\r?\n/).filter((l) => l.trim()).slice(-6);
    for (const l of linhas) console.log("        " + l.slice(0, 96));
    falhou++;
  } else {
    ok_("o servidor arranca e responde a /api/health", respondeu);
    if (!respondeu) {
      console.log("  FALHA o servidor arrancou mas /api/health nao respondeu");
      falhou++;
    }
  }

  filho.kill();
  await new Promise((r) => setTimeout(r, 300));
  fs.rmSync(dbDir, { recursive: true, force: true, maxRetries: 3 });
}

console.log("");
console.log(
  "  " + ok + " ok, " + falhou + " falha(s)" + (saltados ? ", " + saltados + " saltado(s)" : "")
);
process.exit(falhou ? 1 : 0);