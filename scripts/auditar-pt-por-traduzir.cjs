// Varre TODO o web/src a procura de texto de interface que nao passa por `t()`.
//
// ESTA E' A SEGUNDA VERSAO, e a razao dela e' umaauditoria que deu errado.
//
// A PRIMEIRA versao contava as palavras portuguesas de uma frase e exigia DUAS.
// Sounds razoavel — mas apanhou mal as frases de UMA palavra, que sao
// exactamente as que faltam: "Novidade", "Apagar", "Nota", "Voltar atrás". Com o
// limiar em 2 o auditor dava "nenhum texto por traduzir" e havia ~45 a faltar.
// Por isso o limiar e' 1, e a filtragem passou a ser por FORMA do codigo em vez
// de por contagem de palavras.
//
// O que mudou, e porque:
//   - Trabalha sobre o ficheiro INTEIRO como uma string (comentarios
//     apagados mas com o mesmo numero de caracteres), e nao linha a linha. E'
//     o que deixa ver texto de JSX partido por varias linhas — o caso mais
//     comum de fuga, porque `>` numa linha nao fecha com `<` na mesma.
//   - Reconhece os literais de string pelos delimitadores, e so' os aceita
//     como "ja' traduzidos" quando o `(` do `t(` esta' imediatamente antes.
//     Antes era por linha, e um `t(` na linha de cima nao era visto.
//   - Descarta `key=`, `id=`, `to=`, `data-*`, `className=` e tipo
//     semelhante: nao sao texto, ainda que tenham palavras portuguesas.
//
// A palavra "nao" e' a isca mais comum (esta' em "nao", "so", "ha"), por isso o
// dicionario tem entradas que sao codigo, nao interface, e sao ignoradas.
const fs = require("node:fs");
const path = require("node:path");

const RAIZ = process.cwd();
const SRC = path.join(RAIZ, "web/src");

// Palavras que so' existem em portugues (ou que em ingles mudam). Uma frase de
// interface que as traga nao esta' traduzida.
const PT = /\b(que|de|do|da|dos|das|para|com|sem|não|nao|vai|foi|ser|está|esta|estão|sao|mais|menos|agora|aqui|onde|quando|qual|isto|meu|minha|teu|tua|ao|aos|pelo|pela|até|até|já|só|apenas|entrar|abrir|carregar|procurar|escolher|escolhe|escolhi|adicionar|remover|apagar|guardar|voltar|continuar|terminar|visto|vistos|lista|nenhum|nada|erro|falhou|ligado|desligado|perfil|biblioteca|diário|conquistas|definições|estatísticas|filmes|séries|anime|episódio|comentário|comentários|nota|notas|comédia|terror|ficção|científica|música|família|história|documentário|aventura|animação|fantasia|mistério|guerra|faroeste|ação|atrás|agora mesmo|legendas|legenda|gostar|respost|partilha|partilhar|privado|ficheiro|ficheiros|computer|imagem|estatística|conteúdo|conteudos|recentes|mais novas|recomendar|a procurar|versão|perfil atualizado|concluído|transf|segundos|minuto|dia|dias|hora|horas|semana|semanas|carregando|descarreg|vazio|vazia|cancelar|renomear|nova|volta|atualiz|desligad|ligad|guardar|terminar|terminou|comentário)\b/i;

// Atributos cujo valor NAO e' texto visivel (mesmo que tenha palavras).
const NAO_E_TEXTO = [
  /^key=/, /^id=/, /^to=/, /^path=/, /^href=/, /^src=/, /^type=/,
  /^name=/, /^data-/, /^className=/, /^style=/, /^htmlFor=/, /^value=/,
  /^autoComplete=/, /^inputMode=/, /^method=/, /^action=/, /^formAction=/,
  // Atributos de SVG e de seguranca. `d="M12 2c-2 2-4 4..."` e' a geometria
  // de um caminho do SVG e tem duas palavras que parecem texto; `rel="noopener
  // noreferrer"` e' uma palavra-chave para o browser, nao interface.
  /^d=/, /^points=/, /^viewBox=/, /^rel=/, /^target=/, /^accept=/,
  /^charset=/, /^role=/, /^tabIndex=/, /^colSpan=/, /^rowSpan=/,
];

// Valores que aparecem em codigo e nao sao interface: rotas, URLs, seletores,
// nomes de ficheiro, cores, estados.
const NAO_E_ESTRUTURA = [
  /^https?:/i, /^[/#.]/, /^[a-z0-9]+:[a-z-]+/i,     // rota, data:, blob:, #id
  /^[a-z-]+:[a-z-]+$/i,                                // selector CSS
  /^#[0-9a-f]{3,8}$/i, /^rgba?\(/i,                    // cor
  /^[a-z]+(\.[a-z-]+)+$/i,                             // a.b.c
  /^[A-Z0-9_]+$/,                                      // CONSTANTE
  /^[a-z0-9_-]+\.(js|jsx|css|json|mjs|cjs|txt|md)$/i, // ficheiro
  /^[\w.-]+@[\w.-]+$/,                                 // email
];

/** Apaga comentarios mas mantem o numero de caracteres (para os indices
 *  baterem certo com o ficheiro original). */
function semComentarios(codigo) {
  let saida = "";
  let i = 0;
  const n = codigo.length;
  while (i < n) {
    const dois = codigo.slice(i, i + 2);
    if (dois === "//") {
      while (i < n && codigo[i] !== "\n") { saida += " "; i++; }
    } else if (dois === "/*") {
      saida += "  "; i += 2;
      while (i < n && codigo.slice(i, i + 2) !== "*/") {
        saida += codigo[i] === "\n" ? "\n" : " "; i++;
      }
      saida += "  "; i += 2;
    } else {
      saida += codigo[i]; i++;
    }
  }
  return saida;
}

/**
 * O `(` do `t(` esta' imediatamente antes da aspa de abertura?
 *
 * Aceita tambem `tSeguro(`: o `ErrorBoundary` e' uma `class` e nao pode usar o
 * `useT()`, por isso traduz com `this.tSeguro("...")` — que e' o MESMO tradutor,
 * so' que nunca lanca (um boundary que lanca ao mostrar o erro faz o React
 * desmontar a app toda: foi o ecra em branco que um utilizador reportou).
 *
 * Sem esta segunda forma, o auditor apontava as duas linhas do boundary como
 * "por traduzir" — e a resposta obvia (mudar `tSeguro` para `t`) reintroduzia
 * exatamente o bug. O nome e' o que distingue, por isso e' no nome que se olha.
 */
function dentroDeT(codigo, pos) {
  let j = pos - 1;
  while (j >= 0 && /\s/.test(codigo[j])) j--;
  if (codigo[j] !== "(") return false;
  if (codigo[j - 1] === "t") return true;
  return /\w?tSeguro$/.test(codigo.slice(0, j));
}

/**
 * O nome do atributo em que a string esta', ou `null` se nao esta' em nenhum.
 *
 * Distingue os dois casos que o `\b` do dicionario nao distingue: "muted
 * st-vazio" dentro de `className=` nao e' texto, mas "a mais baixa" como texto
 * de JSX (o fragmento de uma frase partida por um `<strong>`) e'. Nenhum dos
 * dois se distingue so' pelo texto, por isso a decisao e' pelo atributo.
 */
function nomeAtributo(codigo, pos) {
  let j = pos - 1;
  while (j >= 0 && (/\s/.test(codigo[j]) || codigo[j] === "{")) j--;
  if (codigo[j] === "=") {
    j--;
    while (j >= 0 && /\s/.test(codigo[j])) j--;
  }
  const m = /([A-Za-z-]+)$/.exec(codigo.slice(Math.max(0, j - 40), j + 1));
  return m ? m[1] : null;
}

/**
 * Onde acaba o `{...}` que comeca em `pos` (chaves equilibradas, ignorando
 * aspas). Devolve o indice logo DEPOIS do `}` de fecho.
 *
 * Serve para saltar `className={...}`, `key={...}` e companhia: um
 * template literal dentro de `className={"gm-barra " + (v ? "vazia" : "")}`
 * contem palavras portuguesas e nao e' texto de interface. Sem isto o auditor
 * apontava uma classe CSS como se fosse uma frase por traduzir.
 */
function fimDaExpressao(codigo, pos) {
  let nivel = 0;
  let i = pos;
  while (i < codigo.length) {
    const c = codigo[i];
    if (c === "{") nivel++;
    else if (c === "}") { nivel--; if (nivel === 0) return i + 1; }
    else if (c === '"' || c === "'" || c === "`") {
      const delim = c;
      i++;
      // O conteudo de um template salta inteiro, `${...}` incluido: e' codigo,
      // nao texto, e o `${}` ja' tem as chaves equilibradas dentro de si.
      while (i < codigo.length && codigo[i] !== delim) {
        if (codigo[i] === "\\") i++;
        i++;
      }
    }
    i++;
  }
  return codigo.length;
}

/** Este `{` abre a expressao de um atributo que nao e' texto? */
function expressaoNaoTextual(codigo, pos) {
  let j = pos - 1;
  while (j >= 0 && /\s/.test(codigo[j])) j--;
  if (codigo[j] !== "{") return false;
  j--;
  while (j >= 0 && /\s/.test(codigo[j])) j--;
  const m = /([A-Za-z-]+)$/.exec(codigo.slice(Math.max(0, j - 30), j + 1));
  if (!m) return false;
  return NAO_E_TEXTO.some((r) => r.test(m[1] + "="));
}

/**
 * O texto ESTATICO de um template literal: as partes fora de `${...}`.
 *
 * Sem isto, um `className={`gm-barra ${b.n === 0 ? "vazia" : ""}`} ` era lido
 * como uma frase em portugues. E' o caso comum nos falsos positivos: o que esta'
 * dentro de `${}` e' codigo, e codigo nao se traduz.
 */
function textoEstatico(valor) {
  return valor
    .replace(/\$\{[^}]*\}/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** O atributo onde We're' esta string e' um de interface (title, aria-*, ...)? */
function ehAtributoDeTexto(codigo, pos) {
  const nome = nomeAtributo(codigo, pos);
  return nome !== null && !NAO_E_TEXTO.some((r) => r.test(nome + "="));
}

function ficheiros(dir, acc = []) {
  const norm = dir.replace(/\\/g, "/");
  // `i18n/` fica de fora: e' o DICIONARIO, onde o texto em portugues e' o
  // esperado (sao as chaves). Inclui-lo daria cientos de falsos positivos.
  // `changelog.js` tambem: o texto e' de uma versao especifica.
  if (norm.includes("/web/src/i18n")) return acc;
  for (const nome of fs.readdirSync(dir)) {
    const p = path.join(dir, nome);
    if (fs.statSync(p).isDirectory()) ficheiros(p, acc);
    else if (/\.jsx?$/.test(nome) && !/changelog|__/.test(nome)) acc.push(p);
  }
  return acc;
}

/** O candidato parece texto de interface? */
/**
 * O candidato e' uma PALAVRA dentro de uma tag (`<h2>Conquistas</h2>`)?
 *
 * E' uma terceira regra, e a que faltava. Entre `>` e `<` nao ha' codigo: o que
 * esta' la dentro e' interface, ponto. Por isso aqui NAO se pode usar o filtro
 * de identificadores do `pareceTexto` (uma palavra so' e' indistinguivel de um
 * identificador) nem exigir duas palavras como o `pareceFrase`.
 *
 * Sem esta regra, o texto de uma palavra so' NUNCA era apontado — e' o caso mais
 * facil de esquecer e o que mais pesa na interface: "Conquistas", "Apagar",
 * "Cancelar", "Utilizador", "Entrar", "Acabou", "Todas", "Desligar", "vistos".
 * O auditor dizia "limpo" com mais de 40 botoes por traduzir no ecra.
 *
 * O filtro que sobra e' o de estrutura (`NAO_E_ESTRUTURA`) mais duas ressalvas
 * que a experiencia manda a pe: o `VS` dos titulos (igual nos dois idiomas) e
 * o texto todo em maiusculas dos carimbos (`NOVO`), que ja' esta' em
 * `IGUAIS_ESPERADOS` no dicionario.
 */
function pareceTextoDeTag(texto) {
  const limpo = texto.trim();
  if (limpo.length < 2) return false;
  if (NAO_E_ESTRUTURA.some((r) => r.test(limpo))) return false;
  // Caracteres de JavaScript que um texto de interface nao tem. A lista e'
  // propositadamente larga: e' melhor deixar passar um texto com parenteses do
  // que aceitar `cmpVersion(c.version, inicial)` e `) : other ? (`, que e' o
  // que acontece quando so' se exclui o `=>`.
  //
  // A razao de ser tao restritiva: entre `>` e `<` o scanner pode estar a ler
  // o fecho de uma expressao (`{cond && <p>Texto</p>}` — o `>` do `&&` abre um
  // "texto" que e' codigo). Como nao da' para distinguir essa abertura da
  // verdadeira, o filtro tem de ser do lado de "isto e' codigo".
  if (/[(){}?&=;|!+*]|\.\w/.test(limpo)) return false;
  // So' numeros, pontuacao ou simbolos ("2024", "·", "✕", "↓").
  if (!/[A-Za-zÀ-ÿ]/.test(limpo)) return false;
  if (/^[\d\s.,:·|/\\-]+$/.test(limpo)) return false;
  return true;
}

function pareceTexto(v) {
  const limpo = v.trim();
  if (limpo.length < 2) return false;
  if (/^[a-zA-Z0-9_-]+$/.test(limpo)) return false;           // identificador
  if (NAO_E_ESTRUTURA.some((r) => r.test(limpo))) return false;

  // Caracteres de codigo. Uma frase de interface pode ter parenteses
  // ("Escreve 2:05"), mas nao tem `=>`, `;`, `{`, `}` nem `=`. E' o que separa o
  // texto de JSX do codigo em volta dele quando o scanner perde o sitio: o que
  // resta da linha vem como `} onClick={() => setX(v)} > {children} </button>`,
  // que tem palavras portuguesas mas nao e' nada para traduzir.
  if (/=>|[;{}=]/.test(limpo)) return false;

  // A palavra portuguesa e' o que decide, e a conferencia vem ANTES da de
  // "isto e' um identificador": muitos textos de interface sao uma palavra so'
  // — "Nota", "Lista", "Diario", "Visto" — e uma regra que descartasse
  // identificadores descartaria o texto mais curto, que e' o mais facil de
  // esquecer. E' por isso que o texto mais curto nao e' uma palavra isolada e
  // sim uma expressao.
  if (!new RegExp(PT, "i").test(limpo)) return false;

  // So' numeros e pontuacao ("1 h", "125 segundos").
  if (/^[\d\s.,:]+$/.test(limpo)) return false;
  return true;
}

/**
 * O candidato parece uma FRASE, e nao um fragmento de codigo?
 *
 * E' a segunda regra do auditor, e existe porque a primeira — a lista de
 * palavras portuguesas — tem um buraco que so' se descobre por mutacao:
 * "Usar URL", "Ecra inteiro", "Criar sala" e "Procurar por filtros" nao tem
 * NENHUMA palavra da lista. Com so' a primeira regra, uma frase desses ficava
 * por traduzir e o auditor dizia "limpo".
 *
 * No texto de JSX e nos atributos de texto (`title`, `aria-label`,
 * `placeholder`, `alt`), DUAS palavras e' praticamente sempre interface: e' o
 * que se mostra a quem usa a app. Um `return` ou um `} : (` tem caracteres de
 * codigo, e e' o que separa um do outro.
 */
function pareceFrase(texto) {
  const limpo = texto.trim();
  if (limpo.length < 4) return false;
  // Uma frase de interface pode ter parenteses ("Escreve 2:05") ou dois-pontos
  // ("Aviso: ..."), por isso a lista de caracteres de codigo e' curta: so' o que
  // um fragmento de JavaScript traz quase sempre.
  if (/=>|[;{}=()|?&<>]/.test(limpo)) return false;
  // Uma virgula a terminar o texto e' o rasto de um objeto de argumentos que
  // o scanner leu a partir do sitio errado: `{ logo: <b>logo</b> }` de uma
  // frase com markup chegava aqui como ", logo:" ou "logo,".
  if (/,\s*$/.test(limpo)) return false;
  // `chave:` e' uma propriedade de objecto, nao texto. Com ou sem virgula a
  // esquerda, com ou sem ponto e virgula a direita — `, logo:` e' o caso real.
  if (/(^|,)\s*\w+\s*:/.test(limpo)) return false;
  if (!/[A-Za-zÀ-ÿ]{2}/.test(limpo)) return false;
  return limpo.split(/\s+/).filter(Boolean).length >= 2;
}

/**
 * O mesmo, mas para os ATRIBUTOS de texto, com o filtro mais frouxo.
 *
 * Uma cadeia de caracteres que ja' esta' no sitio de um `title` ou de um
 * `placeholder` e' interface por definicao. Por isso aqui nao se excluem
 * parenteses: "Escreve 2:05 (ou 125)" e' uma frase legitima e ficava de fora
 * com o filtro apertado. So' se exclui o que nunca e' interface.
 */
function pareceFraseDeAtributo(texto) {
  const limpo = texto.trim();
  if (limpo.length < 4) return false;
  if (/=>|[;{}=]/.test(limpo)) return false;
  if (/,\s*$/.test(limpo)) return false;
  if (/(^|,)\s*\w+\s*:/.test(limpo)) return false;
  if (!/[A-Za-zÀ-ÿ]{2}/.test(limpo)) return false;
  return limpo.split(/\s+/).filter(Boolean).length >= 2;
}

/** O indice do primeiro caractere da linha onde esta' `pos`. */
function linhaInicio(codigo, pos) {
  const i = codigo.lastIndexOf("\n", pos - 1);
  return i + 1;
}

/**
 * A crase na posicao `pos` e' de FECHO (ou seja, estamos dentro de um template
 * que foi aberto antes)?
 *
 * Um numero IMPAR de crases antes dela, na mesma linha, significa que ha uma
 * aberta sem fecho: a crase de `pos` fecha-a. Um numero par significa que e'
 * uma abertura.
 *
 * Exemplo, em `<h1 className={`hero-title ${x}`}>`: a crase que fecha o
 * template tem uma crase aberta antes dela na mesma linha. O scanner chega
 * aqui porque o `className={` foi saltado como atributo, e sem este teste a
 * crase de fecho lia-se ate a abertura seguinte — 50 linhas mais abaixo em
 * `Hero.jsx`, e o auditor perdia "Reproduzir" e "Mais info".
 */
function dentroDeTemplate(codigo, pos) {
  let crases = 0;
  const inicio = linhaInicio(codigo, pos);
  for (let i = inicio; i < pos; i++) if (codigo[i] === "`") crases++;
  return crases % 2 === 1;
}



/**
 * `{algo.label}` sem `t()` a volta.
 *
 * Os arrays de separadores (`TABS`, `SORTS`) sao de nivel de modulo e guardam o
 * texto em portugues como chave; traduzir na definicao nao da, porque la nao ha
 * `useT()`. Este auditor, a proposito, NAO aponta essas chaves — mas entao
 * nada pegava em quem se lembrasse de traduzir na definicao e secesse de
 * traduzir no `{algo.label}`. E' esse buraco que fecha aqui.
 */
function rotuloSemTraducao(texto) {
  const m = /\{\s*([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\.label\s*\}/.exec(texto);
  if (!m) return null;
  const antes = texto.slice(Math.max(0, m.index - 4), m.index);
  return /t\(\s*$/.test(antes) ? null : m[0];
}

/**
 * Tira as expressoes `{...}` de um texto de JSX, e so' o que resta.
 *
 * Isto e' o que fecha o buraco do "texto misturado com expressao": em
 * `<p>A preparar {erro}</p>` o texto visivel e' "A preparar" e o `{erro}` nao
 * se traduze. A regex que apanha o texto de JSX parava no `{` (estava na lista
 * de caracteres excluidos) e nao via nada — por isso
 * "Debrid indisponivel, a tocar via torrent local" ficou por traduzir com o
 * auditor a dizer "limpo".
 *
 * O contador de `{`/`}` e' que_depth e nao um `split` por regex: dentro de uma
 * expressao pode haver objectos aninhados (`{a && {b: 1}}`) e um `/\{[^{}]*\}/`
 * apagava o de fora e deixava o de dentro, que nao e' texto nenhum.
 */
function semExpressoes(texto) {
  let fora = "";
  let dentro = 0;
  for (const ch of texto) {
    if (ch === "{") dentro++;
    else if (ch === "}") dentro--;
    else if (dentro === 0) fora += ch;
  }
  return fora;
}

/**
 * Onde acaba a chamada `t(...)` que opened antes de `pos`, contando parenteses
 * e saltando aspas. Devolve o indice logo DEPOIS do `)`.
 */
function fimDaChamada(codigo, pos) {
  let nivel = 1; // o `(` do `t(` ja esta aberto
  let chaves = 0;
  let i = pos;
  while (i < codigo.length) {
    const c = codigo[i];
    if (c === '"' || c === "'" || c === "`") {
      const delim = c;
      i++;
      while (i < codigo.length && codigo[i] !== delim) {
        if (codigo[i] === "\\") i++;
        i++;
      }
    } else if (c === "{") chaves++;
    else if (c === "}") chaves--;
    else if (c === "(") nivel++;
    else if (c === ")") {
      // As DUAS profundidades contam. Um `)` dentro de `{ ... }` e' o fecho de
      // um `t()` aninhado no objecto de valores — `{ a: <b>{t("x")}</b> }` — e
      // nao o fecho da chamada que estamos a saltar. Contar so' os parenteses
      // devolvia a posicao errada e o scanner voltava a descer para dentro do
      // objecto, que e' exactamente o buraco que este salto veio fechar.
      if (chaves === 0) {
        nivel--;
        if (nivel === 0) return i + 1;
      }
    }
    i++;
  }
  return codigo.length;
}

const suspeitas = [];
const vistas = new Set();

for (const abs of ficheiros(SRC)) {
  const rel = path.relative(RAIZ, abs);
  const codigo = semComentarios(fs.readFileSync(abs, "utf8"));
  const nLinha = (pos) => codigo.slice(0, pos).split("\n").length;

  // Linhas marcadas com `// i18n` sao texto em portugues DELIBERADO: sao a
  // chave do dicionario (o mapa de generos em `profileStats.js`, os textos
  // de `tempo.js`) ou um valor que se traduz no momento de mostrar. O marcador
  // fica no codigo, e nao numa lista do auditor, para ninguem os "arranjar" sem
  // ver que a traducao ja la esta.
  const marcadas = new Set();
  fs.readFileSync(abs, "utf8").split(/\r?\n/).forEach((l, i) => {
    if (/\/\/\s*i18n\b/.test(l)) marcadas.add(i + 1);
  });
  const marcada = (linha) => marcadas.has(linha);

  for (let i = 0; i < codigo.length; i++) {
    const c = codigo[i];

    // --- `{algo.label}` sem `t()` a volta ---
    // Este ramo tem de TRES coisas diferentes, e confundir uma com outra
    // custou uma auditoria inteira (todos os testes de mutacao pararam de
    // ver texto, porque o `{` estava a saltar a expressao em vez de descer):
    //   1) `{...}` de um atributo que NAO e' texto — saltar por cima;
    //   2) `{algo.label}` em JSX, sem `t()` — apontar;
    //   3) qualquer outro `{...}` — DESCER, porque e' o que faz o scanner
    //      encontrar o texto de JSX e as strings que estao dentro
    //      (`{loading && <p>A procurar</p>}`).
    if (c === "{") {
      // O `{ useEffect, useRef }` de um `import` nao e' JSX nem expressao de
      // atributo: e' uma lista de nomes. Sem este teste o `fimDaExpressao`
      // saltava a linha toda e o ficheiro ficava por auditar a partir do
      // primeiro import — em `Hero.jsx` perdia-se o ficheiro inteiro, e o
      // auditor dizia "limpo" com "Reproduzir" a mostra.
      if (/^\{\s*[A-Za-z_$][\w$,\s]*\}\s*(\}\s*)?(from\s*)?["'`]?/.test(codigo.slice(i, i + 120))) {
        i++;
        continue;
      }

      if (expressaoNaoTextual(codigo, i)) {
        // `${...}` DENTRO de um template literal nao e' a expressao do
        // atributo: e' uma interpolacao. Sem este teste, o `{` de
        // `` `hero-title ${titleSize(current.title)}` `` era lido como o valor
        // de `className=` e o `fimDaExpressao` saltava ate ao `}` seguinte —
        // que era o do `{current.title}` mais a linha, e o scan perdia-se.
        // Foi o que travava o auditor em `Hero.jsx` na linha 127.
        if (dentroDeTemplate(codigo, i)) { i++; continue; }
        i = fimDaExpressao(codigo, i) - 1;
        continue;
      }

      // Destructuring e' o falso positivo principal: `{ subtitles = [] }`
      // dentro dos parenteses dos argumentos de uma funcao. Como pode estar
      // partido por varias linhas, decide-se pela LINHA: so' interessa quando o
      // `{` esta' dentro de JSX, ou seja na mesma linha que um `return` ou um
      // `>` de abertura de elemento.
      const inicio = linhaInicio(codigo, i);
      const antes = codigo.slice(inicio, i);
      if (/>[^\n]*$/.test(antes) || /\breturn\b[^\n]*$/.test(antes)) {
        const semTrad = rotuloSemTraducao(codigo.slice(i, fimDaExpressao(codigo, i)));
        if (semTrad && !marcada(nLinha(i + 1))) {
          suspeitas.push({ rel, linha: nLinha(i + 1), texto: semTrad });
        }
      }

      i++;
      continue;
    }

    // --- Texto de JSX: `>palavra palavra<` ---
    if (c === ">") {
      const resto = codigo.slice(i);
      // Dois formatos, porque o segundo (texto + expressao) e' o que faltava:
      //   misturado — `>A preparar {erro}<`  (tem de apanhar `{`)
      //   simples   — `>Reproduzir<`         (o que ja funcionava)
      // A ordem importa: o primeiro e' mais especifico e o segundo exclui `{`.
      const cand = /^>([^<>]*\{[^<>]*)</.exec(resto);
      // O `misto` so' vale se o texto NAO trouxer aspas. Com aspas, o scanner
      // atravessou uma string e nao esta' em texto de JSX: em
      // `>{"...frase..." , { a: <b>` a chave `{a}` da frase faz o padrao
      // fechar no `<` do `<b>`, e o salto deixava o scanner A DENTRO do objecto
      // de valores do `t()` — sem esta proteccao, os `chave:`/`onde:` eram lidos
      // como texto. Sem este guarda nao se desce, e o ramo do `{` trata a
      // chamada como deve ser.
      const misto = cand && !/["'`]/.test(cand[1]) ? cand : null;
      const simples = /^>([^<>{}"'`/]{2,})</.exec(resto);
      const m = misto || simples;
      if (m) {
        const bruto = misto ? semExpressoes(m[1]) : m[1];
        const texto = bruto.replace(/\s+/g, " ").trim();
        // Duas regras: a palavra portuguesa (apanha "Novidade", "Nota") e a
        // forma de frase (apanha "Usar URL", "Criar sala"). Ver `pareceTexto`
        // e `pareceFrase`.
        if (
          texto &&
          (pareceTextoDeTag(texto) || pareceTexto(texto) || pareceFrase(texto)) &&
          !marcada(nLinha(i + 1)) &&
          !vistas.has(rel + ":jsx:" + i)
        ) {
          vistas.add(rel + ":jsx:" + i);
          suspeitas.push({ rel, linha: nLinha(i + 1), texto: texto.slice(0, 74) });
        }
        i += m[0].length - 1;
      }
      continue;
    }

    // --- Literais de string ---
    // `import ... de "./ficheiro"`: o ponto-e-virgula ANTES da aspa diz que a
    // anterior ja foi fechada. Sem este teste, a aspa de um import era tomada
    // pelo inicio de uma string que nunca mais fechava, e o ficheiro ficava
    // por auditar a partir dai — todo o resto de `Hero.jsx` escapava, e o
    // auditor dizia "limpo". Foi o que aconteceu: "Reproduzir" e "Mais info"
    // estavam no ecra em portugues com o auditor a passar.
    if (c !== '"' && c !== "'" && c !== "`") continue;

    // Uma crase de FECHO de um template literal nao abre string nenhuma. O
    // scan chega aqui porque o `className={` que abriu o template foi
    // saltado como atributo que nao e' texto, e a crase de fecho ficou orfa.
    // Sem este teste ela lia-se ate a crase seguinte — em `Hero.jsx`, da
    // linha 127 a 176, e perdia-se "Reproduzir" e "Mais info".
    if (c === "`" && dentroDeTemplate(codigo, i)) { i++; continue; }

    let j = i + 1;
    let valor = "";
    while (j < codigo.length && codigo[j] !== c) {
      if (codigo[j] === "\\") { valor += codigo[j] + codigo[j + 1]; j += 2; continue; }
      if (c !== "`" && codigo[j] === "\n") break;   // string de uma linha so'
      valor += codigo[j]; j++;
    }
    if (codigo[j] !== c) {
      // Fechou em outra linha: e' a aspa de fecho de um import (ou de um
      // `export ... de "x"`). Nao ha nada a apontar aqui.
      i++;
      continue;
    }

    const chave = rel + ":str:" + i;
    if (vistas.has(chave)) { i = j; continue; }

    // Ja' traduzido? `t("...")`, ou a chave de um `case`/comparacao.
    //
    // E se depois da string vier um `{`, a string e' a CHAVE de um
    // `t("...", { valores })` e temos de saltar a chamada toda. Sem isto o
    // scanner descia para dentro do objecto de valores e lia o JSX que la
    // vive (`<code>EXTRACTOR_API_BASE</code>`) como se fosse texto: o `>` de
    // fecho de `<code>` era tomado por abertura de texto de JSX e apanhava o
    // `chave:` da propriedade seguinte como "frase portuguesa".
    //
    // So' se salta quando o `e' mesmo objecto de valores. Num
    // `t(cond ? "A" : "B")` nao ha `{` a seguir e os dois ramos continuam a ser
    // auditados — que e' o que se quer, sao as duas chaves do dicionario.
    if (dentroDeT(codigo, i)) {
      let k = j + 1;
      // A virgula entre argumentos tambem tem de ser saltada: e' `t("...", {` e
      // nao `t("..."` seguido de outra coisa.
      while (k < codigo.length && (/\s/.test(codigo[k]) || codigo[k] === ",")) k++;
      if (codigo[k] === "{") {
        i = fimDaChamada(codigo, k) - 1;
        continue;
      }
      i = j;
      continue;
    }

    // Valor de um atributo que NAO e' texto: `className`, `key`, `id`, `to`,
    // `data-*`... A string pode ter palavras portuguesas (`className="muted
    // st-vazio"`) e continua a nao ser interface.
    const attr = nomeAtributo(codigo, i);
    if (attr && NAO_E_TEXTO.some((r) => r.test(attr + "="))) { i = j; continue; }

    // `label: "Séries"` numa propriedade de objecto e' uma CHAVE, nao texto: os
    // arrays de separadores (`TABS`, `SORTS`) sao de nivel de modulo, onde nao
    // ha `useT()`, e guardam a chave em portugues; traduz-se no momento de
    // mostrar, em `{t(x.label)}`. Um atributo JSX seria `label="..."` (com
    // igual), e esse sim e' texto a mostrar — por isso a distincao e' o `:`.
    if (/label\s*:\s*$/.test(codigo.slice(Math.max(0, i - 12), i))) { i = j; continue; }

    // Num template literal so' interessa o texto estatico: o que esta' dentro
    // de `${...}` e' expressao, e expressao nao se traduz.
    const texto = c === "`" ? textoEstatico(valor) : valor.trim();

    // Os argumentos de um `t("...", { chave: valor })` sao codigo. Sem este
    // teste, o `{ logo: <b>logo</b> }` de uma frase com markup era lido como
    // texto ("logo,") e apontado como por traduzir.
    if (/^\w+\s*:/.test(texto)) { i = j; continue; }

    // Token solto sem acentos nem espaco: e' identificador, chave ou valor.
    // So' quando NAO tem palavra portuguesa — ver `pareceTexto`.
    if (attr === null && /^[\w.:-]+$/.test(texto) && !new RegExp(PT, "i").test(texto)) {
      i = j; continue;
    }

    // Num atributo de texto (`title`, `aria-label`, `placeholder`, `alt`), DUAS
    // palavras e' interface quase certo. Noutro sitio nao se aplica: uma string
    // de codigo com duas palavras (`"formato grande"`) pode ser um valor de
    // dados, e nao vale a pena chatear com esses.
    const emAtributoDeTexto = ehAtributoDeTexto(codigo, i);
    if (
      (pareceTexto(texto) ||
        (emAtributoDeTexto && (pareceFraseDeAtributo(texto) || rotuloSemTraducao(texto)))) &&
      !marcada(nLinha(i + 1))
    ) {
      vistas.add(chave);
      suspeitas.push({ rel, linha: nLinha(i + 1), texto: texto.slice(0, 74) });
    }
    i = j;
  }
}

if (!suspeitas.length) {
  console.log("  nenhum texto por traduzir em todo o web/src");
  process.exit(0);
}

console.log("  " + suspeitas.length + " linhas com possivel texto por traduzir:");
for (const s of suspeitas) {
  console.log("    " + s.rel + " L" + s.linha + ": " + s.texto);
}
process.exit(1);