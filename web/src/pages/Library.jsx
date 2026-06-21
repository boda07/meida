import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, imageUrl } from "../api/client.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { useSettings } from "../settings/SettingsContext.jsx";

const FILTERS = [
  { id: "all", label: "Tudo" },
  { id: "watchlist", label: "Watchlist" },
  { id: "watched", label: "Vistos" },
];

const TYPE_FILTERS = [
  { id: "all", label: "Todos" },
  { id: "movie", label: "Filmes" },
  { id: "tv", label: "Series" },
  { id: "anime", label: "Anime" },
];

// Titulo a mostrar: para anime respeita a opcao ingles/romaji.
function displayTitle(it, romaji) {
  if (it.type === "anime") {
    return romaji
      ? it.titleRomaji || it.title
      : it.titleEn || it.title;
  }
  return it.title;
}

export default function Library() {
  const { user, ready } = useAuth();
  const { settings } = useSettings();
  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

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
    let arr = items;
    if (filter === "watchlist") arr = arr.filter((i) => i.watchlist);
    else if (filter === "watched") arr = arr.filter((i) => i.watched);
    if (typeFilter !== "all") arr = arr.filter((i) => i.type === typeFilter);
    return arr;
  }, [items, filter, typeFilter]);

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
          <span className="lib-filters-sep" />
          {TYPE_FILTERS.map((f) => (
            <button
              key={f.id}
              className={`tf-chip ${typeFilter === f.id ? "active" : ""}`}
              onClick={() => setTypeFilter(f.id)}
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
          {shown.map((it) => {
            const t = displayTitle(it, settings.animeTitleLang === "romaji");
            return (
            <Link
              key={`${it.type}-${it.tmdbId}`}
              to={`/details/${it.type}/${it.tmdbId}`}
              className="card card-portrait"
            >
              <div className="card-poster">
                {imageUrl(it.poster, "w342") ? (
                  <img src={imageUrl(it.poster, "w342")} alt={t} loading="lazy" />
                ) : (
                  <div className="card-noposter">{t}</div>
                )}
                <div className="card-scrim" />
                {it.score ? <span className="card-rating">{it.score}/10</span> : null}
                {it.watched ? <span className="card-watched">✓</span> : null}
                {it.watchlist && !it.watched ? (
                  <span className="card-watchlist">+</span>
                ) : null}
                <div className="card-footer">
                  <h3 className="card-title">{t}</h3>
                </div>
              </div>
            </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
