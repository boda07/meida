// A lista de episodios de um anime tem de existir, mesmo quando a API falha.
//
// ---------------------------------------------------------------------------------
// A ASSERCAO CENTRAL DESTE FICHEIRO
// ---------------------------------------------------------------------------------
// **Um anime nunca pode aparecer com "Temporada 1 (0 eps)".**
//
// Havia DUAS falhas encadeadas, e nenhuma das duas dava erro nenhum — o servidor
// respondia 200, o frontend desenhava, era so a lista que vinha vazia:
//
//  1. O espelho Tenrai (o primario desde 1-out-2026) devolve as linhas de
//     /anime/{id}/episodes SEM o campo `episode` e SEM o `mal_id`. O filtro era
//     `(e.episode ?? e.mal_id) != null` — com os dois a `undefined`, `??` dava
//     `undefined` e o `!= null` era falso para TODAS as linhas. Zero episodios,
//     em silencio, para qualquer anime.
//     Este teste e' o que torna impossivel voltar a filterar fora os que nao
//     trazem numero: usa a posicao na lista.
//
//  2. Quando a lista vem mesmo vazia (o Tenrai tem a base incompleta para
//     alguns titulos), o servidor devolvia `[{... episodes: []}]` — UMA
//     temporada com zero episodios. O frontend so caia no seu fallback com
//     `if (!seasons.length)`, que nunca era verdade, porque o comprimento e' 1.
//     Ou seja: o fallback existia e era correcto, mas estava morto.
//     Verificado aqui pela assercao do `seasons.some(s => s.episodes.length)`.
//
// A segunda e' a que da menos vontade de se corrigir, porque o codigo
// "parece" funcionar: o fallback esta la, a resposta tem uma temporada, o
// utilizador so vê "0 eps".
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import {
  normalizarEpisodios,
  episodiosPorNumero,
  groupEpisodesBySeason,
} from "../server/src/services/jikan.js";

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const DETAILS = fs.readFileSync(
  path.join(RAIZ, "web", "src", "pages", "Details.jsx"),
  "utf8"
);

let ok = 0;
let falhou = 0;
function ok_(nome, cond, extra = "") {
  if (cond) { ok++; console.log("  OK    " + nome); }
  else { falhou++; console.log("  FALHA " + nome + (extra ? "  ->  " + extra : "")); }
}

console.log("");
console.log("  1) o espelho Tenrai nao traz `episode` nem `mal_id` — a posicao e' o numero");
{
  // Forma exacta que o Tenrai devolveu para o Sayonara Zetsubou Sensei (2605).
  const tenrai = [
    { title: "Goodbye, Mr. Despair", aired: "2007-07-08T00:00:00+00:00" },
    { title: "When I Came Out Of The Tunnel It Was White", aired: "2007-07-15T00:00:00+00:00" },
    { title: "Go Fly Over That Country", aired: "2007-07-22T00:00:00+00:00" },
  ];
  const eps = normalizarEpisodios(tenrai);
  ok_("nao descarta as linhas sem numero (o bug do filtro antigo)", eps.length === 3);
  ok_("o numero vem da posicao", eps.map((e) => e.episodeNumber).join(",") === "1,2,3");
  // `?.[0]` proposito: uma mutacao pode esvaziar a lista, e o teste tem de
  // reportar FALHA com o resumo em baixo, nao rebentar a meio.
  ok_("o titulo e' o do episodio", eps?.[0]?.name === "Goodbye, Mr. Despair");
  ok_("a data vira timestamp", eps?.[0]?.aired === 1183852800000);
}

console.log("");
console.log("  2) o Jikan oficial (que traz `episode`) continua a ser lido bem");
{
  const jikan = [
    { mal_id: 1234, episode: 1, title: "Um", aired: "2009-07-05T00:00:00+00:00" },
    { mal_id: 1235, episode: 2, title: "Dois", aired: "2009-07-12T00:00:00+00:00" },
    { mal_id: 1236, episode: 3, title: "Tres", aired: "2009-07-19T00:00:00+00:00", filler: true },
  ];
  const eps = normalizarEpisodios(jikan);
  ok_("usa o `episode` do Jikan", eps.map((e) => e.episodeNumber).join(",") === "1,2,3");
  ok_("filler passa", eps?.[2]?.filler === true);
  ok_("os outros nao ficam filler", eps?.[0]?.filler === false);
}

console.log("");
console.log("  3) ordem, lixo e titulo em falta");
{
  const foraDeOrdem = [
    { title: "C", episode: 3 },
    { title: "A", episode: 1 },
    { title: "B", episode: 2 },
  ];
  ok_("ordena pelo numero", normalizarEpisodios(foraDeOrdem).map((e) => e.episodeNumber).join(",") === "1,2,3");

  const sujo = [null, undefined, {}, { title: "   " }, { episode: 1, title: "Um" }];
  const eps = normalizarEpisodios(sujo);
  ok_("atira o que nao e' episodio", eps.length === 1, "ficaram " + eps.length);
  ok_("titulo vazio ou em branco da um nome por numero",
    normalizarEpisodios([{ episode: 7, title: "   " }])?.[0]?.name === "Episódio 7");

  ok_("uma lista que nao e' array da' vazio, nao rebenta", normalizarEpisodios(null).length === 0);
  ok_("uma lista vazia da' vazio", normalizarEpisodios([]).length === 0);
}

console.log("");
console.log("  4) ultimo recurso: o total que o /anime/{id} ja conhece");
{
  // E' o caso do Zan Sayonara Zetsubou Sensei (ID 6377): o /full diz
  // `episodes: 13`, mas o /episodes volta `data: []` porque o titulo nao esta
  // na base do espelho. So o numero interessa: os providers resolvem o
  // episodio pelo numero, nao pelo titulo.
  const eps = episodiosPorNumero(13);
  ok_("gera os 13 episodios", eps.length === 13);
  ok_("numerados de 1 a 13", eps?.[0]?.episodeNumber === 1 && eps?.[12]?.episodeNumber === 13);
  ok_("sem data (nao se sabe)", eps.every((e) => e.aired === null));
  ok_("sem filler/recap", eps.every((e) => !e.filler && !e.recap));
  ok_("o nome segue a convencao do servidor",
    eps?.[2]?.name === normalizarEpisodios([{ episode: 3 }])?.[0]?.name);

  ok_("zero nao gera nada", episodiosPorNumero(0).length === 0);
  ok_("desconhecido nao gera nada", episodiosPorNumero(null).length === 0);
  ok_("lixo nao gera nada", episodiosPorNumero("abc").length === 0);
}

console.log("");
console.log("  5) o agrupamento por temporada aguenta a lista sintetizada");
{
  const uma = groupEpisodesBySeason(episodiosPorNumero(13));
  ok_("uma temporada de 13", uma.length === 1);
  ok_("com os 13 dentro", uma?.[0]?.episodes?.length === 13);
  const duas = groupEpisodesBySeason(episodiosPorNumero(26));
  ok_("26 eps dao 2 temporadas", duas.length === 2);
  ok_("numeradas 1 e 2", duas?.[0]?.seasonNumber === 1 && duas?.[1]?.seasonNumber === 2);
  ok_("e nenhuma fica vazia", duas.every((s) => s?.episodes?.length > 0));
  ok_("os numeros continuam certos na 2a temporada",
    duas?.[1]?.episodes?.[0]?.episodeNumber === 14);
}

console.log("");
console.log("  6) o fallback do frontend nao esta morto (o bug do '0 eps')");
{
  ok_("a pagina do anime nao decide so pelo numero de temporadas",
    /!seasons\.some\(\(s\) => s\.episodes\?\.length\)/.test(DETAILS));
  ok_("e o teste antigo (so pelo comprimento) foi removido",
    !/if \(!seasons\.length\) return fallback\(\)/.test(DETAILS));
  ok_("o fallback ainda existe", /const fallback = \(\) => \{/.test(DETAILS));
  ok_("e usa o `episodeCount` dos detalhes",
    /const n = details\.episodeCount \|\| 12/.test(DETAILS));
}

console.log("");
console.log("  7) higiene");
{
  const alvo = DETAILS + fs.readFileSync(path.join(RAIZ, "server", "src", "services", "jikan.js"), "utf8");
  ok_("sem caracteres CJK", !/[\u2E80-\u9FFF\u3000-\u303F\uFF00-\uFFEF]/.test(alvo));
  ok_("sem caractere de substituicao", !/[\uFFFD]/.test(alvo));
}

console.log("");
console.log("  " + ok + " ok, " + falhou + " falha(s)");
process.exit(falhou ? 1 : 0);