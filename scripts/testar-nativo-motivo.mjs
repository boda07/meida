// Prova que a extracao nativa do MegaPlay diz PORQUE falhou (N1, 2026-11-01).
//
// O defeito que isto apanha: `lerDataId` e o `!r.ok` do getSources devolviam
// `null` sem registo, a rota respondia `native: false` e a interface caia no
// iframe sem dizer nada. Um teste por texto nao prova isto — o que prova e'
// chamar a funcao com um `fetch` falso e ver o `motivo` que sai, e o passo que
// fica no log.
//
// Nao bate no site real: o que se testa aqui e' a decisao (qual passo falhou),
// nao a rede. O `testar-megaplay.mjs` e' que prova a extracao a serio.
import path from "node:path";
import os from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import fs from "node:fs";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SERVICO = path.join(RAIZ, "server/src/services/megaplayNativo.js");
const ROTA = path.join(RAIZ, "server/src/routes/play.js");
const HOOK = path.join(RAIZ, "web/src/components/useNativeVideoSource.js");
const PLAYER = path.join(RAIZ, "web/src/components/Player.jsx");
const TRAD = path.join(RAIZ, "web/src/i18n/traducoes.js");

let ok = 0;
let falhou = 0;
function ok_(nome, cond, extra) {
  if (cond) {
    console.log("  OK    " + nome);
    ok++;
  } else {
    console.log("  FALHA " + nome + (extra ? " -> " + extra : ""));
    falhou++;
  }
}

// O `log.js` escreve por `console.warn` (lido no momento da chamada), por isso
// substituir a funcao antes de correr os casos chega para apanhar os avisos.
const avisos = [];
console.warn = (...a) => avisos.push(a.map(String).join(" "));
const limpar = () => {
  avisos.length = 0;
};

const mod = await import(pathToFileURL(SERVICO).href + "?t=" + Date.now());

const EMBED = "https://megaplay.buzz/stream/ani/1/1/sub";

function pagina(html) {
  return { ok: true, status: 200, text: async () => html };
}
function json(status, corpo) {
  return { ok: status >= 200 && status < 300, status, json: async () => corpo };
}

async function comFetch(falso, fn) {
  const original = globalThis.fetch;
  globalThis.fetch = falso;
  try {
    return await fn();
  } finally {
    globalThis.fetch = original;
  }
}

/* ---------- 1. A pagina do player nao tem data-id ---------- */
limpar();
{
  let pediuGetSources = false;
  const r = await comFetch(
    async (url) => {
      if (String(url).includes("getSources")) {
        pediuGetSources = true;
        return json(200, {});
      }
      return pagina("<html><body>sem id nenhum</body></html>");
    },
    () => mod.extrairMegaPlayNativo({ embedUrl: EMBED })
  );
  ok_(
    "pagina sem data-id -> ok:false com motivo",
    r.ok === false && /data-id/.test(r.motivo || ""),
    JSON.stringify(r)
  );
  ok_("e nao chega a pedir o getSources", pediuGetSources === false);
  ok_(
    "o passo (lerDataId) fica no log",
    avisos.some((a) => a.includes("lerDataId") && a.includes("data-id")),
    avisos.join(" | ")
  );
}

/* ---------- 2. O getSources devolve 403 ---------- */
limpar();
{
  const r = await comFetch(
    async (url) => {
      if (String(url).includes("getSources")) return { ok: false, status: 403 };
      return pagina('<div data-id="7827"></div>');
    },
    () => mod.extrairMegaPlayNativo({ embedUrl: EMBED })
  );
  ok_(
    "getSources 403 -> motivo com o codigo HTTP",
    r.ok === false && /403/.test(r.motivo || ""),
    JSON.stringify(r)
  );
  ok_(
    "e o passo fica no log",
    avisos.some((a) => a.includes("getSources") && a.includes("403")),
    avisos.join(" | ")
  );
}

/* ---------- 3. O `enc` existe mas nao decifra ---------- */
limpar();
{
  const r = await comFetch(
    async (url) => {
      if (String(url).includes("getSources")) return json(200, { enc: "lixo", tracks: [] });
      return pagina('<div data-id="7827"></div>');
    },
    () => mod.extrairMegaPlayNativo({ embedUrl: EMBED })
  );
  ok_(
    "enc invalido -> motivo da decifra",
    r.ok === false && /decifrar/.test(r.motivo || ""),
    JSON.stringify(r)
  );
  ok_(
    "e o passo fica no log",
    avisos.some((a) => a.includes("decifra")),
    avisos.join(" | ")
  );
}

/* ---------- 4. O motivo chega a rota e ao ecra ---------- */
// Estas sao por texto de proposito: o caminho completo (servidor -> hook ->
// JSX) nao se pode montar aqui sem um browser, e o que interessa e' que a
// ligacao exista nos tres sitios. As seccoes 1-3 e' que provam o motivo.
{
  const rota = fs.readFileSync(ROTA, "utf8");
  ok_("a rota devolve o motivo em native:false", /native: false,\s*\n\s*motivo:/.test(rota));
  ok_("a rota tem try/catch (nao deixa o pedido pendurado)", /try \{[\s\S]*?catch \(e\) \{/.test(rota));
  ok_(
    "o catch responde em vez de relancar",
    /catch \(e\) \{[\s\S]*?res\.json\(\{ native: false, motivo:/.test(rota)
  );

  const hook = fs.readFileSync(HOOK, "utf8");
  ok_("o hook guarda o motivo", /d\?\.motivo \|\| d\?\.error/.test(hook));
  ok_("e devolve-o", /return \{ nativoPronto, motivo, falhouPedido \}/.test(hook));
  ok_("distingue o pedido que nem chegou", /falhouPedido: true/.test(hook));

  const player = fs.readFileSync(PLAYER, "utf8");
  ok_(
    "o Player mostra 'Nativo indisponível: {motivo}'",
    /Nativo indisponível: \{motivo\}/.test(player)
  );
  ok_("e so quando a fonte e' nativa", /active\?\.native && nativoMotivoTexto/.test(player));
  ok_(
    "e o caso 'o pedido falhou' e' traduzido",
    /t\("O pedido ao servidor falhou\."\)/.test(player)
  );

  const trad = fs.readFileSync(TRAD, "utf8");
  const corteEn = trad.indexOf("\n  en: {");
  const pt = trad.slice(0, corteEn);
  const en = trad.slice(corteEn);
  ok_(
    "a chave existe em portugues",
    pt.includes('"Nativo indisponível: {motivo}": "Nativo indisponível: {motivo}"')
  );
  ok_(
    "e em ingles",
    en.includes('"Nativo indisponível: {motivo}": "Native unavailable: {motivo}"')
  );
}

/* ---------- 5. Mutacoes ---------- */
// A mutacao e' aplicada ao ficheiro REAL (numa copia), e o modulo partido e'
// importado com o mesmo `fetch` falso. Assim prova-se que o teste apanha o
// codigo, e nao uma reimplementacao do teste.
const fonte = fs.readFileSync(SERVICO, "utf8");
const fonteLf = fonte.replace(/\r\n/g, "\n");

const MUTACOES = [
  [
    "o motivo do getSources perde o codigo HTTP",
    'falha(`o getSources devolveu HTTP ${r.status}`)',
    'falha("o getSources falhou")',
  ],
  [
    "o lerDataId deixa de registar o passo",
    'log.warn("megaplay", `lerDataId: data-id nao encontrado na pagina (HTML mudou?) ${embedUrl}`);',
    "",
  ],
];

const servicosDir = path.dirname(SERVICO);
for (const [nome, de, para] of MUTACOES) {
  if (!fonteLf.includes(de)) {
    console.log("  FALHA MUTACAO IMPOSSIVEL (o codigo mudou): " + nome);
    falhou++;
    continue;
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "meida-motivo-mut-"));
  for (const f of fs.readdirSync(servicosDir)) {
    if (!f.endsWith(".js")) continue;
    fs.copyFileSync(path.join(servicosDir, f), path.join(dir, f));
  }
  const alvo = path.join(dir, "megaplayNativo.js");
  fs.writeFileSync(alvo, fonteLf.replace(de, para));

  let apanhada = false;
  try {
    const mut = await import(pathToFileURL(alvo).href + "?m=" + Date.now());

    // Caso A: a pagina sem data-id (prova o log do lerDataId).
    limpar();
    const a = await comFetch(
      async () => pagina("<html>sem id</html>"),
      () => mut.extrairMegaPlayNativo({ embedUrl: EMBED })
    );
    const logOk = avisos.some((x) => x.includes("lerDataId"));

    // Caso B: o getSources 403 (prova o codigo HTTP no motivo).
    limpar();
    const b = await comFetch(
      async (url) => {
        if (String(url).includes("getSources")) return { ok: false, status: 403 };
        return pagina('<div data-id="7827"></div>');
      },
      () => mut.extrairMegaPlayNativo({ embedUrl: EMBED })
    );
    const motivoOk = b.ok === false && /403/.test(b.motivo || "");

    apanhada = !(a.ok === false && /data-id/.test(a.motivo || "") && logOk && motivoOk);
  } catch {
    // Um rebentar tambem conta: o comportamento mudou.
    apanhada = true;
  }
  fs.rmSync(dir, { recursive: true, force: true });

  if (apanhada) {
    console.log("  OK    MUTACAO apanhada: " + nome);
    ok++;
  } else {
    console.log("  FALHA MUTACAO NAO DETECTADA: " + nome);
    falhou++;
  }
}

console.log("");
console.log("  " + ok + " ok, " + falhou + " falha(s)");
process.exitCode = falhou ? 1 : 0;
