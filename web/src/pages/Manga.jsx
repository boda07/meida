import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";
import { useSettings } from "../settings/SettingsContext.jsx";
import MangaCard from "../components/MangaCard.jsx";

// Tipos (Jikan): "" = todos. manhwa/manhua/manga/novel.
const TYPES = [
  { id: "", label: "Todos" },
  { id: "manhwa", label: "Manhwa" },
  { id: "manhua", label: "Manhua" },
  { id: "manga", label: "Manga" },
  { id: "novel", label: "Novel" },
];

// Estado de publicacao (Jikan).
const STATUSES = [
  { id: "", label: "Qualquer estado" },
  { id: "complete", label: "Completo" },
  { id: "publishing", label: "A publicar" },
  { id: "hiatus", label: "Em pausa" },
];

function Chips({ options, value, onChange }) {
  return (
    <div className="lib-filters">
      {options.map((o) => (
        <button
          key={o.id}
          className={`tf-chip ${value === o.id ? "active" : ""}`}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function Manga() {
  const { settings } = useSettings();
  const [tab, setTab] = useState("forYou"); // forYou | filters

  return (
    <div className="sub-page manga-page">
      <h2 className="row-title">Manga, Manhwa &amp; Manhua</h2>
      <div className="lib-filters" style={{ marginTop: 6 }}>
        <button
          className={`tf-chip ${tab === "forYou" ? "active" : ""}`}
          onClick={() => setTab("forYou")}
        >
          Para ti
        </button>
        <button
          className={`tf-chip ${tab === "filters" ? "active" : ""}`}
          onClick={() => setTab("filters")}
        >
          Procurar por filtros
        </button>
      </div>

      {tab === "forYou" ? <ForYou key={settings.genreLang} /> : <Filters />}
    </div>
  );
}

// --- Recomendacoes com base na lista do MAL ---
function ForYou() {
  const [type, setType] = useState("");
  const [data, setData] = useState(null); // { linked, read, topGenres, items }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function load(t = type) {
    setLoading(true);
    setError(null);
    try {
      const d = await api.mangaRecommend({ type: t });
      setData(d);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // Carrega assim que abre.
  useEffect(() => {
    load("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pickType(t) {
    setType(t);
    load(t);
  }

  if (loading && !data) return <p className="status">A ver o que andas a ler...</p>;
  if (error) return <p className="status error">{error}</p>;

  if (data && !data.linked) {
    return (
      <div className="manga-empty">
        <p className="muted">
          Liga a tua conta MyAnimeList para receberes recomendações com base no que
          lês (e já leste).
        </p>
        <Link className="pick-btn" to="/settings">
          Ligar o MyAnimeList nas Definições
        </Link>
      </div>
    );
  }

  return (
    <>
      <p className="muted" style={{ marginTop: 14 }}>
        Recomendações com base nas tags que mais lês na tua lista do MAL
        {data?.read ? ` (${data.read} títulos analisados)` : ""}.
      </p>

      <Chips options={TYPES} value={type} onChange={pickType} />

      {data?.topGenres?.length ? (
        <div className="manga-toptags">
          <span className="muted">Com base em:</span>
          {data.topGenres.map((g) => (
            <span key={g} className="genre-chip want">
              {g}
            </span>
          ))}
        </div>
      ) : null}

      {loading && <p className="status">A escolher recomendações...</p>}

      {!loading && data && (
        <>
          {data.items?.length ? (
            <div className="grid" style={{ marginTop: 18 }}>
              {data.items.map((it) => (
                <MangaCard key={it.id} item={it} />
              ))}
            </div>
          ) : (
            <p className="muted" style={{ marginTop: 18 }}>
              Não consegui recomendar nada. Lê (e marca no MAL) alguns títulos com
              géneros e tenta de novo.
            </p>
          )}
          <div className="load-more-wrap">
            <button className="load-more" onClick={() => load()} disabled={loading}>
              Atualizar recomendações
            </button>
          </div>
        </>
      )}
    </>
  );
}

// --- Procura por filtros ---
function Filters() {
  const { settings } = useSettings();
  const [type, setType] = useState("manhwa");
  const [status, setStatus] = useState("");
  const [allGenres, setAllGenres] = useState([]);
  const [genreSel, setGenreSel] = useState(() => new Set());
  const [genreFilter, setGenreFilter] = useState("");

  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  // Carrega a lista de géneros/temas de manga.
  useEffect(() => {
    api
      .mangaGenres()
      .then((d) => setAllGenres(d.genres || []))
      .catch(() => setAllGenres([]));
  }, [settings.genreLang, settings.overviewLang]);

  const toggleGenre = (id) =>
    setGenreSel((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  async function search(p = 1) {
    setLoading(true);
    setSearched(true);
    try {
      const d = await api.mangaDiscover({
        type,
        status,
        genres: [...genreSel].join(","),
        sort: "popularity",
        page: p,
      });
      setItems((prev) => (p === 1 ? d.items || [] : [...prev, ...(d.items || [])]));
      setHasMore(Boolean(d.hasMore));
      setPage(p);
    } catch {
      if (p === 1) setItems([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }

  const shown = allGenres.filter((g) =>
    g.name.toLowerCase().includes(genreFilter.trim().toLowerCase())
  );

  return (
    <>
      <p className="muted" style={{ marginTop: 14 }}>
        Escolhe o tipo, o estado e os géneros/temas (ex.: Romance, Viagem no
        tempo) — eu trago manga/manhwa/manhua com essas tags.
      </p>

      <div className="manga-filter-block">
        <label className="manga-filter-label">Tipo</label>
        <Chips options={TYPES} value={type} onChange={setType} />
      </div>

      <div className="manga-filter-block">
        <label className="manga-filter-label">Estado</label>
        <Chips options={STATUSES} value={status} onChange={setStatus} />
      </div>

      <div className="manga-filter-block">
        <label className="manga-filter-label">
          Géneros &amp; temas{genreSel.size ? ` (${genreSel.size})` : ""}
        </label>
        <input
          className="manga-genre-search"
          type="text"
          placeholder="Procurar género/tema (ex.: time travel)"
          value={genreFilter}
          onChange={(e) => setGenreFilter(e.target.value)}
        />
        <div className="genre-grid">
          {shown.map((g) => (
            <button
              key={g.id}
              className={`genre-chip ${genreSel.has(g.id) ? "want" : ""}`}
              onClick={() => toggleGenre(g.id)}
            >
              {genreSel.has(g.id) ? "+ " : ""}
              {g.name}
            </button>
          ))}
          {!allGenres.length && <p className="muted">A carregar géneros...</p>}
        </div>
      </div>

      <button className="pick-btn" onClick={() => search(1)} disabled={loading}>
        {loading ? "A procurar..." : "📚 Recomendar"}
      </button>

      {searched && !loading && !items.length && (
        <p className="muted" style={{ marginTop: 16 }}>
          Nada encontrado com esses filtros. Tira alguns e tenta de novo.
        </p>
      )}

      {items.length > 0 && (
        <div className="grid" style={{ marginTop: 18 }}>
          {items.map((it) => (
            <MangaCard key={it.id} item={it} />
          ))}
        </div>
      )}

      {hasMore && !loading && (
        <div className="load-more-wrap">
          <button className="load-more" onClick={() => search(page + 1)}>
            Carregar mais
          </button>
        </div>
      )}
    </>
  );
}
