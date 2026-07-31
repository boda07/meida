import { useEffect, useState } from "react";

// Botao "Trailer" nos detalhes: abre um modal com o trailer (YouTube) embutido.
export default function Trailer({ src }) {
  const [open, setOpen] = useState(false);

  // Fecha com Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (!src) return null;

  return (
    <>
      <button type="button" className="lib-trailer" onClick={() => setOpen(true)}>
        <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <path d="M8 5v14l11-7z" />
        </svg>
        Trailer
      </button>
      {open && (
        <div className="modal-overlay" onClick={() => setOpen(false)}>
          <div className="modal trailer-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Trailer</h3>
              <button
                className="modal-close"
                aria-label="Fechar"
                onClick={() => setOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="trailer-frame">
              <iframe
                src={src}
                title="Trailer"
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
