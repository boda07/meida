import { useRef } from "react";
import FullscreenButton from "./FullscreenButton.jsx";

// Player por iframe (Fase A). Mais tarde sera substituido/complementado por um
// player HTML5 proprio quando extrairmos os streams diretos.
export default function Player({ src, title }) {
  const ref = useRef(null);
  if (!src) return null;
  return (
    <div className="player" ref={ref}>
      {/* Sem sandbox: estes providers detetam e recusam iframes em sandbox.
          O custo sao popups/anuncios, inerentes a este tipo de fonte. */}
      <iframe
        src={src}
        title={title || "player"}
        allowFullScreen
        referrerPolicy="origin"
        allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
      />
      <FullscreenButton targetRef={ref} />
    </div>
  );
}
