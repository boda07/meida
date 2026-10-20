// O start command do Render nao pode reconstruir o site: sao ~47 s ate o
// servidor ligar, e o scanner de portas do Render da-se por vencido.
//
// Este teste cobre a decisao "construir ou nao construir" do `start-pwa.cjs`,
// sem correr o servidor: chama-se a logica com um `web/` de mentira.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";

const RAIZ = process.cwd();
const SCRIPT = path.join(RAIZ, "scripts", "start-pwa.cjs");

let ok = 0;
let falhou = 0;
function ok_(nome, cond, extra = "") {
  if (cond) { ok++; console.log("  OK    " + nome); }
  else { falhou++; console.log("  FALHA " + nome + (extra ? "  ->  " + extra : "")); }
}

// A logica esta' dentro do script. Para a testar sem arrancar o servidor,
// extrai-se a funcao `precisaConstruir` com uma `WEB` de mentira.
function extrairDecisao(webDir, { forcar = false } = {}) {
  const codigo = fs.readFileSync(SCRIPT, "utf8");
  // Reescreve o script para: WEB = <pasta>, e em vez de arrancar o servidor
  // imprime a decisao e sai.
  const modificado = codigo
    .replace(
      'const WEB = path.join(RAIZ, "web");',
      'const WEB = ' + JSON.stringify(webDir) + ";"
    )
    // Imprime a decisao e sai ANTES de qualquer spawn (o do npm ou o do
    // servidor). A decisao e' calculada pelo codigo real — e' isso que se
    // esta' a testar.
    .replace(
      "if (semBuild) {",
      "if (true) { console.log('DECISAO:' + (motivo || 'NAO CONSTRUIR')); process.exit(0); } else if (semBuild) {"
    );
  const tmp = path.join(os.tmpdir(), "opencode", "decisao-" + Math.random().toString(36).slice(2) + ".cjs");
  fs.writeFileSync(tmp, modificado, "utf8");
  const env = { ...process.env };
  if (forcar) env.MEIDA_FORCE_BUILD = "1";
  const r = spawnSync(process.execPath, [tmp], { cwd: RAIZ, encoding: "utf8", env });
  fs.rmSync(tmp, { force: true });
  const m = /DECISAO:(.*)/.exec(r.stdout || "");
  return { decisao: m ? m[1].trim() : "(sem saida)", stdout: r.stdout || "", stderr: r.stderr || "" };
}

console.log("");
console.log("  1) a decisao de construir");

// a) Sem dist: tem de construir.
{
  const web = fs.mkdtempSync(path.join(os.tmpdir(), "web-"));
  fs.mkdirSync(path.join(web, "src"));
  fs.writeFileSync(path.join(web, "src", "a.js"), "1");
  const d = extrairDecisao(web);
  ok_("sem dist -> construir", d.decisao.startsWith("nao ha build"), d.decisao);
  fs.rmSync(web, { recursive: true, force: true });
}

// b) Dist fresco: NAO constroi.
{
  const web = fs.mkdtempSync(path.join(os.tmpdir(), "web-"));
  fs.mkdirSync(path.join(web, "src"));
  fs.mkdirSync(path.join(web, "dist"));
  fs.writeFileSync(path.join(web, "src", "a.js"), "1");
  // O dist e' mais novo que a fonte.
  const agora = Date.now();
  fs.utimesSync(path.join(web, "src", "a.js"), new Date(agora - 60000), new Date(agora - 60000));
  fs.writeFileSync(path.join(web, "dist", "index.html"), "<html>");
  fs.utimesSync(path.join(web, "dist", "index.html"), new Date(agora), new Date(agora));
  const d = extrairDecisao(web);
  ok_("dist fresco -> NAO construir", d.decisao === "NAO CONSTRUIR", d.decisao);
  fs.rmSync(web, { recursive: true, force: true });
}

// c) Fonte mais nova que o dist: TEM de construir (o caso local, depois de
//    mexer no frontend).
{
  const web = fs.mkdtempSync(path.join(os.tmpdir(), "web-"));
  fs.mkdirSync(path.join(web, "src"));
  fs.mkdirSync(path.join(web, "dist"));
  const agora = Date.now();
  fs.writeFileSync(path.join(web, "src", "a.js"), "1");
  fs.utimesSync(path.join(web, "src", "a.js"), new Date(agora), new Date(agora));
  fs.writeFileSync(path.join(web, "dist", "index.html"), "<html>");
  fs.utimesSync(path.join(web, "dist", "index.html"), new Date(agora - 60000), new Date(agora - 60000));
  const d = extrairDecisao(web);
  ok_("fonte mais nova -> construir", d.decisao.includes("mais nova"), d.decisao);
  fs.rmSync(web, { recursive: true, force: true });
}

// d) MEIDA_FORCE_BUILD=1: constroi sempre.
{
  const web = fs.mkdtempSync(path.join(os.tmpdir(), "web-"));
  fs.mkdirSync(path.join(web, "src"));
  fs.mkdirSync(path.join(web, "dist"));
  const agora = Date.now();
  fs.writeFileSync(path.join(web, "src", "a.js"), "1");
  fs.utimesSync(path.join(web, "src", "a.js"), new Date(agora - 60000), new Date(agora - 60000));
  fs.writeFileSync(path.join(web, "dist", "index.html"), "<html>");
  fs.utimesSync(path.join(web, "dist", "index.html"), new Date(agora), new Date(agora));
  const d = extrairDecisao(web, { forcar: true });
  ok_("MEIDA_FORCE_BUILD=1 -> construir", d.decisao.includes("MEIDA_FORCE_BUILD"), d.decisao);
  fs.rmSync(web, { recursive: true, force: true });
}

// e) O `node_modules` e' ignorado (senao o mtime mais recente era o do npm).
{
  const web = fs.mkdtempSync(path.join(os.tmpdir(), "web-"));
  fs.mkdirSync(path.join(web, "src"));
  fs.mkdirSync(path.join(web, "dist"));
  fs.mkdirSync(path.join(web, "node_modules", "algo"), { recursive: true });
  const agora = Date.now();
  fs.writeFileSync(path.join(web, "src", "a.js"), "1");
  fs.utimesSync(path.join(web, "src", "a.js"), new Date(agora - 60000), new Date(agora - 60000));
  fs.writeFileSync(path.join(web, "node_modules", "algo", "b.js"), "2");
  fs.utimesSync(path.join(web, "node_modules", "algo", "b.js"), new Date(agora), new Date(agora));
  fs.writeFileSync(path.join(web, "dist", "index.html"), "<html>");
  fs.utimesSync(path.join(web, "dist", "index.html"), new Date(agora - 1000), new Date(agora - 1000));
  const d = extrairDecisao(web);
  ok_("o node_modules nao conta", d.decisao === "NAO CONSTRUIR", d.decisao);
  fs.rmSync(web, { recursive: true, force: true });
}

console.log("");
console.log("  2) o que o Render vai correr");
{
  const pkg = JSON.parse(fs.readFileSync(path.join(RAIZ, "package.json"), "utf8"));
  ok_("existe 'serve:pwa' (so' arranca)", typeof (pkg.scripts["serve:pwa"]) === "string" && pkg.scripts["serve:pwa"].length > 0);
  ok_("e o start command do render.yaml e' o serve:pwa",
    /startCommand:\s*npm run serve:pwa/.test(fs.readFileSync(path.join(RAIZ, "render.yaml"), "utf8")));
  // O start command nao pode construir: e' o que comia os 47 s.
  ok_("'serve:pwa' nao constroi", /--sem-build/.test(pkg.scripts["serve:pwa"] || ""));
  ok_("'start:pwa' passa pelo script (que decide)", /start-pwa\.cjs/.test(pkg.scripts["start:pwa"] || ""));
  ok_("o script nao depende do cross-env no caminho critico",
    !/cross-env/.test(pkg.scripts["serve:pwa"] || "") && /SERVE_WEB/.test(fs.readFileSync(SCRIPT, "utf8")));
  // O workflow do Pages tem de usar acoes que nao corram em Node 20.
  const wf = fs.readFileSync(path.join(RAIZ, ".github", "workflows", "pages.yml"), "utf8");
  ok_("nenhuma action em v3/v4 (Node 20 depreciado)",
    !/uses: actions\/(checkout|setup-node|configure-pages|upload-pages-artifact|deploy-pages)@v[34]\b/.test(wf),
    (wf.match(/uses: actions\/[a-z-]+@v[0-9]+/g) || []).join(", "));
}

console.log("");
console.log("  3) a porta que a plataforma pede nao se muda");
{
  const idx = fs.readFileSync(path.join(RAIZ, "server", "src", "index.js"), "utf8");
  ok_("ha uma lista de portas so' quando a porta nao veio do ambiente",
    /const PORTA_DO_AMBIENTE = Boolean\(\(process\.env\.PORT \|\| ""\)\.trim\(\)\);/.test(idx));
  ok_("e com o PORT do ambiente a lista tem uma so porta",
    /PORTA_DO_AMBIENTE\s*\?\s*\[config\.port\]/.test(idx));
  ok_("e a mensagem de EADDRINUSE diz porque nao se muda de porta",
    /Nao se pode mudar de porta aqui/.test(idx));
}

console.log("");
console.log("  " + ok + " ok, " + falhou + " falha(s)");
process.exitCode = falhou ? 1 : 0;
