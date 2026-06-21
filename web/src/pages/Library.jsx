import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, imageUrl } from "../api/client.js";
import { useAuth } from "../auth/AuthContext.jsx";

const FILTERS = [
  { id: "all", label: "Tudo" },
  { id: "watchlist", label: "Watchlist" },
  { id: "watched", label: "Vistos" },
];

export default function Library() {
  const { user, ready } = useAuth();
  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    api
      .library()
      .then((d) => setItems(d.items))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [user]);

  const shown = useMemo(() => {
    if (filter === "watchlist") return items.filter((i) => i.watchlist);
    if (filter === "watched") return items.filter((i) => i.watched);
    return items;
  }, [items, filter]);

  if (ready && !user)
    return (
      <p className="status muted">
        <Link to="/login">Entra</Link> para veres a tua lista.
      </p>
    );
  if (loading) return <p className="status">A carregar a tua lista...</p>;
  if (error) return <p className="status error">{error}</p>;

  return (
    <div className="sub-page">
      <div className="lib-header">
        <h2 className="row-title">A minha lista</h2>
        <div className="lib-filters">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              className={`tf-chip ${filter === f.id ? "active" : ""}`}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {!shown.length ? (
        <p className="muted">
          {items.length
            ? "Nada nesta categoria."
            : "A tua lista esta vazia. Abre um filme/serie e adiciona a watchlist, marca como visto ou da nota."}
        </p>
      ) : (
        <div className="grid">
          {shown.map((it) => (
            <Link
              key={`${it.type}-${it.tmdbId}`}
              to={`/details/${it.type}/${it.tmdbId}`}
              className="card"
            >
              <div className="card-poster">
                {imageUrl(it.poster, "w342") ? (
                  <img src={imageUrl(it.poster, "w342")} alt={it.title} loading="lazy" />
                ) : (
                  <div className="card-noposter">{it.title}</div>
                )}
                {it.score ? <span className="card-rating">{it.score}/10</span> : null}
                {it.watched ? <span className="card-watched">✓</span> : null}
                {it.watchlist && !it.watched ? (
                  <span className="card-watchlist">+</span>
                ) : null}
              </div>
              <div className="card-title">{it.title}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
