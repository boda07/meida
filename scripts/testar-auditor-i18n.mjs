// Prova que o auditor de textos por traduzir NAO tem o buraco que encontrou
// 26 textos em 2026-10-11.
//
// O buraco: o texto de JSX MISTURADO com uma expressao — `>A preparar {erro}<`
// — nao era visto. A regex que apanha o texto excluia `{`, por isso parava a
// meio e nao apontava nada. E o `Torrents.jsx` tinha exactamente isso
// ("Debrid indisponivel, a tocar via torrent local — {streamErr}") com o
// auditor a dizer "limpo".
//
// A prova sao duas, e as duas importam:
//   1) o auditor aponta um ficheiro de teste com o texto misturado;
//   2) depois de mutar o auditor, ele DEIXA de apontar — se nao deixasse, o
//      teste estaria a passar por acaso e nao provaria nada.
//
// Nao se toca em `web/src`: o auditor e' copiado para a pasta temporaria do
// sistema e corre com o `cwd` numa pasta que tem um `web/src` de mentira.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const AUDITOR = path.join(AQUI, "auditar-pt-por-traduzir.cjs");

let ok = 0;
let falhou = 0;
const ok_ = (nome, cond) => {
  if (cond) {
    ok++;
    console.log("  OK    " + nome);
  } else {
    falhou++;
    console.log("  FALHA " + nome);
  }
};

/**
 * Corre o auditor contra um `web/src` falso e devolve o que ele apontou.
 * O auditor le de `path.join(process.cwd(), "web/src")`, por isso corre-se com
 * o cwd numa pasta temporaria que tem esse `web/src` dentro.
 *
 * `fonteDoAuditor` existe para a mutacao: passa-se uma versao partida do
 * auditor e ve-se se o teste ainda a apanha.
 */
function auditarCom(ficheiros, fonteDoAuditor = null) {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), "meida-aud-"));
  const src = path.join(raiz, "web", "src");
  fs.mkdirSync(src, { recursive: true });
  for (const [nome, conteudo] of Object.entries(ficheiros)) {
    const alvo = path.join(src, nome);
    fs.mkdirSync(path.dirname(alvo), { recursive: true });
    fs.writeFileSync(alvo, conteudo);
  }
  let auditor = AUDITOR;
  if (fonteDoAuditor) {
    const tmp = path.join(raiz, "auditor-partido.cjs");
    fs.writeFileSync(tmp, fonteDoAuditor);
    auditor = tmp;
  }
  let saida;
  try {
    saida = execFileSync("node", [auditor], {
      cwd: raiz,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (e) {
    // Sai com codigo 1 quando aponta algo — que e' o que queremos saber.
    saida = (e.stdout || "") + (e.stderr || "");
  }
  fs.rmSync(raiz, { recursive: true, force: true });
  return saida;
}

/* ---------- 1) O bug: texto de JSX misturado com expressao ---------- */

const COM_MIX = `import { useT } from "../i18n/I18nContext.jsx";
export default function Exemplo() {
  const t = useT();
  const erro = "x";
  return (
    <p className="muted">
      Debrid indisponível, a tocar via torrent local — {erro}
    </p>
  );
}
`;

// O `web/src` tem de ter pelo menos um ficheiro .jsx, senao o auditor nao ve nada.
ok_(
  "texto de JSX misturado com expressao e' apontado",
  auditarCom({ "Exemplo.jsx": COM_MIX }).includes("Debrid indispon")
);

/* ---------- 2) O mesmo texto, ja traduzido, NAO e' apontado ---------- */

const JA_TRADUZIDO = COM_MIX.replace(
  "Debrid indisponível, a tocar via torrent local — {erro}",
  '{t("Debrid indisponível, a tocar via torrent local")} — {erro}'
);

ok_(
  "o mesmo texto dentro de t() NAO e' apontado",
  !auditarCom({ "Exemplo.jsx": JA_TRADUZIDO }).includes("Debrid indispon")
);

/* ---------- 3) Uma expressao no MEIO da frase ---------- */

const MEIO = `export default function E() {
  const n = 3;
  return <p>Página {n} de 10 · {n} títulos</p>;
}
`;

ok_("frase partida por expressoes no meio", auditarCom({ "E.jsx": MEIO }).includes("Página"));

/* ---------- 4) O objecto de valores do t() NAO pode ser lido como texto ---------- */

const COM_VALORES = `import { useT } from "../i18n/I18nContext.jsx";
export default function V() {
  const t = useT();
  return (
    <p className="muted">
      {t("Cola o token em {chave} no {onde}.", {
        chave: <code>EXTRACTOR_API_BASE</code>,
        onde: <code>server/.env</code>,
      })}
    </p>
  );
}
`;

const saidaValores = auditarCom({ "V.jsx": COM_VALORES });
ok_(
  "as CHAVES do dicionario com valores nao sao apontadas",
  !saidaValores.includes("Cola o token")
);
// E o inverso: os `chave:`/`onde:` do objecto de valores NAO podem ser lidos
// como texto de interface. Sem este salto o scanner descia para dentro do
// objecto e apanhava o `>` de fecho de `<code>` como abertura de texto.
ok_(
  "as propriedades do objecto de valores nao viram texto",
  !saidaValores.includes("chave:")
);

/* ---------- 5) Nao regrediu o que ja funcionava ---------- */

const SIMPLES_FRASE = `export default function S() {
  return <button>Criar sala</button>;
}
`;
// "Criar sala" e' duas palavras, que e' o que `pareceFrase` apanha. Um teste
// com uma palavra so' ("Reproduzir") falhava por construcao e nao provava nada.
ok_(
  "texto simples entre tags continua a ser apontado",
  auditarCom({ "S.jsx": SIMPLES_FRASE }).includes("Criar sala")
);

const ATRIBUTO = `export default function A() {
  return <input placeholder="Escreve aqui o teu nome" />;
}
`;

ok_("placeholder continua a ser apontado", auditarCom({ "A.jsx": ATRIBUTO }).includes("Escreve aqui"));

/* ---------- 4b) Texto de UMA PALAVRA dentro de uma tag ---------- */
// O buraco mais recente, e o que mais pesava: `pareceTexto` descarta o que e'
// uma palavra so' (porque e' indistinguivel de um identificador) e `pareceFrase`
// exige DUAS. Resultado: entre `>` e `<`, texto de uma palavra nunca era
// apontado. Ficaram no ecra "Apagar", "Cancelar", "Entrar", "Utilizador",
// "Conquistas", "Acabou", "Temporada", "Desligar", "Todas" — e o auditor dizia
// "limpo".
const UMA_PALAVRA = `export default function U() {
  return (
    <div>
      <h2>Conquistas</h2>
      <button>Apagar</button>
    </div>
  );
}
`;

const saidaUmaPalavra = auditarCom({ "U.jsx": UMA_PALAVRA });
ok_("texto de uma palavra dentro de uma tag e' apontado", saidaUmaPalavra.includes("Conquistas"));
ok_("e o botao tambem", saidaUmaPalavra.includes("Apagar"));

// E o inverso: ja' traduzido nao e' apontado.
const UMA_PALAVRA_TRADUZIDA = `import { useT } from "../i18n/I18nContext.jsx";
export default function U() {
  const t = useT();
  return (
    <div>
      <h2>{t("Conquistas")}</h2>
      <button>{t("Apagar")}</button>
    </div>
  );
}
`;
ok_(
  "o mesmo dentro de t() NAO e' apontado",
  !auditarCom({ "U.jsx": UMA_PALAVRA_TRADUZIDA }).includes("Conquistas")
);

// Nao pode aceitar fragmentos de codigo: entre `>` e `<` o scanner tambem passa
// pelo fecho de uma expressao, e `) : other ? (` tem palavras.
const CODIGO = `export default function C({ cond, other }) {
  return cond ? <p>Oi</p> : other ? <p>Tchau</p> : null;
}
`;
const saidaCodigo = auditarCom({ "C.jsx": CODIGO });
ok_(
  "nao aponta fragmentos de codigo como se fossem texto",
  !saidaCodigo.includes("other ?"),
  saidaCodigo.trim().slice(0, 60)
);

/* ---------- 5b) O `semComentarios` tinha de saber strings e REGEX ---------- */
// O buraco mais silencioso de todos, e o que escondeu o caso que o utilizador
// reportou (os botoes "Esconder"/"Mostrar" por traduzir no ecra).
//
// `semComentarios` apagava comentarios **sem saber o que era uma string**.
// O `//` de `href="https://exemplo.pt/x"` e' o inicio de um URL, nao um
// comentario: o `//` apagava o resto da linha **com a aspa de fecho da string**.
// A string ficava aberta, o scanner perdia o fio e `fimDaChamada` corria ate ao
// fim do ficheiro — sem dar erro nenhum, e o auditor dizia "limpo".
//
// Em `web/src` isso eran 477 linhas. Em `Settings.jsx` comecava na linha 438 e
// deixava as 1207 seguintes por auditar.
//
// A segunda forma e' a mesma com uma regex: `/[",\n\r]/` tem uma aspa dentro, e
// sem reconhecer regex a aspa abre uma string que vai parar muito mais abaixo.
//
// Nenhum dos dois se apanha com `grep`: so' se prova pondo o texto POR TRADUZIR
// DEPOIS do URL e vendo se ainda e' apontado.
const COM_URL = `import { useT } from "../i18n/I18nContext.jsx";
export default function X() {
  const t = useT();
  return (
    <div>
      <p>
        {t("Cola o token (obtém-no em {ligacao}){fim}", {
          ligacao: <a href="https://exemplo.pt/x">exemplo.pt/x</a>,
          fim: t(" (resto)"),
        })}
      </p>
      <button>Esconder</button>
    </div>
  );
}
`;

const saidaUrl = auditarCom({ "X.jsx": COM_URL });
ok_(
  "texto depois de um URL dentro de uma string continua a ser apontado",
  saidaUrl.includes("Esconder"),
  "o auditor parou no URL: " + saidaUrl.trim().slice(0, 60)
);
// E o inverso: o URL nao pode ser lido como interface.
ok_("o URL nao vira texto de interface", !saidaUrl.includes("exemplo.pt"));

// A forma com uma REGEX e' diferente da do URL e e' facil de escrever mal: uma
// string que se abre sozinha nao DESTROI o texto, copia-o tal e qual. O que
// estraga e' um `//` ficar dentro dessa string — ai deixa de ser apagado, e se
// o comentario tiver aspas dentro o scanner le essas aspas como uma string e
// aponta o comentario como interface. E' o que acontecia no `Settings.jsx`, na
// linha 767 (`return /[",\n\r]/.test(s) ? ...`), com o comentario da 785.
const COM_REGEX = `export default function Y() {
  const celula = (v) => /[",\\n\\r]/.test(v);
  // Vazio = "nao se sabe quando foi visto".
  return (
    <div>
      {celula("x") ? <b>Conquistas</b> : null}
    </div>
  );
}
`;

const saidaRegex = auditarCom({ "Y.jsx": COM_REGEX });
ok_(
  "um comentario com aspas, depois de uma regex, NAO vira texto de interface",
  !saidaRegex.includes("nao se sabe quando"),
  "o // ficou dentro da string aberta pela aspa da regex"
);
ok_(
  "e o texto de verdade depois dela continua a ser apontado",
  saidaRegex.includes("Conquistas"),
  "o auditor parou na regex: " + saidaRegex.trim().slice(0, 60)
);

// O `px` de `{settings.cardW || 184}px` nao e' interface: e' o valor de um
// numero. Sem esta regra o auditor aponta "px" duas vezes no Settings.jsx.
const SO_UNIDADE = `export default function P() {
  const w = 184;
  return (
    <label>
      <b>{w}px</b>
    </label>
  );
}
`;
ok_(
  "uma unidade CSS sozinha nao e' apontada como texto",
  !auditarCom({ "P.jsx": SO_UNIDADE }).includes("px")
);

// O marcador `// i18n` vale na linha de cima tambem: entre atributos de JSX o
// comentario tem de tar sozinho na linha, e e' ai que fica quando o achado e' um
// `className={...}`.
const COM_MARCADOR = `export default function M() {
  const ligado = true;
  return (
    <button
      // i18n: className e' codigo
      className={"ob-genero" + (ligado ? " on" : "")}
    >
      Apagar
    </button>
  );
}
`;
const saidaMarcador = auditarCom({ "M.jsx": COM_MARCADOR });
ok_(
  "o // i18n na linha de cima silencia o achado",
  !saidaMarcador.includes("+ (ligado"),
  saidaMarcador.trim().slice(0, 60)
);
// E tem de silenciar mesmo: o resto do ficheiro continua a ser auditado.
ok_("mas o resto do ficheiro continua a ser auditado", saidaMarcador.includes("Apagar"));

/* ---------- 6) MUTACOES: e' isto que da valor ao ficheiro ---------- */
// Cada mutacao parte um bocado do auditor. O ficheiro de teste tem de
// DEIXAR de apontar o texto misturado com cada uma delas — se continuasse a
// apontar, o teste passaria por acaso e nao provaria nada.

const auditorFonte = fs.readFileSync(AUDITOR, "utf8");

const MUTACOES = [
  // A ORIGINAL: a regex que apanha o texto de JSX excluia `{` do conjunto, e' o
  // bug inteiro. A mutacao volta a essa forma — e a mutacao tem de bater
  // certo na string, por isso a linha real esta' copiada do ficheiro.
  ["a regex volta a excluir `{` do texto de JSX",
   "const cand = /^>([^<>]*\\{[^<>]*)</.exec(resto);",
   "const cand = /^>([^<>{}][^<>{}]*)<.exec(resto);"],
  // O guarda das aspas: sem ele o ramo novo atravessa a chamada `t(...)` e
  // deixa o scanner dentro do objecto de valores.
  ["sem o guarda das aspas no ramo misto",
   "/[\"'`]/.test(cand[1]) ? cand : null",
   "cand"],
  // O salto do objecto de valores. Este so' muda o QUE e' apontado, nao SE e'
  // apontado, por isso a mutacao e' verificada pelo texto do achado.
  ["sem o salto do objecto de valores do t()",
   "fimDaChamada(codigo, k) - 1",
   "k"],
  // O `semExpressoes`: sem tirar as expressoes, o `{erro}` fica colado ao fim do
  // texto e o achado passa a trazer codigo dentro.
  ["semExpressoes nao tira as expressoes",
   "else if (dentro === 0) fora += ch;",
   "else fora += ch;"],
  // A regra de texto de UMA palavra: e' a que fecha o buraco mais recente.
  // (mutacao 2026-10-11: mais de 40 botoes por traduzir no ecra)
  ["a regra de texto de uma palavra desaparece",
   "(pareceTextoDeTag(texto) || pareceTexto(texto) || pareceFrase(texto))",
   "(pareceTexto(texto) || pareceFrase(texto))"],
// --- As 3 novas entradas e as 4 mutacoes novas do teste do auditor. ---
// Escrito num ficheiro a parte para nao passar pelo `edit` (que choca com o
// backtick do codigo do auditor) nem por aspas do PowerShell.
["semComentarios deixa de reconhecer strings",
 "if (c === '\"' || c === \"'\" || c === \"`\") {",
 "if (false) {"],
  // E a mesma forma, mas com uma REGEX: `/[",\n\r]/` tem uma aspa dentro, e sem
  // reconhecer regex essa aspa abre uma string que vai parar muito mais abaixo.
  ["semComentarios deixa de reconhecer regex",
 "if (c === \"/\" && abreRegex(codigo, i)) {",
 "if (false) {"],
  // A regra da unidade CSS: `184px` nao e' interface, e' o valor de um numero.
  ["uma unidade CSS volta a ser apontada",
 "if (/^(px|em|rem|ex|ch|vh|vw|vmin|vmax|pt|cm|mm|in|pc|ms|s|%)$/i.test(limpo)) {\n    return false;\n  }",
 ""],
  // O marcador `// i18n` na linha de cima. Entre atributos de JSX e' onde ele
  // pode tar: `className={...}` nao aceita um `//` no fim da linha.
  ["o marcador // i18n so vale na propria linha",
 "const marcada = (linha) => marcadas.has(linha) || marcadas.has(linha - 1);",
 "const marcada = (linha) => marcadas.has(linha);"],
];

console.log("");
for (const [nome, de, para] of MUTACOES) {
  if (!auditorFonte.includes(de)) {
    console.log("  FALHA MUTACAO IMPOSSIVEL (o codigo mudou): " + nome);
    falhou++;
    continue;
  }
  const partido = auditorFonte.replace(de, para);

  // 1) O texto MIX tem de deixar de ser visto. E' o bug original, entao e' o
  //    que as mutacoes tem de partir — com uma excecao declarada abaixo.
  const comValores = auditarCom({ "V.jsx": COM_VALORES }, partido);
  const semValores = auditarCom({ "Exemplo.jsx": COM_MIX }, partido);

  // O criterio e' o MESMO para as quatro: o auditor mutado tem de produzir uma
  // saida diferente da original em pelo menos um dos dois ficheiros de teste.
  // Sem isto, uma mutacao que nao muda nada passa como se fosse apanhada.
  //
  // Cada mutacao parte uma coisa diferente, por isso muda coisas diferentes:
  //   - a regex sem `\\{`        -> o `COM_MIX` deixa de ser visto
  //   - o guarda das aspas        -> o `COM_MIX` volta a dar falso positivo
  //   - o salto do objecto        -> o `COM_VALORES` da texto a `onde:`
  //   - o `semExpressoes`         -> o `COM_MIX` traz `{erro}` colado ao texto
  //   - sem reconhecer strings    -> o `COM_URL` deixa de chegar ao "Esconder"
  //   - sem reconhecer regex      -> o `COM_REGEX` deixa de chegar ao "Conquistas"
  //   - sem a regra do `px`       -> o `SO_UNIDADE` passa a ser apontado
  //   - marcador so na propria ln -> o `COM_MARCADOR` volta a apontar o className
  //
  // Os quatro ultimos nao se veriam nos tres primeiros ficheiros de teste, por
  // isso sao comparados aqui. Um mutation check que so olha para uma fixture
  // passa como se tivesse apanhado a mutacao.
  const base1 = auditarCom({ "Exemplo.jsx": COM_MIX });
  const base2 = auditarCom({ "V.jsx": COM_VALORES });
  const base3 = auditarCom({ "U.jsx": UMA_PALAVRA });
  const depois3 = auditarCom({ "U.jsx": UMA_PALAVRA }, partido);
  const base4 = auditarCom({ "X.jsx": COM_URL });
  const depois4 = auditarCom({ "X.jsx": COM_URL }, partido);
  const base5 = auditarCom({ "Y.jsx": COM_REGEX });
  const depois5 = auditarCom({ "Y.jsx": COM_REGEX }, partido);
  const base6 = auditarCom({ "P.jsx": SO_UNIDADE });
  const depois6 = auditarCom({ "P.jsx": SO_UNIDADE }, partido);
  const base7 = auditarCom({ "M.jsx": COM_MARCADOR });
  const depois7 = auditarCom({ "M.jsx": COM_MARCADOR }, partido);
  if (
    semValores === base1 &&
    comValores === base2 &&
    depois3 === base3 &&
    depois4 === base4 &&
    depois5 === base5 &&
    depois6 === base6 &&
    depois7 === base7
  ) {
    console.log("  FALHA MUTACAO NAO DETECTADA: " + nome);
    falhou++;
  } else {
    console.log("  OK    MUTACAO apanhada: " + nome);
    ok++;
  }
}

console.log("");
console.log("  " + ok + " ok, " + falhou + " falha(s)");
process.exit(falhou ? 1 : 0);