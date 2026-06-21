import { useEffect, useMemo, useRef, useState } from "react";
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

const SORTS = [
  { id: "recent", label: "Adicionados" },
  { id: "title", label: "Titulo" },
  { id: "rating", label: "Nota da comunidade" },
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
  const [sort, setSort] = useState("recent");
  const [dir, setDir] = useState("desc"); // "desc" | "asc"
  // Generos/temas selecionados. Vazio = sem filtro de tags.
  const [genreSel, setGenreSel] = useState(() => new Set());
  const [genreOpen, setGenreOpen] = useState(false);

  // Fecha o modal de generos com a tecla Escape.
  useEffect(() => {
    if (!genreOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") setGenreOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [genreOpen]);

  const toggleGenre = (g) =>
    setGenreSel((prev) => {
      const next = new Set(prev);
      next.has(g) ? next.delete(g) : next.add(g);
      return next;
    });

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

  // Generos/temas disponiveis na lista (ordenados), para o dropdown.
  const allGenres = useMemo(() => {
    const set = new Set();
    for (const i of items) for (const g of i.genres || []) set.add(g);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [items]);

  const shown = useMemo(() => {
    let arr = items;
    if (filter === "watchlist") arr = arr.filter((i) => i.watchlist);
    else if (filter === "watched") arr = arr.filter((i) => i.watched);
    if (typeFilter !== "all") arr = arr.filter((i) => i.type === typeFilter);
    if (genreSel.size)
      arr = arr.filter((i) => {
        const g = i.genres || [];
        for (const sel of genreSel) if (!g.includes(sel)) return false;
        return true;
      });
    // Ordenacao. Comparador base (ascendente); a direcao inverte no fim.
    const romaji = settings.animeTitleLang === "romaji";
    let cmp;
    if (sort === "title") {
      cmp = (a, b) => displayTitle(a, romaji).localeCompare(displayTitle(b, romaji));
    } else if (sort === "rating") {
      // Sem nota da comunidade -> sempre no fim, independente da direcao.
      cmp = (a, b) => {
        const ra = a.rating,
          rb = b.rating;
        if (ra == null && rb == null) return 0;
        if (ra == null) return 1 * sign;
        if (rb == null) return -1 * sign;
        return ra - rb;
      };
    } else {
      // recentes: pela data de atualizacao.
      cmp = (a, b) => (a.updatedAt || "").localeCompare(b.updatedAt || "");
    }
    const sign = dir === "asc" ? 1 : -1;
    arr = [...arr].sort((a, b) => cmp(a, b) * sign);
    return arr;
  }, [items, filter, typeFilter, genreSel, sort, dir, settings.animeTitleLang]);

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
        <div className="lib-toolbar">
        <div className="lib-sort">
          <label htmlFor="lib-sort-sel">Ordenar por</label>
          <select
            id="lib-sort-sel"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            {SORTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <button
            className="lib-sort-dir"
            title={dir === "desc" ? "Descendente" : "Ascendente"}
            onClick={() => setDir((d) => (d === "desc" ? "asc" : "desc"))}
          >
            {dir === "desc" ? "↓" : "↑"}
          </button>
        </div>
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
          {allGenres.length > 0 && (
            <>
              <span className="lib-filters-sep" />
              <button
                className={`tf-chip ${genreSel.size ? "active" : ""}`}
                onClick={() => setGenreOpen(true)}
              >
                Genero{genreSel.size ? ` (${genreSel.size})` : ""}
              </button>
            </>
          )}
        </div>
        </div>
      </div>

      {genreOpen && (
        <div className="modal-overlay" onClick={() => setGenreOpen(false)}>
          <div className="modal lib-genre-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Filtrar por genero/tema</h3>
              <button
                className="modal-close"
                aria-label="Fechar"
                onClick={() => setGenreOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="lib-genre-tags">
              {allGenres.map((g) => (
                <button
                  key={g}
                  className={`tf-chip ${genreSel.has(g) ? "active" : ""}`}
                  onClick={() => toggleGenre(g)}
                >
                  {g}
                </button>
              ))}
            </div>
            <div className="modal-actions">
              <button
                className="modal-btn ghost"
                disabled={!genreSel.size}
                onClick={() => setGenreSel(new Set())}
              >
                Limpar{genreSel.size ? ` (${genreSel.size})` : ""}
              </button>
              <button className="modal-btn" onClick={() => setGenreOpen(false)}>
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}

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
