// O VidAPI respondia **HTTP 200** com a pagina "404 — Page Not Found" dentro.
//
// Era esse o problema: o `probe` do health-check so olhava para o status, via
// 200 e dava o provider como vivo. Como o VidAPI era o primeiro da lista, era
// a fonte default — e o utilizador via o 404 dentro do player, sem perceber que
// era do provider e nao do titulo.
//
// A correcao tem tres partes, e este teste guarda as tres:
//   1. a pagina de erro e' reconhecida pelo TEXTO (motivoDePaginaMorta);
//   2. o VidAPI sai da primeira posicao e fica no fim (pode voltar um dia);
//   3. a cache do health-check e' invalidada, senao a cache antiga (que dizia
//      "vivo") mantinha-o como default durante 6 horas depois da actualizacao.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PROVIDERS } from "../server/src/services/providers.js";
import { motivoDePaginaMorta } from "../server/src/services/providerHealth.js";

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SERVICOS = path.join(RAIZ, "server", "src", "services");
const HEALTH = fs.readFileSync(path.join(SERVICOS, "providerHealth.js"), "utf8");
const PROVIDERS_SRC = fs.readFileSync(path.join(SERVICOS, "providers.js"), "utf8");

let ok = 0;
let falhou = 0;
function ok_(nome, cond, extra = "") {
  if (cond) {
    console.log("  OK    " + nome);
    ok++;
  } else {
    console.log("  FALHA " + nome + (extra ? "  ->  " + extra : ""));
    falhou++;
  }
}

// HTML verdadeiro do VidAPI (medido a 2026-11-07). O titulo aparece numa
// variavel de JavaScript, com o travessao — e nao uma entidade HTML.
const PAGINA_VIDAPI = `<!doctype html>
<html lang="en"><head><title>VidAPI.xyz - Player</title></head>
<body>
<script>
(function () {
  if (window !== window.top) return;
  var titleText = "404 — Page Not Found";
  var messageHTML = \`
    <h1>404 — Page Not Found</h1>
    <p>Please return to the home page.</p>
  \`;
})();
</script>
</body></html>`;

// Uma pagina de player que funciona e que FALA de "page not found" no proprio
// JavaScript (para mostrar um erro quando um episodio nao existe). Nao e' uma
// pagina de erro — e' exactamente a armadilha que impede usar a frase solta.
const PAGINA_BOA = `<!doctype html>
<html><head><title>Player</title></head>
<body><video></video>
<script>
  // If the episode is missing, the player handles page not found itself.
  function erro() { return "page not found"; }
</script>
</body></html>`;

console.log("");
console.log("  1) a pagina 404 falsa do VidAPI e' reconhecida");
{
  const motivo = motivoDePaginaMorta(PAGINA_VIDAPI);
  ok_("devolve o marcador exacto", motivo === "404 — page not found", String(motivo));
  ok_("e um marcador, nao um booleano", typeof motivo === "string");
  ok_("nao depende do status HTTP (o HTML e' so' texto)", !/status/i.test(motivo));
  ok_("texto vazio nao rebenta", motivoDePaginaMorta("") === null);
  ok_("null nao rebenta", motivoDePaginaMorta(null) === null);
}

console.log("");
console.log("  2) uma pagina BOA que fala de 'page not found' nao e' morta");
{
  const motivo = motivoDePaginaMorta(PAGINA_BOA);
  ok_("a pagina boa nao e' marcada", motivo === null, String(motivo));
  // A frase solta apanharia esta pagina; a frase exacta com o travessao nao.
  // E' por isso que o marcador nao pode ser so' "page not found".
  ok_("a pagina boa contem a frase solta (a armadilha)", /page not found/i.test(PAGINA_BOA));
  ok_("e mesmo assim nao e' morta", motivoDePaginaMorta(PAGINA_BOA) === null);
}

console.log("");
console.log("  3) o VidAPI saiu da frente da lista");
{
  ok_("ha mais de um provider", PROVIDERS.length > 1, String(PROVIDERS.length));
  ok_("o primeiro ja' nao e' o VidAPI", PROVIDERS[0]?.id !== "vidapi", PROVIDERS[0]?.id);
  ok_("o primeiro e' o MoviesAPI", PROVIDERS[0]?.id === "moviesapi", PROVIDERS[0]?.id);
  ok_("o VidAPI continua na lista (pode voltar)", PROVIDERS.some((p) => p.id === "vidapi"));
  ok_(
    "e esta' no FIM",
    PROVIDERS[PROVIDERS.length - 1]?.id === "vidapi",
    PROVIDERS.map((p) => p.id).join(", ")
  );
  ok_("o VidAPI ainda tem os dois templates", (() => {
    const v = PROVIDERS.find((p) => p.id === "vidapi");
    return /\/embed\/movie\/\{tmdb\}/.test(v?.movie || "") && /\/embed\/tv\/\{tmdb\}\/\{season\}\/\{episode\}/.test(v?.tv || "");
  })());
}

console.log("");
console.log("  4) a cache antiga do health-check foi invalidada");
{
  ok_("a chave e' a versao 2", /const CACHE_KEY = "provider-health-2";/.test(HEALTH));
  ok_("e ja' nao e' a chave antiga", !/const CACHE_KEY = "provider-health";/.test(HEALTH));
}

console.log("");
console.log("  5) mutacoes (partir o codigo de proposito)");
{
  const mutacoes = [
    {
      nome: "o marcador do VidAPI desaparece",
      ficheiro: "providerHealth.js",
      fonte: HEALTH,
      mutar: (s) => s.replace(/[ \t]*"404 — page not found",\r?\n/, ""),
      veredito: (mod) => mod.motivoDePaginaMorta(PAGINA_VIDAPI) === null,
    },
    {
      nome: "o marcador fica solto ('page not found') e apanha uma pagina boa",
      ficheiro: "providerHealth.js",
      fonte: HEALTH,
      mutar: (s) => s.replace('"404 — page not found"', '"page not found"'),
      veredito: (mod) => mod.motivoDePaginaMorta(PAGINA_BOA) !== null,
    },
    {
      nome: "o travessao vira hifen e a pagina real deixa de ser apanhada",
      ficheiro: "providerHealth.js",
      fonte: HEALTH,
      mutar: (s) => s.replace('"404 — page not found"', '"404 - page not found"'),
      veredito: (mod) => mod.motivoDePaginaMorta(PAGINA_VIDAPI) === null,
    },
    {
      nome: "o VidAPI volta a ser o primeiro da lista",
      ficheiro: "providers.js",
      fonte: PROVIDERS_SRC,
      mutar: (s) => s.replace('id: "moviesapi"', 'id: "vidapi"'),
      veredito: (mod) => mod.PROVIDERS[0]?.id !== "moviesapi",
    },
  ];

  const copias = [];
  try {
    for (const [i, m] of mutacoes.entries()) {
      const mutado = m.mutar(m.fonte);
      if (mutado === m.fonte) {
        console.log("  FALHA MUTACAO IMPOSSIVEL (a ancora nao aplicou): " + m.nome);
        falhou++;
        continue;
      }
      // Copia para a MESMA pasta: assim os imports relativos (`./providers.js`,
      // `./cache.js`, ...) continuam a resolver. A query `?v=` forca o Node a
      // avaliar a copia em vez de devolver o modulo ja' importado.
      const nomeCopia = `.mut-vidapi-${process.pid}-${i}-${path.basename(m.ficheiro)}`;
      const destino = path.join(SERVICOS, nomeCopia);
      fs.writeFileSync(destino, mutado, "utf8");
      copias.push(destino);
      const mod = await import(pathToFileURL(destino).href + "?v=" + i + "-" + Date.now());
      if (m.veredito(mod)) {
        console.log("  OK    MUTACAO apanhada: " + m.nome);
        ok++;
      } else {
        console.log("  FALHA MUTACAO NAO DETECTADA: " + m.nome);
        falhou++;
      }
    }
  } finally {
    for (const c of copias) {
      try {
        fs.unlinkSync(c);
      } catch {
        // Se nao existir, nao ha' nada a fazer.
      }
    }
  }
}

console.log("");
console.log("  6) higiene");
{
  ok_("providerHealth.js sem CJK", !/[\u2E80-\u9FFF\u3000-\u303F\uFF00-\uFFEF]/.test(HEALTH));
  ok_("providers.js sem CJK", !/[\u2E80-\u9FFF\u3000-\u303F\uFF00-\uFFEF]/.test(PROVIDERS_SRC));
  ok_("providerHealth.js sem caractere invalido", !HEALTH.includes("\uFFFD"));
  ok_("providers.js sem caractere invalido", !PROVIDERS_SRC.includes("\uFFFD"));
}

console.log("");
console.log("  " + ok + " ok, " + falhou + " falha(s)");
process.exitCode = falhou ? 1 : 0;
