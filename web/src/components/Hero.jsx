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

function SpeakerIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export default function Hero({ item }) {
  if (!item) return null;

  const bg = imageUrl(item.backdrop, "w1280") || imageUrl(item.poster, "w780");
  const to = `/details/${item.type}/${item.id}`;

  const handleScroll = () => {
    const rows = document.querySelector(".rows");
    if (rows) {
      rows.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const category = item.type === "tv" ? "série" : "filme";
  const categoryLabel = category.toUpperCase();

  return (
    <div className="hero">
      {/* Imagem de fundo numa camada propria: desvanece nas margens para se fundir
          com qualquer fundo do utilizador (cor ou wallpaper) por baixo. */}
      {bg && <div className="hero-bg" style={{ backgroundImage: `url(${bg})` }} />}
      {/* Conteúdo */}
      <div className="hero-content">
        {/* Título */}
        <h1>{item.title}</h1>

        {/* Meta */}
        <div className="meta">
          {item.year ? <span>{item.year}</span> : null}
          {item.type === "tv" ? <span>·</span> : null}
          {item.type === "tv" ? <span>Série</span> : null}
          {item.rating ? <span>·</span> : null}
          {item.rating ? <span>⭐ {item.rating}</span> : null}
        </div>

        {/* Sinopse */}
        {item.overview ? <p className="body-text">{item.overview}</p> : null}

        {/* Ações */}
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

      {/* Chevron para scroll */}
      <button className="hero-scroll-down" onClick={handleScroll} aria-label="Scroll para conteúdo">
        <ChevronDownIcon />
      </button>
    </div>
  );
}
