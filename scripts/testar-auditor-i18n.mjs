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
  const base1 = auditarCom({ "Exemplo.jsx": COM_MIX });
  const base2 = auditarCom({ "V.jsx": COM_VALORES });
  const base3 = auditarCom({ "U.jsx": UMA_PALAVRA });
  const depois3 = auditarCom({ "U.jsx": UMA_PALAVRA }, partido);
  if (semValores === base1 && comValores === base2 && depois3 === base3) {
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