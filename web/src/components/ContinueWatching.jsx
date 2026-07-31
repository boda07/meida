import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, imageUrl } from "../api/client.js";
import { useAuth } from "../auth/AuthContext.jsx";

// Link de detalhe que retoma na posição guardada (?s=temporada&e=episódio&t=seg).
function resumeLink(it) {
  const q = new URLSearchParams();
  if (it.season != null) q.set("s", it.season);
  if (it.episode != null) q.set("e", it.episode);
  // Retoma a meio quando há posição guardada (e não está quase no fim).
  if (it.position != null && it.duration != null && it.position > 20 && it.duration - it.position > 30) {
    q.set("t", it.position);
  }
  const qs = q.toString();
  return `/details/${it.type}/${it.tmdbId}${qs ? `?${qs}` : ""}`;
}

function posLabel(it) {
  if (it.type === "movie") return "Filme";
  if (it.season != null) return `T${it.season} · E${it.episode}`;
  return `Ep. ${it.episode}`;
}

// Barra de progresso do episódio (posição guardada / duração).
function cwProgress(it) {
  if (!it.position || !it.duration) return null;
  const pct = Math.max(0, Math.min(100, (it.position / it.duration) * 100));
  return (
    <span className="cw-progress">
      <span className="cw-progress-fill" style={{ width: `${pct}%` }} />
    </span>
  );
}

export default function ContinueWatching() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!user) {
      setItems([]);
      return;
    }
    api
      .progress()
      .then((d) => setItems((d.items || []).filter((i) => i.status === "watching")))
      .catch(() => {});
  }, [user]);

  if (!user || !items.length) return null;

  async function remove(e, it) {
    e.preventDefault();
    e.stopPropagation();
    setItems((prev) => prev.filter((x) => !(x.type === it.type && x.tmdbId === it.tmdbId)));
    api.progressRemove(it.type, it.tmdbId).catch(() => {});
  }

  return (
    <section className="row">
      <div className="row-header">
        <h2 className="row-title">Continua a ver</h2>
      </div>
      <div className="row-scroll">
        {items.map((it) => (
          <Link
            key={`${it.type}-${it.tmdbId}`}
            to={resumeLink(it)}
            className="card card-portrait cw-card"
          >
            <div className="card-poster">
              {imageUrl(it.poster, "w342") ? (
                <img src={imageUrl(it.poster, "w342")} alt={it.title} loading="lazy" />
              ) : (
                <div className="card-noposter">{it.title}</div>
              )}
              <div className="card-scrim" />
              <button
                className="cw-remove"
                onClick={(e) => remove(e, it)}
                title="Remover"
                aria-label="Remover de Continua a ver"
              >
                ✕
              </button>
              <span className="cw-badge">{posLabel(it)}</span>
              {cwProgress(it)}
              <div className="card-footer">
                <h3 className="card-title">{it.title}</h3>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
