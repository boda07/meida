// Liga os eventos que mantêm a barra de controlos do player a' vista.
//
// O bug que isto guarda (B1): os listeners estavam so' na propria barra, e a
// barra escondida tem `pointer-events: none` — portanto nunca recebia o
// `mousemove` que a havia de mostrar. O alvo tem de ser o contentor do player
// (`.player`), que continua a receber eventos por cima do <video>.
//
// O play/pause tambem mostra: em pausa a barra tem de ficar a' vista (senao
// nao ha' como carregar no play), e ao retomar o temporizador de esconder
// recomeca. O `ended` entra pelo mesmo caminho: no fim o video esta' parado e a
// barra desaparecida deixava o utilizador sem controlos.
//
// Recebe os elementos e as funcoes em vez de os ir buscar ao DOM: assim e'
// testavel com objectos falsos, sem browser nem React. Devolve a limpeza.
export function ligarEventosDaBarra({ alvo, video, mostrar, aoPlay, aoPause }) {
  if (!alvo || !video || typeof mostrar !== "function") return () => {};

  const aoMover = () => mostrar();
  const aoTocar = () => mostrar();
  const noPlay = () => {
    mostrar();
    aoPlay?.();
  };
  const noPause = () => {
    mostrar();
    aoPause?.();
  };

  // O `mousemove` fica no contentor (nao no video nem na barra): e' o unico que
  // continua a receber eventos quando a barra esta' escondida.
  alvo.addEventListener("mousemove", aoMover);
  alvo.addEventListener("pointerdown", aoTocar);
  // `passive` porque so' queremos saber do toque, nunca travar o scroll.
  alvo.addEventListener("touchstart", aoTocar, { passive: true });
  video.addEventListener("play", noPlay);
  video.addEventListener("pause", noPause);
  video.addEventListener("ended", noPause);

  return () => {
    alvo.removeEventListener("mousemove", aoMover);
    alvo.removeEventListener("pointerdown", aoTocar);
    alvo.removeEventListener("touchstart", aoTocar);
    video.removeEventListener("play", noPlay);
    video.removeEventListener("pause", noPause);
    video.removeEventListener("ended", noPause);
  };
}
