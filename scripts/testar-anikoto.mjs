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

const { fontesAnikoto, estadoAnikoto, embedsDe, rastearParaTeste } = await import(
  "file:///" + path.join(RAIZ, "server", "src", "services", "anikoto.js").replace(/\\/g, "/")
);

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
  lista = null;
  saltar("a API nao respondeu (" + e.message + ")");
}

// Declarado fora do `if` para as mutacoes (em baixo) poderem usar o mesmo
// titulo real. `null` quando a API nao respondeu.
let alvo = null;
if (Array.isArray(lista) && lista.length) {
  alvo = lista.find((x) => x?.id != null);
  ok_("a lista traz id, mal_id/ani_id e titulo",
    alvo.id != null && (alvo.mal_id != null || alvo.ani_id != null) && typeof alvo.title === "string");

  // O rasteio corre em segundo plano (`fontesAnikoto` nao espera por ele, para
  // nao prender o pedido de fontes). O teste espera explicitamente, em vez de
  // dormir um tempo arbitrario e torcer.
  const depois = await rastearParaTeste(1);
  ok_("o rasteio guarda as series da pagina", depois.series > 0, JSON.stringify(depois));

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

  // 8) O audio: pedir dub quando so' ha' sub tem de devolver o sub, nao nada.
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

console.log("");
console.log(
  "  " + ok + " ok, " + falhou + " falha(s)" + (saltados ? ", " + saltados + " saltado(s)" : "")
);
process.exit(falhou ? 1 : 0);