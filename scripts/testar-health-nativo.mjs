// Health-check do NATIVO separado do IFRAME.
//
// ---------------------------------------------------------------------------------
// A ASSERCAO CENTRAL DESTE FICHEIRO
// ---------------------------------------------------------------------------------
// **O nativo e' sondado pelo `getSources`, e as duas entradas do MegaPlay tem
// estado PRÓPRIO.**
//
// As duas entradas (`megaplay-anime` e `megaplay-anime-nativo`) tem o MESMO URL.
// Com uma unica sonda pela pagina, recebiam o resultado uma da outra — e o
// health-check dizia "ok" para uma coisa que nao tinha testado.
//
// E a pagina responder 200 nao prova nada sobre o nativo:
//   - o `enc` pode nao desencriptar (chave/IV trocados) com a pagina saudavel
//     -> o health-check dizia "ok" e o episodio nao dava;
//   - o inverso tambem: pagina morta, nativo a desencriptar a sé.
//
// Por isso o nativo vai pelo MESMO caminho que o player usa
// (`extrairMegaPlayNativo`), e nao por uma sonda paralela: se um dia voltarem a
// divergir, e' porque um deles deixou de chamar a funcao do outro.
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { ANIME_PROVIDERS, PROVIDERS } from "../server/src/services/providers.js";

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const HEALTH = fs.readFileSync(path.join(RAIZ, "server", "src", "services", "providerHealth.js"), "utf8");
const PROVIDERS_SRC = fs.readFileSync(path.join(RAIZ, "server", "src", "services", "providers.js"), "utf8");

let ok = 0;
let falhou = 0;
function ok_(nome, cond, extra = "") {
  if (cond) { ok++; console.log("  OK    " + nome); }
  else { falhou++; console.log("  FALHA " + nome + (extra ? "  ->  " + extra : "")); }
}

console.log("");
console.log("  1) as DUAS entradas do MegaPlay sao mesmo duas");
{
  const mega = ANIME_PROVIDERS.filter((p) => p.id.startsWith("megaplay"));
  ok_("ha duas entradas", mega.length === 2, mega.length + " entrada(s)");
  ok_("com ids distintos", new Set(mega.map((p) => p.id)).size === 2, mega.map((p) => p.id).join(", "));
  ok_("uma e' nativa e a outra nao",
    mega.filter((p) => p.native).length === 1 && mega.filter((p) => !p.native).length === 1);
  ok_("**e com o MESMO URL** (e' por isso que a sonda tinha de diferir)",
    mega[0].url === mega[1].url, mega.map((p) => p.url).join(" vs "));
}

console.log("");
console.log("  2) nomes que se distinguem no ecra");
{
  const nomes = ANIME_PROVIDERS.filter((p) => p.id.startsWith("megaplay")).map((p) => p.name);
  ok_("nao sao iguais", nomes[0] !== nomes[1], nomes.join(" / "));
  ok_("o nativo diz que e' nativo", /nativo/i.test(nomes.find((n) => /nativo/i.test(n))));
  ok_("o iframe diz que e' iframe", /iframe/i.test(nomes.join(" ")), nomes.join(" / "));
  // Os dois nomes diziam o TIPO de titulo ("anime"), que e' igual nos dois — e a
  // pessoa nao conseguia dizer qual era o nativo.
  ok_("e nenhum dos dois se chama so' pelo tipo", !/^MegaPlay \(anime\)$/.test(nomes.join("")));
  // **Os dois nomes tem de dizer COMO se ve.** Bastava diferirem: "MegaPlay
  // (nativo)" e "MegaPlay (anime, iframe)" sao diferentes e continua a nao se
  // saber qual das duas da legendas. E' a duvida que a pessoa tem quando uma
  // funciona e a outra nao.
  const nativo = nomes.find((n) => /nativo/i.test(n)) || "";
  const iframe = nomes.find((n) => /iframe/i.test(n)) || "";
  ok_("o nome do nativo diz o que GANHA (nao so' que e' nativo)",
    nativo.length > 0 && nativo !== "MegaPlay (nativo)",
    "sem dizer o que ganha, nao se sabe porque se escolhe esta e nao a outra");
  ok_("o nome do iframe diz que e' iframe", /iframe/i.test(iframe), iframe);
}

console.log("");
console.log("  3) o nativo e' sondado pelo getSources, nao pela pagina");
{
  ok_("existe `probeNativo`", /async function probeNativo\(/.test(HEALTH));
  const fn = HEALTH.slice(HEALTH.indexOf("async function probeNativo"));
  const corpo = fn.slice(0, fn.indexOf("\n}"));
  // A funcao do PLAYER, nao uma reimplementacao: e' o que impede o health-check
  // de dizer "ok" a uma coisa que o player nao consegue fazer.
  ok_("**usa `extrairMegaPlayNativo` (a mesma do player)**",
    /extrairMegaPlayNativo\(\{\s*embedUrl/.test(corpo), "esta' a sondar por um caminho diferente do player");
  ok_("importa essa funcao", /import \{ extrairMegaPlayNativo \}/.test(HEALTH));
  // E exige que a desencriptacao deu VIDEO, nao que a chamada respondeu.
  ok_("exige o m3u8 (isto e', a desencriptacao deu)",
    /!dados \|\| !dados\.m3u8/.test(corpo), "aceita a resposta como sucesso sem o video");
  ok_("e diz o que falhou, em vez de um ok generico",
    /o getSources não devolveu vídeo em claro/.test(corpo));
  // A pagina e' sondada primeiro, para o motivo ser util.
  ok_("sonda a pagina primeiro (para o erro ser legivel)", /const pagina = await probe\(url\)/.test(corpo));
  ok_("e distingue 'a pagina nao responde' de 'o enc nao desencripta'",
    /a pagina do player/.test(corpo) && /não devolveu vídeo em claro/.test(corpo));
  // `try` COLADO a chamada. A versao anterior da assercao procurava um `catch`
  // qualquer na funcao e passava porque o nome da funcao aparece TAMBEM no
  // comentario dentro do `catch` — ou seja,via o texto e nao pelo codigo.
  ok_("a extracao esta' dentro de um try/catch, sem nada pelo caminho",
    /try \{\s*dados = await extrairMegaPlayNativo/.test(corpo),
    "uma excepcao aqui rebentava o health-check de TODOS os providers");
}

console.log("");
console.log("  4) cada entrada vai ao probe que lhe corresponde");
{
  ok_("o `native` entra no teste", /native: !!p\.native/.test(HEALTH));
  ok_("e escolhe o probe por esse campo",
    /t\.native \? await probeNativo\(t\.url\) : await probe\(t\.url\)/.test(HEALTH),
    "as duas voltavam a receber a mesma sonda");
  ok_("o resultado viaja com o `id` da entrada", /id: t\.id,/.test(HEALTH));
  ok_("e com o `native`, para a interface poder distinguir",
    /native: !!t\.native,/.test(HEALTH));
  ok_("o log tambem diz qual era", /nativo: !!t\.native/.test(HEALTH));
}

console.log("");
console.log("  5) o resto nao se partiu");
{
  // O frontend monta o `deadIds` a partir do `id` (ver useProviderHealth.js), e
  // nao do URL: e' por isso que ids distintos chegam a estados distintos.
  const HOOK = fs.readFileSync(path.join(RAIZ, "web", "src", "components", "useProviderHealth.js"), "utf8");
  ok_("o frontend separa por `id` (e nao por url)", /map\(\(p\) => p\.id\)/.test(HOOK));
  // Os providers de filme continuam a ser sondados pela pagina.
  ok_("os de filme continuam no probe normal", /type: "movie",\s*\n\s*native: false/.test(HEALTH));
  ok_("e o probe normal da pagina nao foi mexido", /async function probe\(url\)/.test(HEALTH));
  ok_("a pagina do player continua a ser testada no nativo", /probe\(url\)/.test(HEALTH));
  // E `native` tem de chegar a `/providers`, senao o frontend nem sabe.
  ok_("os providers de anime sao todos listados", ANIME_PROVIDERS.length >= 3, String(ANIME_PROVIDERS.length));
  ok_("e os de filme tambem", PROVIDERS.filter((p) => p.movie).length >= 5);
}

console.log("");
console.log("  6) higiene");
{
  ok_("sem caracteres CJK", !/[\u2E80-\u9FFF\u3000-\u303F\uFF00-\uFFEF]/.test(HEALTH + PROVIDERS_SRC));
  ok_("sem caractere de substituicao", !/[\uFFFD]/.test(HEALTH + PROVIDERS_SRC));
}

console.log("");
console.log("  " + ok + " ok, " + falhou + " falha(s)");
process.exit(falhou ? 1 : 0);