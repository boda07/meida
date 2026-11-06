// Liga os eventos que reportam a posicao do video ao servidor.
//
// O defeito que isto guarda (B3): no fim de um video o Chromium dispara
// `timeupdate`, `pause` e `ended` pela mesma posicao, e nos tres `ended` ja' e'
// true (medido no browser). O `pause` reportava outra vez o que o `ended` ia
// reportar, e o `onProgress` recebia [12, 12] duas vezes — dois pedidos por
// cada video que termina. O `pause` deixa de reportar quando `video.ended` ja'
// e' verdade, e um par (posicao, duracao) igual ao anterior nao se repete.
//
// Recebe o elemento e a funcao em vez de os ir buscar ao DOM/React: assim e'
// testavel com um video falso, sem browser. Devolve a limpeza.
export function ligarEventosDeProgresso({ video, onProgress }) {
  if (!video || typeof onProgress !== "function") return () => {};

  const INTERVALO = 5;

  // Posicao do ultimo reporte, para o intervalo de 5s.
  let ultimo = 0;
  // Ultimo par enviado, para nao repetir o mesmo reporte duas vezes seguidas.
  let ultimaPosicao = null;
  let ultimaDuracao = null;

  const reportar = () => {
    const posicao = Math.floor(video.currentTime || 0);
    const duracao = Math.floor(video.duration || 0);
    ultimo = posicao;
    if (posicao === ultimaPosicao && duracao === ultimaDuracao) return;
    ultimaPosicao = posicao;
    ultimaDuracao = duracao;
    onProgress(posicao, duracao);
  };

  const noTempo = () => {
    const posicao = Math.floor(video.currentTime || 0);
    // Math.abs: depois de recuar, posicao - ultimo fica negativo e nunca
    // chegava a 5.
    if (Math.abs(posicao - ultimo) >= INTERVALO) reportar();
  };

  const noPause = () => {
    // No fim o `pause` chega com `ended` ja' a true; quem reporta e' o `ended`.
    if (video.ended) return;
    reportar();
  };
  const noFim = () => reportar();

  video.addEventListener("timeupdate", noTempo);
  video.addEventListener("pause", noPause);
  video.addEventListener("ended", noFim);

  return () => {
    video.removeEventListener("timeupdate", noTempo);
    video.removeEventListener("pause", noPause);
    video.removeEventListener("ended", noFim);
    // Ao desmontar, reporta a posicao final: sem isto o "Continua a ver" ficava
    // no ultimo reporte periodico.
    reportar();
  };
}
