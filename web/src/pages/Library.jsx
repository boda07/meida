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
  { id: "tv", label: "Séries" },
  { id: "anime", label: "Anime" },
];

const SORTS = [
  { id: "recent", label: "Adicionados" },
  { id: "title", label: "Título" },
  { id: "rating", label: "Nota da comunidade" },
];

// Título a mostrar: para anime respeita a opção ingles/romaji.
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
  // Géneros/temas selecionados. Vazio = sem filtro de tags.
  const [genreSel, setGenreSel] = useState(() => new Set());
  const [genreOpen, setGenreOpen] = useState(false);
  const [wlOpen, setWlOpen] = useState(false); // modal "limpar watchlist"
  const [clearing, setClearing] = useState(false);
  const [page, setPage] = useState(1);
  const PER_PAGE = 60;

  // Fecha os modais com a tecla Escape.
  useEffect(() => {
    if (!genreOpen && !wlOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") {
        setGenreOpen(false);
        setWlOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [genreOpen, wlOpen]);

  const toggleGenre = (g) =>
    setGenreSel((prev) => {
      const next = new Set(prev);
      next.has(g) ? next.delete(g) : next.add(g);
      return next;
    });

  function load() {
    return api
      .library()
      .then((d) => setItems(d.items))
      .catch((e) => setError(e.message));
  }

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    load().finally(() => setLoading(false));
  }, [user]);

  async function clearWatchlist(type) {
    setClearing(true);
    try {
      await api.clearWatchlist(type);
      await load();
      setWlOpen(false);
    } catch {
      /* ignora */
    } finally {
      setClearing(false);
    }
  }

  // Géneros/temas disponiveis na lista (ordenados), para o dropdown.
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
    // Ordenação. Comparador base (ascendente); a direção inverte no fim.
    const romaji = settings.animeTitleLang === "romaji";
    let cmp;
    if (sort === "title") {
      cmp = (a, b) => displayTitle(a, romaji).localeCompare(displayTitle(b, romaji));
    } else if (sort === "rating") {
      // Sem nota da comunidade -> sempre no fim, independente da direção.
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

  // Paginacao: volta a página 1 sempre que a lista filtrada/ordenada muda.
  useEffect(() => {
    setPage(1);
  }, [filter, typeFilter, genreSel, sort, dir]);

  const pageCount = Math.max(1, Math.ceil(shown.length / PER_PAGE));
  const safePage = Math.min(page, pageCount);
  const paged = useMemo(
    () => shown.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE),
    [shown, safePage]
  );

  // Sobe ao topo ao trocar de página (mais agradavel em listas grandes).
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [safePage]);

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
                Género{genreSel.size ? ` (${genreSel.size})` : ""}
              </button>
            </>
          )}
          <span className="lib-filters-sep" />
          <button className="tf-chip lib-wl-clear" onClick={() => setWlOpen(true)}>
            Limpar watchlist
          </button>
        </div>
        </div>
      </div>

      {wlOpen && (
        <div className="modal-overlay" onClick={() => setWlOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Limpar watchlist</h3>
              <button className="modal-close" aria-label="Fechar" onClick={() => setWlOpen(false)}>
                ✕
              </button>
            </div>
            <p className="muted" style={{ padding: "0 20px" }}>
              Remove os títulos da watchlist (os que já viste ou avaliaste ficam,
              só perdem a marca de watchlist). Que watchlist queres apagar?
            </p>
            <div className="wl-clear-opts">
              {[
                { id: "movie", label: "Filmes" },
                { id: "tv", label: "Séries" },
                { id: "anime", label: "Anime" },
                { id: "all", label: "Todos" },
              ].map((o) => (
                <button
                  key={o.id}
                  className={`modal-btn ${o.id === "all" ? "" : "ghost"}`}
                  disabled={clearing}
                  onClick={() => clearWatchlist(o.id)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {genreOpen && (
        <div className="modal-overlay" onClick={() => setGenreOpen(false)}>
          <div className="modal lib-genre-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Filtrar por género/tema</h3>
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
            : "A tua lista esta vazia. Abre um filme/série e adiciona a watchlist, marca como visto ou da nota."}
        </p>
      ) : (
        <>
        <div className="grid">
          {paged.map((it) => {
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
        {pageCount > 1 && (
          <div className="lib-pager">
            <button
              className="lib-pager-btn"
              disabled={safePage <= 1}
              onClick={() => setPage(safePage - 1)}
            >
              ← Anterior
            </button>
            <span className="lib-pager-info">
              Página {safePage} de {pageCount} · {shown.length} títulos
            </span>
            <button
              className="lib-pager-btn"
              disabled={safePage >= pageCount}
              onClick={() => setPage(safePage + 1)}
            >
              Seguinte →
            </button>
          </div>
        )}
        </>
      )}
    </div>
  );
}
