// Decide se um pedido de navegacao da janela deve ser bloqueado.
//
// O bug que isto resolve (2026-11-10): o evento `will-redirect` do Electron
// TAMBEM dispara para subframes. O MoviesAPI responde com um 302 para o
// vidspark.to DENTRO do <iframe> do player; o handler antigo via "origem
// diferente da app", fazia `preventDefault()` e `shell.openExternal(url)`.
// Resultado: o browser do sistema abria o MoviesAPI/VidSpark em cada episodio
// e o iframe ficava sem player nenhum.
//
// Regras:
//   - iframe (`isMainFrame === false`): nunca bloquear. Redirecionar dentro do
//     proprio iframe e' o funcionamento normal de um provider.
//   - frame principal para uma origem nossa (app ou servidor remoto): deixar.
//   - frame principal para qualquer outra origem: bloquear **sem abrir o
//     browser**. Quem tentou navegar foi um anuncio dentro do player, nao o
//     utilizador; abrir uma janela do sistema e' pior do que ignorar.
//
// Sem `details` (ou com um URL invalido) bloqueia: falhar fechado.
function deveBloquear(details, origensPermitidas) {
  if (details && details.isMainFrame === false) return false;
  const url = details && details.url;
  try {
    return !origensPermitidas.has(new URL(url).origin);
  } catch {
    return true;
  }
}

module.exports = { deveBloquear };
