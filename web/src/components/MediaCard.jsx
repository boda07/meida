import { Link } from "react-router-dom";
import { imageUrl } from "../api/client.js";

export default function MediaCard({ item, landscape = false }) {
  // Escolhe poster (portrait) ou backdrop (landscape)
  const img = landscape
    ? imageUrl(item.backdrop, "w500")
    : imageUrl(item.poster, "w342");

  const subtitle = item.type === "tv" ? `${item.year || ""} · Série` : item.year;

  return (
    <Link to={`/details/${item.type}/${item.id}`} className={`card ${landscape ? "card-landscape" : "card-portrait"}`}>
      <div className="card-poster">
        {img ? (
          <img src={img} alt={item.title} loading="lazy" />
        ) : (
          <div style={{ width: "100%", height: "100%", background: "#333", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {item.title}
          </div>
        )}
        <div className="card-scrim" />
        {item.new && <div className="card-badge">NOVO</div>}
        {item.watched && <div className="card-watched">✓</div>}
        {item.watchlist && <div className="card-watchlist">+</div>}
      </div>
      <div className="card-footer">
        <h3 className="card-title">{item.title}</h3>
        {subtitle && <div className="card-subtitle">{subtitle}</div>}
      </div>
      {item.progress && <div className="card-progress"><div className="card-progress-bar" style={{ width: `${item.progress}%` }} /></div>}
    </Link>
  );
}
