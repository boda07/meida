// Logica das "@mencoes" nos comentarios, sem React e sem DOM.
//
// Porque um ficheiro separado: e' a parte com regras (quando aparece a lista, o
// que e' um username valido, onde acaba a mencao) e ja falhou varias vezes o que
// estava no meio do componente sem ninguem ver. Testada em
// scripts/testar-mencoes.mjs.
//
// O que o Discord/TikTok/Instagram fazem, e o que aqui se copia: escreve-se @,
// aparece uma lista, escolhe-se com o teclado, e o nome fica escrito no texto.
// O texto continua a ser texto plano — a base de dados guarda a string, nao
// markup.

// usernames da app: letras, numeros, ponto, underscore e hifen. O `-` no fim
// nao entra, para "@fulano," contar como "@fulano".
const USERNAME = /^[A-Za-z0-9._-]+$/;

/**
 * O pedaco de mencao que esta a ser escrito na posicao do cursor.
 *
 * Devolve `null` se nao houver nenhuma — que e' o caso comum e o que torna
 * este sitio sensivel a falsos positivos. Regras:
 *  - tem de haver um `@` imediatamente antes do texto (ou no inicio da linha);
 *  - entre o `@` e o cursor so pode haver caracteres de username;
 *  - o `@` tem de estar no inicio, ou precedido por espaco ou porBeginning de
 *    pontuacao. "@" a meio de uma palavra ("a@b.com") nao e' mencao.
 *  - um username comecado por ponto nao vale ("@.hidden").
 *
 * @param {string} texto
 * @param {number} cursor posicao do cursor no texto
 * @returns {{query:string, start:number}|null}
 */
export function mencaoEmCurso(texto, cursor) {
  if (typeof texto !== "string") return null;
  const at = Math.max(0, Math.min(Number(cursor) || 0, texto.length));
  // Recua do cursor ate ao '@' mais proximo. Nao vale a pena procurar mais que
  // ~40 caracteres: um username nunca precisa tanto, e um "@" muito atras e'
  // de outro assunto.
  for (let i = at - 1; i >= 0 && at - i <= 40; i--) {
    const ch = texto[i];
    if (ch === "@") {
      const antes = i === 0 ? "" : texto[i - 1];
      // '@' so conta no inicio ou depois de espaco/pontuacao.
      if (i > 0 && /[A-Za-z0-9._-]/.test(antes)) return null;
      const query = texto.slice(i + 1, at);
      // Uma query vazia e' o caso normal logo apos escrever o '@': a lista tem de
      // aparecer imediatamente, a mostrar toda a gente. Por isso o `*` em vez de
      // `+` — com `+`, o "@" sozinho nao abria nada e a pessoa via que estava
      // partido.
      if (!USERNAME.test(query) && query !== "") return null;
      if (query.startsWith(".")) return null;
      return { query, start: i };
    }
    // Caractere que nao pode fazer parte de um username: a mencao acabou.
    if (!/[A-Za-z0-9._-]/.test(ch)) return null;
  }
  return null;
}

/**
 * Onde escrever o `@username` escolhido, e o texto que fica.
 *
 * Replace de `start` ate ao cursor. Mantem um espaco a seguir, porque sem ele
 * "@fulanotexto" nao volta a aparecer a lista e a pessoa fica a escrever o
 * resto colada ao nome.
 *
 * @param {string} texto
 * @param {number} cursor
 * @param {string} username
 * @returns {{texto:string, cursor:number}}
 */
export function insereMencao(texto, cursor, username) {
  const m = mencaoEmCurso(texto, cursor);
  const at = m ? m.start : Math.max(0, Math.min(Number(cursor) || 0, texto.length));
  const antes = texto.slice(0, at);
  const depois = texto.slice(Math.max(0, Math.min(Number(cursor) || 0, texto.length)));
  const pedaco = `@${username} `;
  return { texto: `${antes}${pedaco}${depois}`, cursor: antes.length + pedaco.length };
}

/**
 * Divide o corpo do comentario em pedacos para desenhar: texto normal e
 * mencoes (que vao como link para o perfil).
 *
 * Nao devolve HTML — o React escapa tudo, e um link e' um elemento, nao uma
 * string. Por isso o consumidor tem de tratar cada pedaco.
 *
 * @param {string} body
 * @returns {Array<{tipo:"texto"|"mencao", texto:string}>}
 */
export function pedacosComMencoes(body) {
  if (typeof body !== "string" || !body) return [];
  const re = /(^|[\s,.;:!?()[\]{}"'])(@[A-Za-z0-9][A-Za-z0-9._-]{0,39})/g;
  const pedacos = [];
  let ultimo = 0;
  let m;
  while ((m = re.exec(body)) !== null) {
    // O grupo 1 e' o separador, que pertence ao texto anterior.
    const inicio = m.index + m[1].length;
    if (inicio > ultimo) pedacos.push({ tipo: "texto", texto: body.slice(ultimo, inicio) });
    const nome = m[2].slice(1);
    // Uma mencao acabada em ponto e' pontuacao, nao parte do nome.
    if (nome.endsWith(".")) {
      pedacos.push({ tipo: "texto", texto: m[2] });
    } else {
      pedacos.push({ tipo: "mencao", texto: nome });
    }
    ultimo = inicio + m[2].length;
  }
  if (ultimo < body.length) pedacos.push({ tipo: "texto", texto: body.slice(ultimo) });
  return pedacos;
}

/**
 * Ordena os utilizadores sugeridos: quem tem ligacao connosco primeiro.
 *
 * `ligados` e' o conjunto de ids que ja conhecemos (seguimos, ou seguem-nos).
 * A ordem dentro de cada grupo e' a que o servidor deu — o servidor e' que sabe
 * o nome, e "quem comeca por o que escreveste" e' assunto dele.
 *
 * @param {Array<{id:number}>} utilizadores
 * @param {Set<number>|Array<number>} ligados
 * @returns {Array} mesma ordem de entrada
 */
export function porPrioridade(utilizadores, ligados) {
  const lista = Array.isArray(utilizadores) ? utilizadores : [];
  // Normaliza para Number dos dois lados. Com um Set de textos ("2") e ids
  // numericos, `set.has(2)` e' falso e nao sobe ninguem — e isso falha em
  // silencio, sem erro nenhum, que e' o pior sitio para um bug estar.
  const set = new Set(
    [...(ligados instanceof Set ? ligados : ligados || [])]
      .map(Number)
      .filter((x) => Number.isFinite(x))
  );
  const dentro = [];
  const fora = [];
  for (const u of lista) {
    const id = Number(u && u.id);
    if (Number.isFinite(id) && set.has(id)) dentro.push(u);
    else fora.push(u);
  }
  return [...dentro, ...fora];
}
