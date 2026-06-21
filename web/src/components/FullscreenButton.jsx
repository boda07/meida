// Botao de ecra inteiro: poe em fullscreen o elemento (container do player)
// passado por ref. Funciona com iframe e com <video>.
export default function FullscreenButton({ targetRef }) {
  function toggle() {
    const el = targetRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el);
    }
  }

  return (
    <button className="fs-btn" onClick={toggle} title="Ecra inteiro" aria-label="Ecra inteiro">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3" />
      </svg>
    </button>
  );
}
