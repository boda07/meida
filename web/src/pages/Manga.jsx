import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";
import { useSettings } from "../settings/SettingsContext.jsx";
import MangaCard from "../components/MangaCard.jsx";

// Tipos (Jikan) — multi-seleção; vazio = todos.
const TYPES = [
  { id: "manhwa", label: "Manhwa" },
  { id: "manhua", label: "Manhua" },
  { id: "manga", label: "Manga" },
  { id: "novel", label: "Novel" },
];

// Estado de publicacao (Jikan) — seleção única.
const STATUSES = [
  { id: "", label: "Qualquer estado" },
  { id: "complete", label: "Completo" },
  { id: "publishing", label: "A publicar" },
  { id: "hiatus", label: "Em pausa" },
];

// Chips de seleção única.
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

// Chips de multi-seleção (Set).
function MultiChips({ options, value, onToggle }) {
  return (
    <div className="lib-filters">
      {options.map((o) => (
        <button
          key={o.id}
          className={`tf-chip ${value.has(o.id) ? "active" : ""}`}
          onClick={() => onToggle(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const toggleInSet = (setter) => (id) =>
  setter((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

export default function Manga() {
  const { settings } = useSettings();
  const [tab, setTab] = useState("forYou"); // forYou | toRead | filters

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
          className={`tf-chip ${tab === "toRead" ? "active" : ""}`}
          onClick={() => setTab("toRead")}
        >
          Para ler
        </button>
        <button
          className={`tf-chip ${tab === "filters" ? "active" : ""}`}
          onClick={() => setTab("filters")}
        >
          Procurar por filtros
        </button>
      </div>

      {tab === "forYou" && <ForYou key={settings.genreLang} />}
      {tab === "toRead" && <ToRead key={settings.genreLang} />}
      {tab === "filters" && <Filters />}
    </div>
  );
}

// --- Recomendacoes com base na lista do MAL ---
function ForYou() {
  const [types, setTypes] = useState(() => new Set());
  const [data, setData] = useState(null); // { linked, read, topGenres, items }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function load(typeSet = types) {
    setLoading(true);
    setError(null);
    try {
      const d = await api.mangaRecommend({ types: [...typeSet].join(",") });
      setData(d);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onToggle(id) {
    setTypes((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      load(next);
      return next;
    });
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
        {data?.read ? ` (${data.read} títulos analisados)` : ""}. Nunca te recomendo
        nada que já tenhas na lista.
      </p>

      <div className="manga-filter-block">
        <label className="manga-filter-label">Tipo (vazio = todos)</label>
        <MultiChips options={TYPES} value={types} onToggle={onToggle} />
      </div>

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
              Não consegui recomendar nada com estes tipos. Tira alguns filtros, ou
              lê (e marca no MAL) títulos com géneros, e tenta de novo.
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

// --- "Para ler": a lista plan_to_read do MAL ---
function ToRead() {
  const [data, setData] = useState(null); // { linked, items }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    api
      .mangaToRead()
      .then((d) => !cancel && setData(d))
      .catch((e) => !cancel && setError(e.message))
      .finally(() => !cancel && setLoading(false));
    return () => {
      cancel = true;
    };
  }, []);

  if (loading) return <p className="status">A carregar a tua lista...</p>;
  if (error) return <p className="status error">{error}</p>;

  if (data && !data.linked) {
    return (
      <div className="manga-empty">
        <p className="muted">
          Liga a tua conta MyAnimeList para veres aqui a tua lista de "para ler"
          (plan to read).
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
        Os títulos que marcaste como "para ler" (plan to read) no MyAnimeList.
      </p>
      {data?.items?.length ? (
        <div className="grid" style={{ marginTop: 18 }}>
          {data.items.map((it) => (
            <MangaCard key={it.id} item={it} />
          ))}
        </div>
      ) : (
        <p className="muted" style={{ marginTop: 18 }}>
          A tua lista de "para ler" está vazia. Adiciona manga ao plan to read no MAL.
        </p>
      )}
    </>
  );
}

// --- Procura por filtros ---
function Filters() {
  const { settings } = useSettings();
  const [types, setTypes] = useState(() => new Set(["manhwa"]));
  const [status, setStatus] = useState("");
  const [notInList, setNotInList] = useState(false);
  const [allGenres, setAllGenres] = useState([]);
  const [genreSel, setGenreSel] = useState(() => new Set());
  const [genreFilter, setGenreFilter] = useState("");

  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    api
      .mangaGenres()
      .then((d) => setAllGenres(d.genres || []))
      .catch(() => setAllGenres([]));
  }, [settings.genreLang, settings.overviewLang]);

  const toggleType = toggleInSet(setTypes);
  const toggleGenre = toggleInSet(setGenreSel);

  async function search(p = 1) {
    setLoading(true);
    setSearched(true);
    try {
      const d = await api.mangaDiscover({
        types: [...types].join(","),
        status,
        genres: [...genreSel].join(","),
        notInList: notInList ? "1" : "",
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
        Escolhe um ou mais tipos, o estado e os géneros/temas (ex.: Romance, Viagem
        no tempo) — eu trago títulos com essas tags.
      </p>

      <div className="manga-filter-block">
        <label className="manga-filter-label">Tipo (vazio = todos)</label>
        <MultiChips options={TYPES} value={types} onToggle={toggleType} />
      </div>

      <div className="manga-filter-block">
        <label className="manga-filter-label">Estado</label>
        <Chips options={STATUSES} value={status} onChange={setStatus} />
      </div>

      <div className="manga-filter-block">
        <label className="manga-filter-label">Opções</label>
        <div className="lib-filters">
          <button
            className={`tf-chip ${notInList ? "active" : ""}`}
            onClick={() => setNotInList((v) => !v)}
            title="Precisa de teres o MyAnimeList ligado"
          >
            {notInList ? "✓ " : ""}Esconder o que já tenho na lista
          </button>
        </div>
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
