// A timeline da biblioteca: o agrupamento cronologico e — o mais importante —
// a distincao entre "data de visionamento" e "ultima vez que tocaste".
//
// PURE: `web/src/components/timeline.js` nao toca em React nem em DOM.
//
// ---------------------------------------------------------------------------------
// A ASSERCAO CENTRAL DESTE FICHEIRO
// ---------------------------------------------------------------------------------
// **A timeline NUNCA usa o `updatedAt` como se fosse a data de visionamento.**
//
// O `updatedAt` e' a ultima vez que tocaste na linha. Dar nota, mudar o estado ou
// reordenar a lista escreve nele. Um filme que viste em Janeiro e a que deste
// nota em Marco aparece em Marco numa timeline construida assim — e nao ha nada
// que diga a quem olha que a data esta' errada.
//
// Por isso: `watchedAt` quando existe, e quando nao existe o item vai para um
// grupo "sem data", separado e no fim. Nao se cai no `updatedAt` "para nao perder
// nada": perde-se a data, que e' o que se nao sabe, e diz-se.
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import {
  dataDaTimeline,
  diaDe,
  mesDe,
  rotuloDoMes,
  maisRecentePrimeiro,
  gruposDaTimeline,
  quantosSemData,
} from "../web/src/components/timeline.js";

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

let ok = 0;
let falhou = 0;
function ok_(nome, cond, extra = "") {
  if (cond) { ok++; console.log("  OK    " + nome); }
  else { falhou++; console.log("  FALHA " + nome + (extra ? "  ->  " + extra : "")); }
}

const visto = (extra) => ({ watched: 1, type: "movie", watchedAt: null, updatedAt: null, ...extra });

console.log("");
console.log("  1) dataDaTimeline: exacta quando ha `watchedAt`, e NUNCA o updatedAt");
{
  ok_("com watchedAt, a data e' essa", dataDaTimeline(visto({ watchedAt: "2026-03-04T20:00:00.000Z" })).data === "2026-03-04T20:00:00.000Z");
  ok_("e e' exacta", dataDaTimeline(visto({ watchedAt: "2026-03-04T20:00:00.000Z" })).exata === true);

  // **O caso que este ficheiro existe para proteger.**
  const semData = dataDaTimeline({ watchedAt: null, updatedAt: "2026-07-19T10:00:00.000Z" });
  ok_("sem watchedAt, NAO devolve o updatedAt", semData.data === null, "devolveu " + semData.data);
  ok_("e diz que nao e' exacta", semData.exata === false);

  ok_("sem watchedAt mas com updatedAt, continua a nao saber", dataDaTimeline({ updatedAt: "2026-07-19T10:00:00.000Z" }).data === null);
  ok_("um item vazio nao rebenta", dataDaTimeline(null).data === null && dataDaTimeline(undefined).data === null);
  ok_("um watchedAt vazio (string vazia) conta como nao saber", dataDaTimeline({ watchedAt: "", updatedAt: "2026-01-01T00:00:00.000Z" }).data === null);
}

console.log("");
console.log("  2) diaDe e mesDe");
{
  ok_("o ISO vem em YYYY-MM-DD (UTC)", diaDe("2026-03-04T20:00:00.000Z") === "2026-03-04");
  ok_("e nao em UTC-1, que virava dia 3", diaDe("2026-03-04T23:30:00.000Z") === "2026-03-04");
  ok_("meia-noite UTC e' o dia 4", diaDe("2026-03-04T00:00:00.000Z") === "2026-03-04");
  ok_("o dia 1 as 00:30 UTC NAO vira dia 31 do mes anterior", diaDe("2026-03-01T00:30:00.000Z") === "2026-03-01");
  ok_("uma data invalida da' null", diaDe("nao-e-data") === null && diaDe(undefined) === null);
  const m = mesDe("2026-03-04T10:00:00.000Z");
  ok_("ano e mes saem certainos", m.ano === 2026 && m.mes === 3);
  ok_("um dia sem data nao da' mes", mesDe(null) === null);
}

console.log("");
console.log("  3) rotuloDoMes");
{
  ok_("marco de 2026", rotuloDoMes(2026, 3) === "março de 2026", rotuloDoMes(2026, 3));
  ok_("dezembro de 1999", rotuloDoMes(1999, 12) === "dezembro de 1999");
  ok_("janeiro de 2026", rotuloDoMes(2026, 1) === "janeiro de 2026");
  ok_("mes 13 da' null", rotuloDoMes(2026, 13) === null);
  ok_("mes 0 da' null", rotuloDoMes(2026, 0) === null);
  ok_("ano que nao e' inteiro da' null", rotuloDoMes(2026.5, 3) === null);
}

console.log("");
console.log("  4) a ordem: do mais recente para o mais antigo");
{
  // NEGATIVO = "a" primeiro. E' o que o Array.prototype.sort espera, e a funcao
  // so' e' usada la dentro; inverter o sinal daria a lista do avesso sem erro
  // nenhum. Escrevi a primeira versao destas linhas como se fosse uma
  // desigualdade ("a e' mais recente que b"), que e' a leitura natural do nome.
  ok_("marco (recente) fica ANTES de janeiro", maisRecentePrimeiro("2026-03-04", "2026-01-01") < 0);
  ok_("e o inverso tambem", maisRecentePrimeiro("2026-01-01", "2026-03-04") > 0);
  ok_("o mesmo dia da' 0", maisRecentePrimeiro("2026-03-04", "2026-03-04") === 0);
  ok_("anos diferentes: o mais recente primeiro", maisRecentePrimeiro("2026-12-31", "2025-01-01") < 0);
  // O contrato verificado pelo RESULTADO, nao pelo sinal: e' o que o sort
  // precisa mesmo de estar certo.
  const lista = [{ d: "2026-01-01" }, { d: "2026-12-31" }, { d: "2026-06-15" }];
  const porCima = [...lista].sort((x, y) => maisRecentePrimeiro(x.d, y.d)).map((x) => x.d).join(",");
  ok_("ordenado pelo comparador, fica do mais novo ao mais velho", porCima === "2026-12-31,2026-06-15,2026-01-01", porCima);
  ok_("sem data vai para o FIM, nao para o meio", maisRecentePrimeiro(null, "2026-01-01") > 0);
  ok_("com data vem antes de sem data", maisRecentePrimeiro("1999-01-01", null) < 0);
  ok_("dois sem data da' 0 (entre si sao iguais)", maisRecentePrimeiro(null, null) === 0);
}

console.log("");
console.log("  5) os grupos: por mes, e o \"sem data\" SEPARADO no fim");
{
  const itens = [
    visto({ tmdbId: 1, watchedAt: "2026-03-04T10:00:00.000Z" }),
    visto({ tmdbId: 2, watchedAt: "2026-03-20T10:00:00.000Z" }),
    visto({ tmdbId: 3, watchedAt: "2026-01-05T10:00:00.000Z" }),
    visto({ tmdbId: 4, watchedAt: "2025-12-31T10:00:00.000Z" }),
    visto({ tmdbId: 5, watchedAt: null }),
    visto({ tmdbId: 6, watchedAt: null }),
  ];
  const g = gruposDaTimeline(itens);
  // QUATRO grupos, nao tres: marco/2026, janeiro/2026, dezembro/2025 e o sem
  // data. Escrevi "tres" a contar e esqueci o de dezembro.
  ok_("quatro grupos: marco, janeiro, dezembro e o sem data", g.length === 4, "n=" + g.length);
  ok_("o mais recente primeiro", g[0].chave === "2026-03" && g[1].chave === "2026-01", g.map((x) => x.chave).join(","));
  ok_("dezembro de 2025 e' o seu proprio mes", g.some((x) => x.chave === "2025-12"));
  ok_("marco tem 2", g[0].itens.length === 2);
  ok_("o rotulo de marco esta' la", g[0].rotulo === "março de 2026", g[0].rotulo);

  const semData = g[g.length - 1];
  ok_("o ultimo grupo e' o sem data", semData.chave === "sem-data" && semData.comData === false);
  ok_("e tem os 2", semData.itens.length === 2);
  ok_("e NAO tem rotulo de mes", semData.rotulo === null);
  ok_("e nao aparece com data nenhuma", semData.itens.every((i) => !i.watchedAt));

  ok_("nada se perde: 3 + 1 + 2 = 6", g.reduce((a, x) => a + x.itens.length, 0) === itens.length);
  ok_("sem nada nao da' grupos", gruposDaTimeline([]).length === 0);
  ok_("null nao rebenta", gruposDaTimeline(null).length === 0);
  ok_("so' sem data da' um grupo", gruposDaTimeline([visto({ tmdbId: 1, watchedAt: null })]).length === 1);
}

console.log("");
console.log("  6) quantosSemData: o numero que diz o quanto a timeline nao sabe");
{
  const itens = [visto({ tmdbId: 1, watchedAt: "2026-03-04T10:00:00.000Z" }), visto({ tmdbId: 2 }), visto({ tmdbId: 3 })];
  ok_("2 de 3 nao tem data", quantosSemData(itens) === 2);
  ok_("tudo com data da' 0", quantosSemData([visto({ watchedAt: "2026-03-04T10:00:00.000Z" })]) === 0);
  ok_("lista vazia da' 0", quantosSemData([]) === 0 && quantosSemData(null) === 0);
  // E' o mesmo numero que o grupo "sem data" — se divergirem, a nota da UI
  // ("N dos teus titulos…") deixa de bater com o que se ve.
  //
  // **Com guarda.** A versao anterior fazia `.find(...)` e desreferenciava logo:
  // com o grupo marcado como tendo data, o `find` dava `undefined` e o teste
  // rebentava com "Cannot read properties of undefined" em vez de FALHAR. Num
  // run de mutacoes isso e' pior do que nao testar nada — uma regra partida
  // parava a corrida em vez de mostrar a quebra.
  const achado = gruposDaTimeline(itens).find((g) => !g.comData);
  ok_("existe um grupo sem data", !!achado);
  ok_("bate certo com a contagem", !!achado && achado.itens.length === quantosSemData(itens));
}

console.log("");
console.log("  7) a migracao 9 e a regra de escrita");
{
  const schema = fs.readFileSync(path.join(RAIZ, "server", "src", "db", "schema.js"), "utf8");
  ok_("a migracao 9 existe", /version:\s*9/.test(schema) && /name:\s*"data-de-visionamento"/.test(schema));
  ok_("e cria `watched_at` na biblioteca", /ALTER TABLE library ADD COLUMN watched_at TEXT/.test(schema));
  // **O que a migracao NAO faz:** preencher com `updated_at`. Seria dar a data
  // do ultimo toque a tudo o que ja estava visto, e a timeline apareceria com
  // meses e anos errados sem ninguem ter como saber.
  ok_("e NAO preenche com updated_at", !/UPDATE library SET watched_at/.test(schema));

  const store = fs.readFileSync(path.join(RAIZ, "server", "src", "store.js"), "utf8");
  const upsert = store.slice(store.indexOf("export function upsertLibrary("), store.indexOf("export function upsertLibrarySafe("));
  const seguro = store.slice(store.indexOf("export function upsertLibrarySafe("));

  ok_("o `upsertLibrary` tem a regra dos tres casos", /WHEN excluded\.watched = 0 THEN NULL/.test(upsert) && /WHEN library\.watched = 0 THEN excluded\.updated_at/.test(upsert));
  // O erro mais facil de cometer: um COALESCE simples trataria "marcar como
  // visto" e "dar nota a um filme visto" do mesmo jeito, e a segunda escreveria
  // NULL por cima da data, apagando-a.
  ok_("e um CASE, nao um COALESCE (que apagaria a data ao dar nota)", /watched_at\s+= CASE/.test(upsert) && !/watched_at\s+= COALESCE/.test(upsert));
  ok_("o `ELSE` mantem a data antiga", /ELSE library\.watched_at/.test(upsert));
  ok_("e o import NAO usa essa regra (restaurar ficheiro != marcar agora)", /watched_at\s+= COALESCE\(excluded\.watched_at, library\.watched_at\)/.test(seguro));
  ok_("e o import nao fabrica datas: sem data no ficheiro fica NULL", /entry\.watchedAt \?\? null/.test(seguro));

  ok_("`toApi` expoe `watchedAt`", /watchedAt: r\.watched_at \?\? null/.test(store));
  ok_("e exporta `toApi` (o `statsFor` precisa dele)", /export function toApi\(/.test(store));

  // O export/import tem de levar a data, senao nao volta de um PC para o outro.
  const exportJs = fs.readFileSync(path.join(RAIZ, "server", "src", "routes", "export.js"), "utf8");
  const settings = fs.readFileSync(path.join(RAIZ, "web", "src", "pages", "Settings.jsx"), "utf8");
  ok_("o CSV de export escreve `visto_em`", /"visto_em"/.test(settings));
  ok_("e escreve o watchedAt, nunca o updatedAt", /i\.watchedAt \|\| ""/.test(settings));
  ok_("o import de CSV le `visto_em`", /watchedAt: o\.visto_em \|\| null/.test(exportJs));
  ok_("e NUNCA usa `atualizado_em` para a data de visionamento", !/watchedAt: o\.atualizado_em/.test(exportJs));
}

console.log("");
console.log("  8) a vista esta ligada, e nao mexe na ordenacao");
{
  const lib = fs.readFileSync(path.join(RAIZ, "web", "src", "pages", "Library.jsx"), "utf8");
  ok_("importa o Timeline", /import Timeline from "\.\.\/components\/Timeline\.jsx"/.test(lib));
  ok_("tem o estado da vista", /const \[vista, setVista\] = useState\("grade"\)/.test(lib));
  ok_("e o botao que troca entre as duas", /setVista\(\(v\) => \(v === "grade" \? "timeline" : "grade"\)\)/.test(lib));
  ok_("e o aria-pressed, que e' o que diz a um leitor de ecra o estado", /aria-pressed=\{vista === "timeline"\}/.test(lib));
  // O `Timeline` recebe a lista JA filtrada, nunca a que sai do `sort`.
  ok_("passa `shown` (filtrada), nao `paged`", /<Timeline[\s\S]{0,160}itens=\{shown\}/.test(lib));
  ok_("e nao passa o `sort` (a timeline e' sempre cronologica)", !/<Timeline[\s\S]{0,220}sort=/.test(lib));

  const css = fs.readFileSync(path.join(RAIZ, "web", "src", "styles.css"), "utf8");
  ok_("a linha vertical do cronologico existe", /\.tl-grupo::before \{[^}]*width: 2px/.test(css));
  ok_("e o ponto de cada mes", /\.tl-mes::before \{[^}]*border-radius: 50%/.test(css));
  // O ponto do "sem data" nao pode existir: dava a ler um mes que nao la esta.
  ok_("o grupo sem data NAO tem ponto", /\.tl-grupo-sem-data \.tl-mes::before \{[^}]*display: none/.test(css));
  ok_("e a sua linha e' mais fraca", /\.tl-grupo-sem-data::before \{[^}]*background: #1c1c21/.test(css));
  ok_("o botao da vista tem area de toque", /\.lib-vista \{[^}]*min-height: 34px/.test(css));
  // `color: var(--accent)` em texto foi o bug de contraste da 1.5.x.
  ok_("a nota do titulo usa `--accent-text`, nao o acento inteiro", /--accent-text/.test(css));
}

console.log("");
console.log("  9) os ficheiros do servidor ainda ABREM");
{
  const { spawnSync } = await import("node:child_process");
  for (const partes of [["server", "src", "store.js"], ["server", "src", "db", "schema.js"], ["server", "src", "routes", "export.js"]]) {
    const r = spawnSync(process.execPath, ["--check", path.join(RAIZ, ...partes)], { encoding: "utf8" });
    const primeira = ((r.stderr || "").split("\n").find((x) => x.includes("Error")) || "").trim().slice(0, 70);
    ok_("`" + partes.join("/") + "` faz parse", r.status === 0, "exit=" + r.status + (primeira ? " — " + primeira : ""));
  }
}

console.log("");
console.log("  " + ok + " ok, " + falhou + " falha(s)");
process.exit(falhou ? 1 : 0);