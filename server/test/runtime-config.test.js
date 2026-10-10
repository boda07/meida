// A rota /runtime-config.json decide ONDE estao os dados da conta: sem
// `VITE_REMOTE_DATA_BASE`, o frontend manda o login para o proprio servidor que
// o serve — que pode nao ter a base de dados. A conta fica entao "nao existe" e o
// login falha com "Utilizador ou password invalidos", sem nada no servidor que
// indique a causa.
//
// O `catch` da rota transformava QUALQUER erro de leitura num `{}` silencioso, e
// por isso um BOM passou despercebido: `JSON.parse` de um ficheiro com BOM rebenta,
// o catch devolve `{}`, e o website passa a falar com a base de dados errada.
//
// PORQUE O TESTE CHAMA A ROTA E NAO UM PARSE COPIADO: uma versao anterior
// replicava o parse dentro do teste e passava mesmo com a rota partida — provava
// que o BOM estraga o `JSON.parse`, nao que a rota o tratasse. Aqui monta-se a
// rota exportada num Express minimo e faz-se um pedido HTTP a serio, por isso
// mutar a rota faz este teste falhar (confirmado em 2026-10-10).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import express from "express";

const RAIZ = resolve(import.meta.dirname, "..", "..");
const BOM = Buffer.from([0xef, 0xbb, 0xbf]); // BOM UTF-8 = U+FEFF

const CONFIG = {
  VITE_API_BASE: "",
  VITE_REMOTE_DATA_BASE: "https://meida.fadehost.app",
};

// A rota vem do `index.js` de verdade. As duas variaveis tem de estar ANTES do
// import: `MEIDA_NO_LISTEN` impede que o ficheiro arranque um servidor (ver o
// guarda no fim do `index.js`) e a base de dados vai para um sitio temporario.
process.env.MEIDA_NO_LISTEN = "1";
process.env.DB_DIR = mkdtempSync(join(tmpdir(), "meida-rc-db-"));
const { rotaRuntimeConfig } = await import("../src/index.js");

/**
 * Cria um `dist` de teste (com ou sem BOM), monta a rota num Express e faz um
 * pedido HTTP a serio. Devolve o JSON que a rota respondeu.
 */
async function pedirRuntimeConfig(comBom) {
  const dir = mkdtempSync(join(tmpdir(), "meida-rc-"));
  const dist = join(dir, "dist");
  mkdirSync(dist, { recursive: true });
  const corpo = Buffer.from(JSON.stringify(CONFIG, null, 2), "utf8");
  writeFileSync(join(dist, "runtime-config.json"), comBom ? Buffer.concat([BOM, corpo]) : corpo);

  const app = express();
  app.get("/runtime-config.json", rotaRuntimeConfig(dist));

  const servidor = await new Promise((ok) => {
    const s = app.listen(0, "127.0.0.1", () => ok(s));
  });
  try {
    const { port } = servidor.address();
    const r = await fetch(`http://127.0.0.1:${port}/runtime-config.json`);
    return { status: r.status, corpo: await r.json() };
  } finally {
    await new Promise((ok) => servidor.close(ok));
  }
}

test("a rota devolve a base de dados remota quando o ficheiro NAO tem BOM", async () => {
  const r = await pedirRuntimeConfig(false);
  assert.equal(r.status, 200);
  assert.equal(
    r.corpo.VITE_REMOTE_DATA_BASE,
    "https://meida.fadehost.app",
    "sem isto o frontend vai ao servidor que serve o site, que nao tem os dados"
  );
});

test("a rota devolve a base de dados remota QUANDO O FICHEIRO TEM BOM (o bug real)", async () => {
  // O teste que vale. Com a correccao removida da rota, `base` fica `{}` e isto
  // falha — e o website passa a mandar o login para o servidor errado sem dizer
  // nada (foi o que aconteceu na 1.3.9).
  const r = await pedirRuntimeConfig(true);
  assert.equal(r.status, 200);
  assert.equal(
    r.corpo.VITE_REMOTE_DATA_BASE,
    "https://meida.fadehost.app",
    "o BOM fez a rota devolver um config vazio — o login foi para o servidor errado"
  );
});

test("o ficheiro do repositorio nao tem BOM", () => {
  // A correccao da rota e' a rede de seguranca, mas o ficheiro nao deve ter BOM
  // na mesma: com BOM, o que responde e' a rota (que limpa), mas o Vite e
  // qualquer editor continuam a ver o BOM. Foi assim que o bug entrou.
  const buf = readFileSync(join(RAIZ, "web", "public", "runtime-config.json"));
  assert.notEqual(
    buf[0],
    0xef,
    "web/public/runtime-config.json tem BOM — reescrever SEM BOM " +
      "(nao usar Set-Content -Encoding UTF8 no PowerShell, que o acrescenta)"
  );
  assert.equal(JSON.parse(buf.toString("utf8")).VITE_REMOTE_DATA_BASE, "https://meida.fadehost.app");
});