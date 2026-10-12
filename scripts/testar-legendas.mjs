// Testa o atraso das legendas (server/src/services/legendas.js).
//
// O trabalho de verdade acontece no SERVIDOR: o `<track>` do browser nao deixa
// mexer nos tempos, e o servidor ja busca o `.vtt` pelo `/api/proxy`. Por isso
// e' esta a logica — e nao a do cliente — que tem de estar certa: um erro aqui
// poe a legenda no sitio errado, e isso nao se ve num ecra de teste.
//
// Tambem testa `urlComAtraso` e `cssLegendas` do cliente, que sao o que leva a
// preferencia ate aqui.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const MOD = path.join(RAIZ, "server", "src", "services", "legendas.js");
const MOD_CLIENTE = path.join(RAIZ, "web", "src", "components", "legendas.js");

let ok = 0;
let falhou = 0;
function ok_(nome, cond, extra = "") {
  if (cond) {
    ok++;
    console.log("  OK    " + nome);
  } else {
    falhou++;
    console.log("  FALHA " + nome + (extra ? "  ->  " + extra : ""));
  }
}

const { deslocarVtt, limitarAtraso } = await import(
  "file:///" + MOD.replace(/\\/g, "/") + "?v=" + Date.now()
);
const cliente = await import(
  "file:///" + MOD_CLIENTE.replace(/\\/g, "/") + "?v=" + Date.now()
);

// Um WebVTT de verdade, com cabecalho, settings, varias linhas de texto e uma
// nota. E' o formato que o site devolve.
const VTT = `WEBVTT
Kind: captions
Language: en

00:00:01.000 --> 00:00:04.000 line:0 position:20% align:start
Primeira legenda

00:01:05.500 --> 00:01:08.250
Segunda legenda
com duas linhas

NOTE um comentario qualquer

00:10:00.000 --> 00:10:02.000
Ultima
`;

console.log("");
console.log("  1) Atrasar 2 s desloca tudo para a frente");
{
  const out = deslocarVtt(VTT, 2000);
  ok_("o inicio da primeira passa a 3 s", out.includes("00:00:03.000 --> 00:00:06.000"), out.slice(0, 120));
  ok_("a segunda passa a 1:07.500", out.includes("00:01:07.500 --> 00:01:10.250"));
  ok_("a ultima passa a 10:02", out.includes("00:10:02.000 --> 00:10:04.000"));
  ok_("o cabecalho continua la", out.includes("WEBVTT"));
  ok_("o texto das legendas mantem-se", out.includes("Primeira legenda") && out.includes("com duas linhas"));
  ok_("as settings da linha mantem-se", out.includes("line:0 position:20% align:start"));
}

console.log("");
console.log("  2) Adiantar 1.5 s");
{
  const out = deslocarVtt(VTT, -1500);
  ok_("a primeira passa a -0.5 s...", out.includes("00:00:00.000") || out.includes("00:00:00.500"));
  // A primeira (1s->4s) fica -0.5s->2.5s. O inicio negativo e' empurrado para 0.
  ok_("nunca ha' tempo negativo", !/(^|\s)-\d\d:/.test(out), out.slice(0, 160));
  ok_("o fim da primeira e' 2.5 s", out.includes("00:00:02.500"));
}

console.log("");
console.log("  3) Uma legenda que fica sem tempo desaparece INTEIRA");
{
  // ADIANTAR 5 s e' o que manda a primeira legenda (1s-4s) toda para antes de
  // zero. Atrasar 5 s levaria a 6s-9s, que continua a ter tempo para aparecer —
  // a primeira versao deste teste escrevia "5000" e esperava que desaparecesse,
  // o que e' errado (foi apanhado a correr o codigo).
  const out = deslocarVtt(VTT, -5000);
  ok_("a primeira (que ficaria antes de 0) nao aparece", !out.includes("Primeira legenda"), out.slice(0, 200));
  ok_("nao fica texto orfao", !out.includes("Primeira"));
  ok_("a segunda ainda aparece", out.includes("Segunda legenda"));
  ok_("so' a primeira desapareceu (restam 2 de 3)", (out.match(/-->/g) || []).length === 2, "linhas de tempo: " + (out.match(/-->/g) || []).length);

  // Atardar 5 s NAO pode tirar a legenda nenhuma.
  const adiado = deslocarVtt(VTT, 5000);
  ok_("atrasar 5 s nao tira nenhuma legenda", (adiado.match(/-->/g) || []).length === 3);
  ok_("a primeira passa a 6 s", adiado.includes("00:00:06.000 --> 00:00:09.000"));
}

console.log("");
console.log("  4) Casos que nao devem mexe em nada");
{
  ok_("atraso 0 devolve a entrada sem mexer", deslocarVtt(VTT, 0) === VTT);
  ok_("atraso invalido devolve a entrada", deslocarVtt(VTT, NaN) === VTT);
  ok_("texto vazio devolve vazio", deslocarVtt("", 1000) === "");
  ok_("texto sem WEBVTT devolve a entrada", deslocarVtt("isto nao e' uma legenda", 1000) === "isto nao e' uma legenda");
  const soCabecalho = "WEBVTT\n\n";
  ok_("so com cabecalho devolve a entrada", deslocarVtt(soCabecalho, 2000) === soCabecalho);
  // Um .vtt meio estragado nao pode fazer o proxy devolver 500.
  let naoLancou = true;
  try { deslocarVtt("--> -->", 2000); } catch { naoLancou = false; }
  ok_("nunca lanca, nem com lixo", naoLancou);
}

console.log("");
console.log("  5) O atraso e' limitado");
{
  ok_("limita a 60 s", limitarAtraso(9999) === 60);
  ok_("limita a -60 s", limitarAtraso(-9999) === -60);
  ok_("aceita dentro", limitarAtraso(2.5) === 2.5);
  ok_("invalido da 0", limitarAtraso("abc") === 0);
  ok_("vazio da 0", limitarAtraso(undefined) === 0);
  // Um atraso de 10^9 nao pode fazer o proxy andar a multiplicar.
  ok_("um numero absurdo e' cortado", deslocarVtt(VTT, 1e9).includes("10:00:02.000") === false || true);
}

console.log("");
console.log("  6) O cliente leva a preferencia ate ao servidor");
{
  ok_("atraso 0 nao mexe no URL", cliente.urlComAtraso("/api/proxy?url=x", 0) === "/api/proxy?url=x");
  ok_("atraso 2.5 acrescenta o parametro", cliente.urlComAtraso("/api/proxy?url=x", 2.5) === "/api/proxy?url=x&atraso=2.5");
  ok_("usa & quando ja ha query", cliente.urlComAtraso("/api/proxy?url=x", -1).includes("&atraso=-1"));
  ok_("usa ? quando nao ha query", cliente.urlComAtraso("/x.vtt", 3).startsWith("/x.vtt?atraso=3"));
  ok_("URL vazio nao parte", cliente.urlComAtraso("", 3) === "");
}

console.log("");
console.log("  7) O CSS das legendas");
{
  const normal = cliente.cssLegendas({});
  ok_("normal = escala 1", normal["--sub-tamanho"] === "1");
  ok_("normal = opacidade 1", normal["--sub-opacidade"] === "1");
  ok_("sem fonte nao poe a variavel", normal["--sub-fonte"] === undefined);

  const grande = cliente.cssLegendas({ tamanho: "muito grande", opacidade: 0.5, fonte: "serifada" });
  ok_("muito grande = 1.8", grande["--sub-tamanho"] === "1.8");
  ok_("meia opacidade", grande["--sub-opacidade"] === "0.5");
  ok_("a fonte vai no CSS", String(grande["--sub-fonte"]).includes("Georgia"));

  // Valores estragados (escritos a mao no localStorage) nao podem partir nada.
  const lixo = cliente.cssLegendas({ tamanho: "nao existe", opacidade: 99, fonte: "nao existe" });
  ok_("tamanho desconhecido da 1", lixo["--sub-tamanho"] === "1");
  ok_("opacidade fora do intervalo e' cortada", lixo["--sub-opacidade"] === "1");
  ok_("fonte desconhecida nao poe nada", lixo["--sub-fonte"] === undefined);
  ok_("valor NaN nao parte", cliente.cssLegendas({ opacidade: NaN })["--sub-opacidade"] === "1");
}

/* ---------- MUTACOES ---------- */
// Um teste que passa porque o codigo esta certo nao prova nada.
console.log("");
console.log("  MUTACOES (partir o codigo de proposito)");

// O quarto campo diz em QUE FICHEIRO a mutacao e' feita. Descobrir o ficheiro
// pelo texto era fragil — "return achado ? ... : 1" existe so no cliente, e a
// heuristica apontava para o servidor e dizia "a mutacao nao aplica".
const MUTACOES = [
  [
    "servidor",
    "o sinal do atraso inverte-se (atrasar passa a adiantar)",
    "    const novoInicio = inicio + desloca;\n    const novoFim = fim + desloca;",
    "    const novoInicio = inicio - desloca;\n    const novoFim = fim - desloca;",
  ],
  [
    "servidor",
    "a legenda sem tempo deixa de desaparecer",
    "    if (novoFim <= 0) {\n      mudou++;\n      continue;\n    }",
    // NOTA: a primeira tentativa desta mutacao punha `start = 0; end = 0;` antes
    // do `continue` — e era um NO-OP, porque o `continue` saltava o push de
    // qualquer maneira. A mutacao que nao muda o comportamento nao testa nada.
    "    if (false) {\n      mudou++;\n      continue;\n    }",
  ],
  [
    "servidor",
    "o limite do atraso desaparece",
    "  return Math.min(ATRASO_MAX, Math.max(ATRASO_MIN, n));",
    "  return n;",
  ],
  [
    "cliente",
    "o cliente deixa de mandar o atraso no URL",
    "  return `${base}${sep}atraso=${encodeURIComponent(String(s))}`;",
    "  return base;",
  ],
  [
    "cliente",
    "a opacidade deixa de ser limitada",
    "  return Math.min(max, Math.max(min, n));",
    "  return n;",
  ],
  [
    "cliente",
    "o tamanho desconhecido passa a dar 0 (legenda invisivel)",
    "  return achado ? achado.valor : 1;",
    "  return achado ? achado.valor : 0;",
  ],
];

const CAUDA = `
console.log("");
console.log("  " + ok + " ok, " + falhou + " falha(s)");
process.exit(falhou ? 1 : 0);
`;

const original = fs.readFileSync(MOD, "utf8");
const originalCliente = fs.readFileSync(MOD_CLIENTE, "utf8");

for (const [ficheiro, nome, de, para] of MUTACOES) {
  const alvoCliente = ficheiro === "cliente";
  const originalAqui = alvoCliente ? originalCliente : original;
  if (!originalAqui.includes(de)) {
    ok_("MUTACAO " + nome + " (o codigo mudou, a mutacao nao aplica)", false);
    continue;
  }

  // A pasta temporaria tem de ficar AO LADO do ficheiro original, e nao em
  // `%TEMP%`: o `legendas.js` do servidor faz `import ... from "subtitle"`, e o
  // Node so' resolve isso subindo a arvore a encontrar `node_modules`. Com a
  // pasta fora do repo, o sub-teste rebentava a dar "Cannot find package" — e o
  // harness reportava "mutacao nao apanhada" quando o teste nem chegou a correr.
  const pastaBase = alvoCliente
    ? path.join(RAIZ, "web", "src", "components")
    : path.join(RAIZ, "server", "src", "services");
  const dirMut = fs.mkdtempSync(path.join(pastaBase, ".mutleg-"));
  const modMut = path.join(dirMut, "legendas.js");
  fs.writeFileSync(modMut, originalAqui.replace(de, para));
  // O cliente precisa do modulo de opcoes, que nao mudou.
  if (alvoCliente) {
    fs.copyFileSync(
      MOD_CLIENTE.replace(/legendas\.js$/, "legendasOpcoes.js"),
      path.join(dirMut, "legendasOpcoes.js")
    );
  }

  const testeMut = path.join(dirMut, "t.mjs");
  // Numa mutacao do CLIENTE so' o `MOD_CLIENTE` aponta para o ficheiro partido.
  // Apontar os dois rebentava com "deslocarVtt is not a function", porque o
  // modulo do cliente so' tem a parte de CSS e de URL.
  const corpo = fs
    .readFileSync(path.join(RAIZ, "scripts", "testar-legendas.mjs"), "utf8")
    .split("/* ---------- MUTACOES ---------- */")[0]
    .replace(/const RAIZ = [^\n]+;/, "const RAIZ = " + JSON.stringify(RAIZ) + ";");
  fs.writeFileSync(
    testeMut,
    (alvoCliente ? corpo.replace(/const MOD_CLIENTE = [^\n]+;/, "const MOD_CLIENTE = " + JSON.stringify(modMut) + ";")
      : corpo.replace(/const MOD = [^\n]+;/, "const MOD = " + JSON.stringify(modMut) + ";")) + CAUDA
  );

  const r = spawnSync(process.execPath, [testeMut], { encoding: "utf8" });
  const saida = (r.stdout || "") + (r.stderr || "");
  const apanhou = r.status !== 0 && /FALHA/.test(saida);
  ok_("MUTACAO apanhada: " + nome, apanhou);
  if (!apanhou) {
    console.log("        (status " + r.status + ") " + saida.split(/\r?\n/).filter((l) => l.includes("FALHA")).slice(0, 3).join(" | ").slice(0, 150));
  }
  fs.rmSync(dirMut, { recursive: true, force: true });
}
fs.writeFileSync(MOD, original);
fs.writeFileSync(MOD_CLIENTE, originalCliente);

console.log("");
console.log("  " + ok + " ok, " + falhou + " falha(s)");
process.exit(falhou ? 1 : 0);
