// Os usernames citados com "@" num comentario.
//
// Fica no servidor, e nao no `web/src/lib/mencoes.js`, porque e' aqui que e' usado:
// e' o servidor que resolve os nomes para notificar quem foi mencionado. O
// frontend tem a sua parte — saber quando mostrar a lista, e desenhar a mencao
// como link — mas essa nunca precisa de saber *quem* foi mencionado.
//
// Sao duas implementacoes das mesmas regras com trabalhos diferentes, e por isso
// as regras tem de concordar: se o servidor tratasse "a@b.com" como mencao e o
// frontend nao, aparecia uma notificacao a partir de um "@" que a interface
// jamais mostrou. `scripts/testar-mencoes.mjs` verifica que as duas concordam.
//
// Um "@" so conta no inicio, ou depois de espaco ou pontuacao — por isso
// "a@b.com" nao notifica ninguem. Um ponto no fim e' pontuacao, nao parte do
// nome: "@ana." notifica a ana.

/**
 * Os usernames mencionados num texto, pela ordem em que aparecem e sem repetir.
 *
 * Aceita usernames com ponto e hifen (a app permite) e apanha varios na mesma
 * frase. Aceita um texto normalizado (`normalizaUsername`) ou nao — sem isso,
 * "@Ana" procurava "ana" e, se o username guardado fosse "ana", nao resolvia.
 *
 * @param {string} body
 * @returns {string[]} nomes como estao escritos no texto
 */
export function usernamesMencionados(body) {
  if (typeof body !== "string") return [];
  const vistos = new Set();
  const fora = [];
  // O grupo 1 e' o separador antes do '@'; o grupo 2 o '@'; o 3 o nome.
  const re = /(^|[\s,.;:!?()[\]{}"'])(@)([A-Za-z0-9][A-Za-z0-9._-]{0,39})/g;
  let m;
  while ((m = re.exec(body)) !== null) {
    let nome = m[3];
    // Corta os pontos finais em vez de saltar a mencao: saltando, "@ana." nao
    // notificava ninguem, que e' o caso mais comum de todos.
    while (nome.endsWith(".")) nome = nome.slice(0, -1);
    if (!nome) continue;
    if (!vistos.has(nome)) {
      vistos.add(nome);
      fora.push(nome);
    }
  }
  return fora;
}
