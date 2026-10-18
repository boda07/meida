// Pedir e sair do ecrã inteiro, sem engolir o erro.
//
// Porque e' um ficheiro so
// ------------------------
// Havia tres codigos Nearly iguais (`AppFullscreen`, `PlayerControls`,
// `usePlayerShortcuts`) e **os tres deitavam fora a promessa**:
//
//     (alvo.requestFullscreen || alvo.webkitRequestFullscreen)?.call(alvo);
//
// O `?.` nao e' sobre o pedido: e' sobre o METODO. A promessa que
// `requestFullscreen()` devolve — que e' rejeitada com `TypeError` quando falta
// o gesto do utilizador, e com `NotAllowedError` quando a permissao e' negada —
// ia para o lixo. Sem `.catch()`, sem `fullscreenerror`, sem nada.
//
// O sintoma e' por isso indistinguivel de um botao morto: "carreguei e nada
// aconteceu". Nao ha erro na consola, nao ha aviso, nao ha forma de saber se foi
// o gesto, a permissao ou a politica. Este modulo transforma isso em algo que se
// pode ler.
//
// Funcao pura e testavel (nao e' um componente), que e' como o resto do codigo
// testavel do projecto esta organizado.

/**
 * Entra (ou sai) do ecrã inteiro.
 *
 * @param {Element} alvo  o elemento a pôr em ecrã inteiro (o `documentElement`
 *                         para a janela toda, o contentor do player para so' o
 *                         video).
 * @returns {Promise<{ ok: boolean, erro: string|null }>}  NUNCA rejeita: o erro
 *   ja vem dentro, que e' o objectivo — quem chama mostra-o em vez de engolir.
 */
export async function ecraInteiro(alvo) {
  const alvoReal = alvo || (typeof document !== "undefined" ? document.documentElement : null);
  // As tres mensagens sao codigos internos, NAO interface: vao para a consola e
  // para quem chama. Ninguem as ve no ecra. O `// i18n` e' o marcador que o
  // auditor de textos por traduzir respeita para textos em portugues
  // deliberados.
  if (!alvoReal) return { ok: false, erro: "sem elemento" }; // i18n

  const jaEstaEmFullscreen =
    typeof document !== "undefined" && Boolean(document.fullscreenElement);

  try {
    if (jaEstaEmFullscreen) {
      if (!document.exitFullscreen) {
        return { ok: false, erro: "exitFullscreen nao existe neste browser" }; // i18n
      }
      await document.exitFullscreen();
      return { ok: true, erro: null };
    }
    // `webkitRequestFullscreen` e' o nome antigo (Safari/Chromium antigo). Sem
    // nenhum dos dois nao ha ecra inteiro — e' melhor dizer isso do que falhar
    // em silencio.
    const pedir = alvoReal.requestFullscreen || alvoReal.webkitRequestFullscreen;
    if (!pedir) {
      return { ok: false, erro: "requestFullscreen nao existe neste browser" }; // i18n
    }
    await pedir.call(alvoReal);
    return { ok: true, erro: null };
  } catch (e) {
    // As tres razoes pelas quais o Chromium recusa, todas por um sitio
    // diferente. A mensagem e' different porque o conserto tambem e':
    //   - "nao veio de um gesto do utilizador" -> o `?.` escondeu uma promise
    //     rejeitada; e' um problema de codigo, nao de permissao.
    //   - "permissao negada" -> o `setPermissionRequestHandler` do Electron.
    //   - "politica" -> um `Permissions-Policy: fullscreen=()` na resposta.
    const erro = (e && e.message) || String(e);
    const nome = (e && e.name) || "Error";
    console.warn("[ecra inteiro] pedido recusado:", nome + ":", erro);
    return { ok: false, erro: nome + ": " + erro };
  }
}