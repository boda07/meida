// O aviso do player nativo dizia o motivo CRU do servidor, em portugues sem
// acentos, mesmo com a interface em ingles (B2, 2026-11-06).
//
// O contrato que isto guarda:
//   - o servidor devolve `codigo` (um de seis) e `detalhe` (texto tecnico);
//   - a interface traduz o `codigo` e NUNCA mostra o `detalhe`;
//   - o detalhe vai para a consola, para se perceber o que falhou.
//
// As seccoes 1-4 provam comportamento a serio: `extrairMegaPlayNativo` corre
// com um `fetch` falso e verifica-se o codigo/detalhe de cada passo, o mapa
// `mensagemNativo` corre com um `t` falso e as traducoes sao lidas do
// dicionario. As seccoes 5-6 sao por texto (a rota, o gancho e o JSX nao se
// montam aqui sem browser) e as mutacoes provam que elas apanham o erro.
//
// Nao bate no site real: o que se testa e' a decisao (que passo falhou), nao a
// rede. O `testar-megaplay.mjs` e' que prova a extracao a serio.
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import fs from "node:fs";
import { DICIONARIO } from "../web/src/i18n/traducoes.js";
import {
  CODIGOS_NATIVO,
  mensagemNativo,
} from "../web/src/components/mensagemNativo.js";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SERVICO = path.join(RAIZ, "server/src/services/megaplayNativo.js");
const ROTA = path.join(RAIZ, "server/src/routes/play.js");
const HOOK = path.join(RAIZ, "web/src/components/useNativeVideoSource.js");
const PLAYER = path.join(RAIZ, "web/src/components/Player.jsx");
const MAPA = path.join(RAIZ, "web/src/components/mensagemNativo.js");
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
const consoleWarnOriginal = console.warn;
console.warn = (...a) => avisos.push(a.map(String).join(" "));

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

// Cifra um objecto como o MegaPlay faz, para o caso POSITIVO. Sem isto, todos
// os casos falhavam e o teste nao provava que o caminho bom continua bom.
function encriptar(obj) {
  const chave = Buffer.alloc(32);
  chave.write("i?LMTAx0Q6,:}50U");
  const iv = Buffer.alloc(16);
  iv.write("W0;27ToaUpl_P%'c");
  const c = crypto.createCipheriv("aes-256-cbc", chave, iv);
  const out = Buffer.concat([c.update(JSON.stringify(obj), "utf8"), c.final()]);
  return out
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/* ---------- 1. Cada passo falhado tem o seu codigo ---------- */

async function casosServico(m) {
  const casos = [];
  const add = (nome, cond, extra) => casos.push({ nome, cond, extra });

  // url_invalido: um embed que nao e' do MegaPlay nem chega a fazer fetch.
  {
    const r = await comFetch(
      async () => {
        throw new Error("nao devia pedir nada");
      },
      () =>
        m.extrairMegaPlayNativo({
          embedUrl: "https://exemplo.com/stream/ani/1/1/sub",
        })
    );
    add(
      "embed fora do MegaPlay -> url_invalido",
      r.ok === false && r.codigo === "url_invalido",
      JSON.stringify(r)
    );
    add(
      "e traz o detalhe tecnico",
      r.ok === false && typeof r.detalhe === "string" && r.detalhe.length > 0,
      JSON.stringify(r)
    );
  }

  // url_invalido: sem embedUrl nem dataId.
  {
    const r = await m.extrairMegaPlayNativo({});
    add(
      "sem url nem data-id -> url_invalido",
      r.ok === false && r.codigo === "url_invalido",
      JSON.stringify(r)
    );
  }

  // url_invalido: `lerDataId` tambem defende sozinho.
  {
    const r = await m.lerDataId("https://exemplo.com/stream/ani/1/1/sub");
    add(
      "lerDataId com url invalido -> url_invalido",
      r.id === null && r.codigo === "url_invalido",
      JSON.stringify(r)
    );
  }

  // sem_data_id: a pagina do player responde, mas o HTML mudou.
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
      () => m.extrairMegaPlayNativo({ embedUrl: EMBED })
    );
    add(
      "pagina sem data-id -> sem_data_id",
      r.ok === false && r.codigo === "sem_data_id",
      JSON.stringify(r)
    );
    add(
      "com detalhe a falar do data-id",
      r.ok === false && /data-id/.test(r.detalhe || ""),
      JSON.stringify(r)
    );
    add("e nao chega a pedir o getSources", pediuGetSources === false);
  }

  // http: a pagina do player responde com erro.
  {
    const r = await comFetch(
      async () => ({ ok: false, status: 500 }),
      () => m.extrairMegaPlayNativo({ embedUrl: EMBED })
    );
    add(
      "pagina 500 -> http",
      r.ok === false && r.codigo === "http",
      JSON.stringify(r)
    );
    add(
      "com o codigo HTTP no detalhe",
      r.ok === false && /500/.test(r.detalhe || ""),
      JSON.stringify(r)
    );
  }

  // http: o getSources responde com erro.
  {
    const r = await comFetch(
      async (url) => {
        if (String(url).includes("getSources")) return { ok: false, status: 403 };
        return pagina('<div data-id="7827"></div>');
      },
      () => m.extrairMegaPlayNativo({ embedUrl: EMBED })
    );
    add(
      "getSources 403 -> http",
      r.ok === false && r.codigo === "http",
      JSON.stringify(r)
    );
    add(
      "com o 403 no detalhe",
      r.ok === false && /403/.test(r.detalhe || ""),
      JSON.stringify(r)
    );
  }

  // rede: a pagina nem chega a abrir.
  {
    const r = await comFetch(
      async () => {
        throw new Error(" DNS partido ");
      },
      () => m.extrairMegaPlayNativo({ embedUrl: EMBED })
    );
    add(
      "pagina inacessivel -> rede",
      r.ok === false && r.codigo === "rede",
      JSON.stringify(r)
    );
    add(
      "com a mensagem da rede no detalhe",
      r.ok === false && /DNS partido/.test(r.detalhe || ""),
      JSON.stringify(r)
    );
  }

  // rede: o getSources nem chega a responder.
  {
    const r = await comFetch(
      async (url) => {
        if (String(url).includes("getSources")) {
          throw new Error("ECONNRESET");
        }
        return pagina('<div data-id="7827"></div>');
      },
      () => m.extrairMegaPlayNativo({ embedUrl: EMBED })
    );
    add(
      "getSources inacessivel -> rede",
      r.ok === false && r.codigo === "rede",
      JSON.stringify(r)
    );
    add(
      "com a mensagem da rede no detalhe",
      r.ok === false && /ECONNRESET/.test(r.detalhe || ""),
      JSON.stringify(r)
    );
  }

  // cifra: o `enc` veio, mas nao decifra.
  {
    const r = await comFetch(
      async (url) => {
        if (String(url).includes("getSources")) {
          return json(200, { enc: "lixo", tracks: [] });
        }
        return pagina('<div data-id="7827"></div>');
      },
      () => m.extrairMegaPlayNativo({ embedUrl: EMBED })
    );
    add(
      "enc invalido -> cifra",
      r.ok === false && r.codigo === "cifra",
      JSON.stringify(r)
    );
    add(
      "com a chave no detalhe",
      r.ok === false && /chave|decifrar/i.test(r.detalhe || ""),
      JSON.stringify(r)
    );
  }

  // sem_video: o getSources responde sem `enc`.
  {
    const r = await comFetch(
      async (url) => {
        if (String(url).includes("getSources")) return json(200, { tracks: [] });
        return pagina('<div data-id="7827"></div>');
      },
      () => m.extrairMegaPlayNativo({ embedUrl: EMBED })
    );
    add(
      "getSources sem enc -> sem_video",
      r.ok === false && r.codigo === "sem_video",
      JSON.stringify(r)
    );
    add(
      "com o enc no detalhe",
      r.ok === false && /enc/.test(r.detalhe || ""),
      JSON.stringify(r)
    );
  }

  // sem_video: o getSources responde, mas nao e' JSON.
  {
    const r = await comFetch(
      async (url) => {
        if (String(url).includes("getSources")) {
          return {
            ok: true,
            status: 200,
            json: async () => {
              throw new Error("nao e' JSON");
            },
          };
        }
        return pagina('<div data-id="7827"></div>');
      },
      () => m.extrairMegaPlayNativo({ embedUrl: EMBED })
    );
    add(
      "getSources que nao e' JSON -> sem_video",
      r.ok === false && r.codigo === "sem_video",
      JSON.stringify(r)
    );
    add(
      "com o JSON no detalhe",
      r.ok === false && /JSON/.test(r.detalhe || ""),
      JSON.stringify(r)
    );
  }

  // Controlo positivo: o caminho bom continua a devolver o m3u8.
  {
    const r = await comFetch(
      async (url) => {
        if (String(url).includes("getSources")) {
          return json(200, {
            enc: encriptar({ file: "https://cdn.example/master.m3u8" }),
            tracks: [{ file: "https://cdn.example/legenda.vtt" }],
          });
        }
        return pagina('<div data-id="7827"></div>');
      },
      () => m.extrairMegaPlayNativo({ embedUrl: EMBED })
    );
    add(
      "o caminho bom continua a devolver o m3u8",
      r.ok === true && r.m3u8 === "https://cdn.example/master.m3u8",
      JSON.stringify(r)
    );
    add(
      "com as legendas",
      r.ok === true && r.tracks?.[0]?.file === "https://cdn.example/legenda.vtt",
      JSON.stringify(r)
    );
  }

  return casos;
}

console.log("  1) cada falha do servidor tem um codigo");
{
  const casos = await casosServico(mod);
  for (const c of casos) ok_(c.nome, c.cond, c.extra);
  const codigos = new Set(
    casos
      .filter((c) => c.nome.includes("->"))
      .map((c) => (c.extra ? JSON.parse(c.extra).codigo : null))
  );
  ok_(
    "os seis codigos do contrato aparecem",
    CODIGOS_NATIVO.every((c) => codigos.has(c)),
    [...codigos].join(", ")
  );
}

/* ---------- 2. A rota devolve codigo + detalhe (nunca motivo) ---------- */

console.log("  2) a rota separa o codigo do detalhe");
{
  const rota = fs.readFileSync(ROTA, "utf8");
  ok_(
    "native:false leva o codigo e o detalhe",
    /native: false,\s*\n\s*codigo: r\?\.codigo \|\| "sem_video",\s*\n\s*detalhe: r\?\.detalhe \|\|/.test(
      rota
    )
  );
  ok_(
    "o catch responde sem_video com detalhe",
    /catch \(e\) \{[\s\S]*?native: false,\s*\n\s*codigo: "sem_video",\s*\n\s*detalhe:/.test(
      rota
    )
  );
  ok_(
    "a rota tem try/catch (nao deixa o pedido pendurado)",
    /try \{[\s\S]*?catch \(e\) \{/.test(rota)
  );
  ok_("a rota ja' nao manda motivo", !/motivo:/.test(rota));
}

/* ---------- 3. O gancho guarda o codigo e o detalhe ---------- */

console.log("  3) o gancho guarda o codigo e o detalhe");
{
  const hook = fs.readFileSync(HOOK, "utf8");
  ok_(
    "guarda o codigo que o servidor mandou",
    /const codigo = d\?\.codigo \|\| null;/.test(hook)
  );
  ok_(
    "guarda o detalhe tecnico",
    /const detalhe = d\?\.detalhe \|\| d\?\.error \|\| null;/.test(hook)
  );
  ok_(
    "escreve o detalhe na consola",
    /console\.warn\("\[nativo\] extraction failed:", codigo, detalhe/.test(hook)
  );
  ok_(
    "devolve codigo e detalhe",
    /return \{ nativoPronto, codigo, detalhe, falhouPedido \};/.test(hook)
  );
  ok_("ja' nao usa motivo", !/motivo/.test(hook));
  ok_("distingue o pedido que nem chegou", /falhouPedido: true/.test(hook));
}

/* ---------- 4. O mapa codigo -> mensagem e as traducoes ---------- */

function casosMapa() {
  const casos = [];
  const add = (nome, cond, extra) => casos.push({ nome, cond, extra });
  const t = (s) => s;
  const msgs = CODIGOS_NATIVO.map((c) => [c, mensagemNativo(c, t)]);

  for (const [codigo, msg] of msgs) {
    add(
      `${codigo} tem mensagem propria`,
      typeof msg === "string" && msg.length > 0 && msg !== codigo,
      String(msg)
    );
  }
  add(
    "as seis mensagens sao diferentes",
    new Set(msgs.map(([, m]) => m)).size === CODIGOS_NATIVO.length,
    msgs.map(([c, m]) => `${c}=${m}`).join(" | ")
  );
  add(
    "nenhuma mensagem tem o detalhe tecnico",
    msgs.every(
      ([, m]) =>
        !/data-id|getSources|HTTP|\benc\b|decifrar|\{motivo\}/i.test(String(m))
    ),
    msgs.map(([, m]) => m).join(" | ")
  );

  const desconhecido = mensagemNativo("outra_coisa", t);
  add(
    "um codigo desconhecido cai na mensagem generica",
    typeof desconhecido === "string" &&
      desconhecido.length > 0 &&
      desconhecido !== "outra_coisa",
    String(desconhecido)
  );

  return { casos, msgs };
}

function casosTraducao(dic) {
  const casos = [];
  const add = (nome, cond, extra) => casos.push({ nome, cond, extra });
  const t = (s) => s;
  const msgs = CODIGOS_NATIVO.map((c) => mensagemNativo(c, t));
  const generica = mensagemNativo("outra_coisa", t);

  for (const msg of msgs) {
    add(
      `PT tem "${msg.slice(0, 40)}..."`,
      dic.pt?.[msg] === msg,
      String(dic.pt?.[msg])
    );
    add(
      `EN tem "${msg.slice(0, 40)}..."`,
      typeof dic.en?.[msg] === "string" && dic.en[msg].length > 0,
      String(dic.en?.[msg])
    );
  }
  add(
    "a mensagem generica tambem esta traduzida",
    dic.pt?.[generica] === generica &&
      typeof dic.en?.[generica] === "string" &&
      dic.en[generica].length > 0
  );
  add(
    "o ingles nao e' o portugues copiado",
    msgs.every((m) => dic.en?.[m] !== dic.pt?.[m])
  );
  add(
    "a chave antiga com {motivo} desapareceu do PT",
    !Object.hasOwn(dic.pt || {}, "Nativo indisponível: {motivo}")
  );
  add(
    "a chave antiga com {motivo} desapareceu do EN",
    !Object.hasOwn(dic.en || {}, "Nativo indisponível: {motivo}")
  );

  return casos;
}

console.log("  4) o mapa traduz o codigo e o dicionario tem as mensagens");
{
  const { casos, msgs } = casosMapa();
  for (const c of casos) ok_(c.nome, c.cond, c.extra);
  console.log(
    "      mensagens: " +
      msgs.map(([c, m]) => `${c} -> ${m}`).join("\n                 ")
  );

  for (const c of casosTraducao(DICIONARIO)) ok_(c.nome, c.cond, c.extra);
}

/* ---------- 5. O Player mostra a mensagem, nunca o detalhe ---------- */

console.log("  5) o Player mostra a mensagem traduzida");
{
  const player = fs.readFileSync(PLAYER, "utf8");
  ok_(
    "importa o mapa",
    /import \{ mensagemNativo \} from "\.\/mensagemNativo\.js";/.test(player)
  );
  ok_(
    "traduz o codigo com o t()",
    /mensagemNativo\(nativoCodigo, t\)/.test(player)
  );
  ok_("mostra a mensagem", /\{nativoMensagem\}/.test(player));
  ok_(
    "ja' nao mostra a chave antiga com {motivo}",
    !/Nativo indisponível: \{motivo\}/.test(player)
  );
  ok_("ja' nao usa o texto do motivo", !/nativoMotivoTexto/.test(player));
  ok_("nao mete o detalhe no JSX", !/nativoDetalhe|\{[^}]*detalhe[^}]*\}/.test(player));
  ok_(
    "o caso 'o pedido falhou' continua traduzido",
    /t\("O pedido ao servidor falhou\."\)/.test(player)
  );
}

/* ---------- 6. Mutacoes ---------- */

console.log("  6) mutacoes");
{
  const fonte = fs.readFileSync(SERVICO, "utf8").replace(/\r\n/g, "\n");
  const mutacoesServico = [
    [
      "o getSources 403 passa a ser rede",
      'return falha("http", `o getSources devolveu HTTP ${r.status}`);',
      'return falha("rede", `o getSources devolveu HTTP ${r.status}`);',
    ],
    [
      "a cifra falhada passa a sem_video",
      'return falha("cifra", "nao consegui decifrar o video (a chave do MegaPlay mudou?)");',
      'return falha("sem_video", "nao consegui decifrar o video (a chave do MegaPlay mudou?)");',
    ],
    [
      "o data-id em falta passa a http",
      'codigo: "sem_data_id",',
      'codigo: "http",',
    ],
    [
      "o url invalido passa a rede",
      'return falha("url_invalido", "url do MegaPlay invalido");',
      'return falha("rede", "url do MegaPlay invalido");',
    ],
  ];

  for (const [nome, de, para] of mutacoesServico) {
    if (!fonte.includes(de)) {
      console.log("  FALHA MUTACAO IMPOSSIVEL (o codigo mudou): " + nome);
      falhou++;
      continue;
    }
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "meida-motivo-mut-"));
    fs.copyFileSync(
      path.join(RAIZ, "server/src/services/log.js"),
      path.join(dir, "log.js")
    );
    fs.writeFileSync(path.join(dir, "megaplayNativo.js"), fonte.replace(de, para));

    const dbAnterior = process.env.DB_DIR;
    process.env.DB_DIR = path.join(dir, "data");
    let apanhada;
    try {
      const mut = await import(
        pathToFileURL(path.join(dir, "megaplayNativo.js")).href + "?m=" + Date.now()
      );
      const casos = await casosServico(mut);
      apanhada = casos.some((c) => !c.cond);
    } catch {
      // Um rebentar tambem conta: o comportamento mudou.
      apanhada = true;
    } finally {
      if (dbAnterior === undefined) delete process.env.DB_DIR;
      else process.env.DB_DIR = dbAnterior;
      fs.rmSync(dir, { recursive: true, force: true });
    }

    if (apanhada) {
      console.log("  OK    MUTACAO apanhada: " + nome);
      ok++;
    } else {
      console.log("  FALHA MUTACAO NAO DETECTADA: " + nome);
      falhou++;
    }
  }

  // Mapa: uma mensagem que devolve o codigo cru tem de ser apanhada.
  {
    const fonteMapa = fs.readFileSync(MAPA, "utf8");
    const de =
      '    case "http":\n      return t("Nativo indisponível: o MegaPlay respondeu com um erro.");';
    const para = '    case "http":\n      return codigo;';
    if (!fonteMapa.includes(de)) {
      console.log("  FALHA MUTACAO IMPOSSIVEL (o mapa mudou): mensagem crua no http");
      falhou++;
    } else {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "meida-motivo-mapa-"));
      fs.writeFileSync(path.join(dir, "mensagemNativo.js"), fonteMapa.replace(de, para));
      let apanhada;
      try {
        const mut = await import(
          pathToFileURL(path.join(dir, "mensagemNativo.js")).href +
            "?m=" +
            Date.now()
        );
        const t = (s) => s;
        apanhada = CODIGOS_NATIVO.some((c) => mut.mensagemNativo(c, t) === c);
      } catch {
        apanhada = true;
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
      if (apanhada) {
        console.log("  OK    MUTACAO apanhada: mensagem crua no http");
        ok++;
      } else {
        console.log("  FALHA MUTACAO NAO DETECTADA: mensagem crua no http");
        falhou++;
      }
    }
  }

  // Traducoes: apagar o ingles de uma mensagem tem de ser apanhado.
  {
    const fonteTrad = fs.readFileSync(TRAD, "utf8").replace(/\r\n/g, "\n");
    const de = '      "Native unavailable: MegaPlay returned an error.",\n';
    if (!fonteTrad.includes(de)) {
      console.log("  FALHA MUTACAO IMPOSSIVEL (as traducoes mudaram): EN em falta");
      falhou++;
    } else {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "meida-motivo-trad-"));
      fs.writeFileSync(path.join(dir, "traducoes.js"), fonteTrad.replace(de, ""));
      let apanhada;
      try {
        const mut = await import(
          pathToFileURL(path.join(dir, "traducoes.js")).href + "?m=" + Date.now()
        );
        apanhada = casosTraducao(mut.DICIONARIO).some((c) => !c.cond);
      } catch {
        apanhada = true;
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
      if (apanhada) {
        console.log("  OK    MUTACAO apanhada: EN em falta");
        ok++;
      } else {
        console.log("  FALHA MUTACAO NAO DETECTADA: EN em falta");
        falhou++;
      }
    }
  }

  // Mutacoes de texto: a verificacao certa tem de deixar de passar.
  const mutacoesTexto = [
    [
      "a rota volta a mandar o motivo",
      ROTA,
      'codigo: r?.codigo || "sem_video",',
      'codigo: r?.motivo || "sem_video",',
      (s) => /codigo: r\?\.codigo \|\| "sem_video",/.test(s),
    ],
    [
      "o gancho volta a guardar o motivo",
      HOOK,
      "const codigo = d?.codigo || null;",
      "const codigo = d?.motivo || null;",
      (s) => /const codigo = d\?\.codigo \|\| null;/.test(s),
    ],
    [
      "o Player volta a mostrar o motivo cru",
      PLAYER,
      "{nativoMensagem}",
      "{nativoMotivo}",
      (s) => /\{nativoMensagem\}/.test(s),
    ],
  ];

  for (const [nome, ficheiro, de, para, verificacao] of mutacoesTexto) {
    const src = fs.readFileSync(ficheiro, "utf8");
    if (!src.includes(de)) {
      console.log("  FALHA MUTACAO IMPOSSIVEL (o codigo mudou): " + nome);
      falhou++;
      continue;
    }
    const apanhada = verificacao(src) && !verificacao(src.replace(de, para));
    if (apanhada) {
      console.log("  OK    MUTACAO apanhada: " + nome);
      ok++;
    } else {
      console.log("  FALHA MUTACAO NAO DETECTADA: " + nome);
      falhou++;
    }
  }
}

console.warn = consoleWarnOriginal;

console.log("");
console.log("  " + ok + " ok, " + falhou + " falha(s)");
process.exitCode = falhou ? 1 : 0;
