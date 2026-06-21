import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client.js";
import { useSettings } from "../settings/SettingsContext.jsx";
import MediaRow from "../components/MediaRow.jsx";
import MediaCard from "../components/MediaCard.jsx";
import Hero from "../components/Hero.jsx";

// "Destaques" = as linhas curadas (estado inicial); as restantes usam /discover.
const SORTS = [
  { id: "featured", label: "Destaques" },
  { id: "popularity", label: "Popularidade" },
  { id: "rating", label: "Nota" },
  { id: "recent", label: "Mais recentes" },
];

// category (rota) -> type (discover/genres)
const TYPE_OF = { movies: "movie", tv: "tv", anime: "anime" };

// Escolhe um item aleatorio com backdrop para o banner.
function pickHero(rows) {
  const pool = rows.flatMap((r) => r.items).filter((i) => i.backdrop);
  return pool.length ? pool[Math.floor(Math.random() * Math.min(pool.length, 8))] : null;
}

export default function Category({ category, title }) {
  const { settings } = useSettings();
  const type = TYPE_OF[category] || "movie";

  // Linhas curadas (estado "Destaques").
  const [rows, setRows] = useState([]);
  const [hero, setHero] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  // Controlos.
  const [sort, setSort] = useState("featured");
  const [dir, setDir] = useState("desc");
  const [allGenres, setAllGenres] = useState([]); // [{id,name}]
  const [genreSel, setGenreSel] = useState(() => new Set());
  const [genreOpen, setGenreOpen] = useState(false);

  // Resultados do discover.
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [discLoading, setDiscLoading] = useState(false);

  const genreKey = useMemo(() => [...genreSel].sort().join(","), [genreSel]);
  const discoverActive = sort !== "featured" || genreSel.size > 0;

  const toggleGenre = (id) =>
    setGenreSel((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  // Fecha o modal de géneros com Escape.
  useEffect(() => {
    if (!genreOpen) return;
    const onKey = (e) => e.key === "Escape" && setGenreOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [genreOpen]);

  // Carrega as linhas curadas.
  useEffect(() => {
    setLoading(true);
    setError(null);
    api
      .category(category)
      .then((d) => {
        setRows(d.rows);
        setHero(pickHero(d.rows));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [category, settings.titleLang, settings.overviewLang, settings.animeTitleLang]);

  // Ao mudar de página/tipo, repoe os controlos e recarrega os géneros.
  useEffect(() => {
    setSort("featured");
    setDir("desc");
    setGenreSel(new Set());
    setAllGenres([]);
    api
      .genres(type)
      .then((d) => setAllGenres(d.genres || []))
      .catch(() => setAllGenres([]));
  }, [type]);

  // Corre o discover quando os filtros/ordenação mudam (página 1).
  useEffect(() => {
    if (!discoverActive) {
      setItems([]);
      setPage(1);
      setHasMore(false);
      return;
    }
    let cancel = false;
    setDiscLoading(true);
    const sortApi = sort === "featured" ? "popularity" : sort;
    api
      .discover({ type, genres: genreKey, sort: sortApi, dir, page: 1 })
      .then((d) => {
        if (cancel) return;
        setItems(d.items || []);
        setHasMore(Boolean(d.hasMore));
        setPage(1);
      })
      .catch(() => {
        if (cancel) return;
        setItems([]);
        setHasMore(false);
      })
      .finally(() => !cancel && setDiscLoading(false));
    return () => {
      cancel = true;
    };
  }, [discoverActive, type, sort, dir, genreKey, settings.titleLang, settings.animeTitleLang]);

  function loadMore() {
    const next = page + 1;
    setDiscLoading(true);
    const sortApi = sort === "featured" ? "popularity" : sort;
    api
      .discover({ type, genres: genreKey, sort: sortApi, dir, page: next })
      .then((d) => {
        setItems((prev) => [...prev, ...(d.items || [])]);
        setHasMore(Boolean(d.hasMore));
        setPage(next);
      })
      .catch(() => setHasMore(false))
      .finally(() => setDiscLoading(false));
  }

  if (error) return <p className="status error">{error}</p>;

  return (
    <div className={`catalog-page ${!discoverActive && hero ? "" : "no-hero"}`}>
      {!discoverActive && hero && <Hero item={hero} />}

      <div className="cat-controls">
        <div className="lib-sort">
          <label htmlFor="cat-sort">Ordenar por</label>
          <select id="cat-sort" value={sort} onChange={(e) => setSort(e.target.value)}>
            {SORTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <button
            className="lib-sort-dir"
            title={dir === "desc" ? "Descendente" : "Ascendente"}
            disabled={sort === "featured"}
            onClick={() => setDir((d) => (d === "desc" ? "asc" : "desc"))}
          >
            {dir === "desc" ? "↓" : "↑"}
          </button>
        </div>
        {allGenres.length > 0 && (
          <button
            className={`tf-chip ${genreSel.size ? "active" : ""}`}
            onClick={() => setGenreOpen(true)}
          >
            Género{genreSel.size ? ` (${genreSel.size})` : ""}
          </button>
        )}
      </div>

      {discoverActive ? (
        <>
          {items.length > 0 && (
            <div className="grid">
              {items.map((it) => (
                <MediaCard key={`${it.type}-${it.id}`} item={it} />
              ))}
            </div>
          )}
          {discLoading && <p className="status">A carregar...</p>}
          {!discLoading && !items.length && (
            <p className="muted">Nada encontrado com estes filtros.</p>
          )}
          {hasMore && !discLoading && (
            <div className="load-more-wrap">
              <button className="load-more" onClick={loadMore}>
                Carregar mais
              </button>
            </div>
          )}
        </>
      ) : loading ? (
        <p className="status">A carregar {title}...</p>
      ) : (
        <div className="rows">
          {rows.map((row) => (
            <MediaRow key={row.id} title={row.title} items={row.items} />
          ))}
        </div>
      )}

      {genreOpen && (
        <div className="modal-overlay" onClick={() => setGenreOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Filtrar por género{type === "anime" ? "/tema" : ""}</h3>
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
                  key={g.id}
                  className={`tf-chip ${genreSel.has(g.id) ? "active" : ""}`}
                  onClick={() => toggleGenre(g.id)}
                >
                  {g.name}
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
    </div>
  );
}
