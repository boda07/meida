import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { imageUrl } from "../api/client.js";

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

const heroBg = (it) => imageUrl(it.backdrop, "w1280") || imageUrl(it.poster, "w780");

// Banner com slideshow: roda entre varios destaques (crossfade), com bolinhas
// para navegar. Aceita `items` (lista) ou `item` (um so). So entram os que tem
// imagem de fundo.
export default function Hero({ items, item }) {
  const list = (items && items.length ? items : item ? [item] : []).filter(
    (i) => i && heroBg(i)
  );

  const [idx, setIdx] = useState(0);
  const lastIdxRef = useRef(0);

  // Recomeca do inicio quando a lista muda (ex.: troca de idioma/pagina).
  const firstId = list[0]?.id;
  useEffect(() => {
    setIdx(0);
    lastIdxRef.current = 0;
  }, [firstId]);

  // Avanca sozinho; cada mudanca re-arma o temporizador (manual tambem).
  useEffect(() => {
    if (list.length <= 1) return;
    const t = setTimeout(() => setIdx((i) => (i + 1) % list.length), 7000);
    return () => clearTimeout(t);
  }, [idx, list.length]);

  // Guarda o indice anterior (mantem-se opaco por baixo durante o crossfade).
  const prevIdx = lastIdxRef.current;
  useEffect(() => {
    lastIdxRef.current = idx;
  }, [idx]);

  if (!list.length) return null;

  const safe = idx % list.length;
  const current = list[safe];
  const to = `/details/${current.type}/${current.id}`;

  return (
    <div className="hero">
      {/* Camadas de fundo (crossfade): a ativa por cima, a anterior opaca por baixo. */}
      {list.map((it, i) => (
        <div
          key={it.id}
          className="hero-bg"
          style={{
            backgroundImage: `url(${heroBg(it)})`,
            opacity: i === safe || i === prevIdx ? 1 : 0,
            zIndex: i === safe ? 2 : i === prevIdx ? 1 : 0,
          }}
        />
      ))}

      {/* Conteúdo do destaque atual (refaz-se a cada slide com um fade suave). */}
      <div className="hero-content" key={current.id}>
        <h1>{current.title}</h1>
        <div className="meta">
          {current.year ? <span>{current.year}</span> : null}
          {current.type === "tv" ? <span>·</span> : null}
          {current.type === "tv" ? <span>Série</span> : null}
          {current.rating ? <span>·</span> : null}
          {current.rating ? <span>⭐ {current.rating}</span> : null}
        </div>
        {current.overview ? <p className="body-text">{current.overview}</p> : null}
        <div className="hero-actions">
          <Link className="btn-play" to={to}>
            <PlayIcon />
            Reproduzir
          </Link>
          <Link className="btn-info" to={to}>
            <InfoIcon />
            Mais info
          </Link>
        </div>
      </div>

      {/* Bolinhas de navegação do slideshow. */}
      {list.length > 1 && (
        <div className="hero-dots">
          {list.map((it, i) => (
            <button
              key={it.id}
              className={`hero-dot ${i === safe ? "active" : ""}`}
              onClick={() => setIdx(i)}
              aria-label={`Destaque ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
