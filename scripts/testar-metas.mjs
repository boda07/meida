// As metas e os desafios de /achievements.
//
// A coisa mais importante que este ficheiro protege nao e' um numero e' uma
// PALAVRA. A biblioteca nao tem "data em que viste" — so' `updated_at`, a ultima
// vez que tocaste. Por isso a meta conta o que MARCASTE COMO VISTO neste ano, e
// nao o que viste. Se um dia alguem mudar a interface para dizer "viste", estes
// testes nao apanham isso (o i18n e' texto livre) — mas apanham o pior: a
// contagem a deixar de excluir os filmes da watchlist, que e' o que tornaria o
// numero uma mentira grande.
//
// PURE: `server/src/metas.js` e `web/src/components/metas.js` nao tocam em base
// de dados nem em React, por isso correm em Node sem arranque nenhum.

import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import {
  ALVO_OMISSAO,
  anoDe,
  decadaDe,
  contaFilmesPorAno,
  contaDecadas,
  estadoDaMeta,
  leMeta,
} from "../server/src/metas.js";
import { anel, circunferencia, anoDaMeta, numeroDoAnel } from "../web/src/components/metas.js";

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

let ok = 0;
let falhou = 0;
function ok_(nome, cond, extra = "") {
  if (cond) { ok++; console.log("  OK    " + nome); }
  else { falhou++; console.log("  FALHA " + nome + (extra ? "  ->  " + extra : "")); }
}

/** Um item de biblioteca como o `listLibrary` devolve. */
const item = (extra = {}) => ({ type: "movie", watched: 1, updatedAt: "2026-05-04T10:00:00.000Z", year: 1975, ...extra });

console.log("");
console.log("  1) anoDe e decadaDe");
{
  ok_("2026-05-04T10:00Z -> 2026", anoDe("2026-05-04T10:00:00.000Z") === 2026);
  ok_("o ISO e' lido em UTC, como o `dayOf` do stats", anoDe("2026-01-01T00:30:00.000Z") === 2026);
  ok_("1975 -> 1970", decadaDe(1975) === 1970);
  ok_("1970 -> 1970", decadaDe(1970) === 1970);
  ok_("2009 -> 2000", decadaDe(2009) === 2000);
  ok_("null nao e' decada", decadaDe(null) === null);
  ok_("ano impossivel e' null, nao 1890 (o `Math.floor` dava qualquer coisa)", decadaDe(3) === null && decadaDe(9999) === null);
  ok_("texto nao e' ano", decadaDe("oi") === null);
  ok_("data invalida da' null em anoDe", anoDe("nao-e-data") === null && anoDe(undefined) === null);
}

console.log("");
console.log("  2) a meta conta o que MARCASTE, e nao o que tocaste");
{
  const linhas = [
    item({ updatedAt: "2026-03-01T12:00:00.000Z" }), // visto, este ano
    item({ updatedAt: "2026-04-01T12:00:00.000Z" }), // visto, este ano
    // O CASO IMPORTANTE: na watchlist, tocado hoje. NAO pode contar, senao
    // "puseram 50 na lista" contaria como "50 filmes vistos".
    item({ watched: 0, watchlist: 1, updatedAt: "2026-05-01T12:00:00.000Z" }),
    // Series e animes tambem nao contam para uma meta que diz "filmes".
    item({ type: "tv", updatedAt: "2026-05-02T12:00:00.000Z" }),
    item({ type: "anime", updatedAt: "2026-05-02T13:00:00.000Z" }),
    // De anos anteriores nao contam para a meta deste ano.
    item({ updatedAt: "2024-07-01T12:00:00.000Z" }),
  ];
  const anos = contaFilmesPorAno(linhas, 2026);
  const este = anos.find((a) => a.ano === 2026);
  ok_("conta so' os 2 filmes marcados vistos deste ano", este.n === 2, "n=" + este.n);
  // Directo, e nao pelo truque do "3 no JSON": o que interessa e' que SOMAR o
  // da watchlist e o da serie nao muda a conta.
  const soVistos = linhas.filter((l) => l.watched === 1 && l.type === "movie" && l.updatedAt.startsWith("2026"));
  ok_("a conta bate com os filmes marcados de 2026, um a um", soVistos.length === este.n, "linhas=" + soVistos.length + " conta=" + este.n);
  ok_("devolve sempre tres anos, por ordem", anos.length === 3 && anos.map((a) => a.ano).join(",") === "2025,2026,2027", anos.map((a) => a.ano).join(","));
  ok_("os anos sem nada vem a 0 e nao em falta", anos.every((a) => typeof a.n === "number"));
  // So' entram tres anos: o de 2024 (quando foi marcado) fica de fora, e por
  // isso e' `undefined` e nao um balde a zero. Uma janela maior nao custaria
  // nada ao utilizador e daria a ilusao de que conta para sempre.
  ok_("um ano marcado fora da janela nao entra", anos.find((a) => a.ano === 2024) === undefined);
}

console.log("");
console.log("  3) o ano e' o da pessoa, e o servidor manda os trespossiveis");
{
  // As 00:30 de 1 de Janeiro em Lisboa: o servidor (UTC) ainda diz ano novo-1.
  const doServidor = contaFilmesPorAno([item({ updatedAt: "2026-01-01T00:30:00.000Z" })], 2025);
  ok_("marcado as 00:30 UTC de 2026 entra em 2026", doServidor.find((a) => a.ano === 2026).n === 1, JSON.stringify(doServidor));
  // O cliente em Lisboa nesse instante esta' em 2026 e acha o balde.
  ok_("e o cliente acha-o com o ano dele", anoDaMeta(doServidor, 2026) === 1);
  ok_("o mesmo servidor, visto do ano anterior, da 0", anoDaMeta(doServidor, 2025) === 0);
  // O cliente nunca pode ficar sem balde: com fuso -12 ou +14 o ano difere no
  // maximo um do do servidor, e a janela de 3 cobre.
  ok_("a janela de 3 anos cobre qualquer fuso", contaFilmesPorAno([], 2026).map((a) => a.ano).join(",") === "2025,2026,2027");
  ok_("anoDaMeta sem lista nao rebenta", anoDaMeta(null, 2026) === 0);
  ok_("anoDaMeta com n invalido e' 0", anoDaMeta([{ ano: 2026, n: "x" }], 2026) === 0);
  ok_("anoDaMeta arredonda e nunca devolve negativo", anoDaMeta([{ ano: 2026, n: -5 }], 2026) === 0);
}

console.log("");
console.log("  4) as decadas");
{
  const linhas = [
    item({ year: 1975 }), item({ year: 1979 }), // 1970: 2
    item({ year: 2011 }), // 2010: 1
    item({ year: null }), // sem ano: nao conta para nenhuma
    item({ year: 1980, watched: 0 }), // nao visto: nao conta
    item({ type: "tv", year: 1955 }), // serie: nao conta
  ];
  const d = contaDecadas(linhas, 2026);
  ok_("as 1970 tem 2", d.cobertas.find((x) => x.decada === 1970)?.n === 2);
  ok_("as 2010 tem 1", d.cobertas.find((x) => x.decada === 2010)?.n === 1);
  ok_("a de 1955 (serie) nao conta", !d.cobertas.some((x) => x.decada === 1950));
  ok_("a de 1980 (nao visto) nao conta", !d.cobertas.some((x) => x.decada === 1980));
  ok_("o sem ano vai para `semAno`, e nao para uma decada qualquer", d.semAno === 1, "semAno=" + d.semAno);
  ok_("`total` e' cobertas + vazias", d.total === d.cobertas.length + d.vazias.length);
  ok_("as vazias vao de 1930 ate a decada corrente", d.vazias.includes(1930) && !d.vazias.includes(2030), d.vazias.slice(-3).join(","));
  ok_("as cobertas NAO estao nas vazias", !d.cobertas.some((x) => d.vazias.includes(x.decada)));
  ok_("1950 esta nas vazias (ninguem viu um filme de la)", d.vazias.includes(1950));
  // 1930..2020 de 10 em 10 = 10 decades. Com 2 cobertas, 8 vazias.
  ok_("o total e' o intervalo completo, nao so o que tens", d.total === 10, "total=" + d.total);
}

console.log("");
console.log("  5) estadoDaMeta e o anel");
{
  const e = estadoDaMeta(32, 50);
  ok_("32 de 50: falta 18", e.falta === 18 && !e.cumprida);
  ok_("o percentual e' 0.64", Math.abs(e.percent - 0.64) < 1e-9, String(e.percent));
  const c = estadoDaMeta(50, 50);
  ok_("50 de 50 esta' cumprida", c.cumprida && c.falta === 0);
  ok_("50 de 50: percentual 1, nunca mais", c.percent === 1);
  // O CASO QUE DAVA UM ANEL AO CONTRARIO: passar o alvo.
  const p = estadoDaMeta(120, 50);
  ok_("120 de 50: o percentual trava em 1", p.percent === 1, String(p.percent));
  ok_("120 de 50: falta 0 e cumprida", p.falta === 0 && p.cumprida);
  ok_("e o numero real continua a ser 120", numeroDoAnel(120, 50) === 120);
  ok_("abaixo do alvo o anel nao mostra numero", numeroDoAnel(32, 50) === 0);
  ok_("alvo 0 nao divide por zero", estadoDaMeta(5, 0).percent === 1);
  ok_("atingidos negativos nao dao percentual negativo", estadoDaMeta(-3, 50).percent === 0);
  ok_("o alvo por omissao e' 50", ALVO_OMISSAO === 50);
  // A geometria.
  ok_("circunferencia de r=10 da' 62.83", Math.abs(circunferencia(10) - 62.831853) < 1e-4);
  ok_("raio invalido da' 0 e nao NaN", circunferencia(0) === 0 && circunferencia(-5) === 0 && circunferencia("x") === 0);
  const g = anel(0.5, 10);
  ok_("o traco e' metade da circunferencia", Math.abs(g.traco - 31.415926) < 1e-3, String(g.traco));
  ok_("o dasharray tem circumference duas vezes", g.d === "62.832 62.832", g.d);
  ok_("a folga e' o que resta", Math.abs(g.folga - 31.415926) < 1e-2, String(g.folga));
  ok_("100% deixa folga 0, sem o `0.9999` que abre um buraco", anel(1, 10).folga === 0);
  ok_("0% deixa folga a circunferencia toda", anel(0, 10).folga > 62);
  ok_("percent acima de 1 NAO da a volta do anel", anel(3, 10).traco === anel(1, 10).traco);
  ok_("percent negativo e' 0", anel(-1, 10).traco === 0);
  ok_("percent NaN nao rebenta", anel(NaN, 10).traco === 0);
}

console.log("");
console.log("  6) a migracao guarda o alvo, e a rota so' aceita o que a lista diz");
{
  const schema = fs.readFileSync(path.join(RAIZ, "server", "src", "db", "schema.js"), "utf8");
  ok_("a migracao 8 existe", /version:\s*8/.test(schema) && /name:\s*"metas-do-utilizador"/.test(schema));
  ok_("e cria a coluna `meta` na tabela dos utilizadores", /ALTER TABLE users ADD COLUMN meta TEXT/.test(schema));

  const rota = fs.readFileSync(path.join(RAIZ, "server", "src", "routes", "goals.js"), "utf8");
  const lista = (rota.match(/const ALVOS = \[([^\]]+)\]/) || [])[1] || "";
  const alvos = lista.split(",").map((x) => Number(x.trim())).filter((n) => Number.isInteger(n));
  ok_("a lista de alvos tem numeros inteiros", alvos.length > 0 && alvos.every(Number.isInteger), lista);
  ok_("o omissao esta' na lista (senao nunca se podia voltar a ele)", alvos.includes(ALVO_OMISSAO), lista);
  ok_("um alvo fora da lista da 400 e nao e' gravado", /if \(!ALVOS\.includes\(alvo\)\)/.test(rota) && /status\(400\)/.test(rota));
  ok_("um alvo guardado fora da lista cai no omissao ao ler", /ALVOS\.includes\(guardado\) \? guardado : ALVO_OMISSAO/.test(rota));
  // O `setMeta` junta; se substituir, a proxima preferencia a aparecer apaga esta.
  const store = fs.readFileSync(path.join(RAIZ, "server", "src", "store.js"), "utf8");
  ok_("`setMeta` junta ao que la esta (nao substitui)", /const novo = \{ \.\.\.atual, \.\.\./.test(store));

  // **O verbo tem de bater certo com o do cliente, e este teste nasceu de um
  //   bug real.** O `patch_` de `api/client.js` manda PATCH; a rota era PUT e o
  //   servidor respondia 404. O `handle()` do cliente rebentava, o `catch`
  //   escrevia a mensagem de erro e a SECCAO DAS METAS DESAPARECIA da pagina.
  //   Nenhum teste apanhava: cada lado estava "certo" sozinho. E' o que se
  //   verifica aqui e' a concordancia entre os dois ficheiros.
  const cliente = fs.readFileSync(path.join(RAIZ, "web", "src", "api", "client.js"), "utf8");
  // Compara-se o VERBO HTTP, nao o nome do helper. `patch_` (o nome no cliente)
  // e `patch` (o metodo do Express) nao sao a mesma coisa — e comparar os dois
  // nomes foi o primeiro erro deste teste, que dava FALHA com o codigo certo.
  const metodoHttp = (cliente.match(/async function patch_[\s\S]*?method: "(\w+)"/) || [])[1];
  // Todos os verbos da rota, e nao so o primeiro: `get` aparece antes de
  // `patch`, e ficar com o primeiro dava "rota=get" com o codigo certo.
  const verbosDaRota = [...rota.matchAll(/goalsRouter\.(\w+)\("/g)].map((x) => x[1]);
  const esperado = String(metodoHttp || "").toLowerCase();
  ok_("o cliente tem `setGoal`", /setGoal:/.test(cliente));
  ok_("o helper do cliente manda PATCH", metodoHttp === "PATCH", "achou: " + metodoHttp);
  ok_("a rota usa ESSE verbo", verbosDaRota.includes(esperado), "cliente=" + metodoHttp + " rota=" + verbosDaRota.join(","));
  ok_("e tem GET para a leitura", verbosDaRota.includes("get"));
  ok_("a rota nao tem nenhum PUT (o 404 silencioso)", !/goalsRouter\.put\(/.test(rota));
  // O `handle()` do cliente lanca em erro: se a resposta nao for 2xx, a seccao
  //   fica sem dados. Por isso a UI tem de mostrar o erro E nao desaparecer.
  ok_("a UI mostra a mensagem quando o PUT/PATCH falha", /setErro\(t\("Não consegui guardar a meta\."\)\)/.test(fs.readFileSync(path.join(RAIZ, "web", "src", "components", "MetasDesafios.jsx"), "utf8")));
}

console.log("");
console.log("");
console.log("  7) a interface diz \"marcaste\", e o dicionario diz tambem");
{
  const jsx = fs.readFileSync(path.join(RAIZ, "web", "src", "components", "MetasDesafios.jsx"), "utf8");
  const dicionario = fs.readFileSync(path.join(RAIZ, "web", "src", "i18n", "traducoes.js"), "utf8");
  const anelJsx = fs.readFileSync(path.join(RAIZ, "web", "src", "components", "AnelMeta.jsx"), "utf8");

  // Tira os comentarios antes de procurar codigo. O comentario do `AnelMeta`
  // CITA o `rotate(-90 ...)` para explicar o porque — e sem isto o teste
  // "apanhava" a mutacao que o apaga, porque lia o comentario e nao o codigo.
  // Ja aconteceu duas vezes nesta sessao: com a regra dos rotulos dos
  // graficos (que citava `i % 2 === 1`) e agora aqui.
  const soCodigo = (txt) =>
    txt
      .split(/\r?\n/)
      .filter((x) => !/^\s*(\/\/|\/\*|\*)/.test(x))
      .join("\n");
  const anelCodigo = soCodigo(anelJsx);

  // O numero e' aproximado e a interface tem de o dizer.
  ok_("o titulo da meta diz \"Marcaste ... como vistos\"", /Marcaste \{n\} de \{a\} filmes como vistos em \{ano\}\./.test(jsx));

  // **A verificacao que faltava de verdade:** o que o DICIONARIO diz. A
  // versao anterior so via o JSX, e o JSX nao muda quando o dicionario muda —
  // por isso a mutacao "Viste em vez de Marcaste" passou com 0 falhas.
  const chave = "Marcaste {n} de {a} filmes como vistos em {ano}.";
  const re = new RegExp('"' + chave.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + '":\\s*\\n?\\s*"([^"]*)"');
  const entrada = dicionario.match(re);
  ok_("a entrada existe no dicionario", entrada !== null);
  ok_("e em pt continua a dizer MARCASTE", entrada !== null && entrada[1].startsWith("Marcaste "), entrada && entrada[1]);
  ok_("e em pt NAO diz \"Viste\", que seria mentira", entrada !== null && !/^Viste\b/.test(entrada[1]), entrada && entrada[1]);
  ok_("a traducao inglesa diz \"marked\", nao \"watched\"", /"Marcaste \{n\} de \{a\} filmes como vistos em \{ano\}\.":\s*\n?\s*"You marked \{n\} of \{a\} films as watched in \{ano\}\."/.test(dicionario));
  ok_("ha a nota a explicar que o que esta' na lista nao conta", /o que puseste na lista não conta/.test(jsx));
  ok_("e a nota explica o que e' a data contada", /Conta a última vez que tocaste em cada filme/.test(jsx));

  // A lista de alvos vem do servidor: escrever os numeros no JSX faria aparecer
  // um botao que o servidor recusa com 400.
  ok_("os botoes de alvo vem da resposta do servidor", /dados\.alvos \|\| \[\]/.test(jsx));
  ok_("nao ha numeros de alvo escritos a mao no JSX", !/ALVOS|\[\s*10,\s*25,\s*50/.test(jsx));
  ok_("o ano vem do relogio do cliente", /new Date\(\)\.getFullYear\(\)/.test(jsx));

  ok_("o anel e' um SVG com width E height (sem os dois fica 0x0)", /width=\{tam\}[\s\S]{0,40}height=\{tam\}/.test(anelCodigo));
  ok_("o anel roda -90 para comecar as 12 horas", /rotate\(-90/.test(anelCodigo));
  ok_("e o arco so' se desenha acima de 0 (a ponta redonda deixaria um bocado)", /geo\.traco > 0 &&/.test(anelCodigo));
  ok_("e tem aria-label com o numero, para o leitor de ecra", /aria-label=\{descricao\}/.test(anelCodigo));
}

console.log("");
console.log("  8) um `meta` corrompido da objeto vazio em vez de rebentar");
{
  // Este `try/catch` estava dentro do `store.js`, e o `store.js` nao se pode
  // importar num teste sem arrancar a base de dados. Por isso nao havia
  // NENHUMA verificacao a apanhar uma mutacao dele: mudar so' o `return {}`
  // passava com 0 falhas. O parse foi para `metas.js`, que e' puro, e agora
  // corre em Node sem nada mais.
  ok_("um JSON valido devolve o objeto", JSON.stringify(leMeta('{"alvoFilmes":25}')) === '{"alvoFilmes":25}');
  ok_("NULL devolve {} (nunca se guardou nada)", JSON.stringify(leMeta(null)) === "{}");
  ok_("texto partido nao rebenta", JSON.stringify(leMeta("{isto nao e json")) === "{}");
  ok_("uma lista nao serve de preferencias", JSON.stringify(leMeta("[1,2]")) === "{}");
  ok_("um numero nao serve de preferencias", JSON.stringify(leMeta("7")) === "{}");
  ok_("um `null` escrito na coluna nao serve", JSON.stringify(leMeta("null")) === "{}");
  ok_("e o `store.js` usa essa funcao em vez de um parse proprio", /return leMeta\(r && r\.meta\)/.test(fs.readFileSync(path.join(RAIZ, "server", "src", "store.js"), "utf8")));
}

console.log("  " + ok + " ok, " + falhou + " falha(s)");
process.exit(falhou ? 1 : 0);