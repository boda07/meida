import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";
import { useSettings } from "../settings/SettingsContext.jsx";
import MangaCard from "../components/MangaCard.jsx";

// Filtros client-side (a lista "Para ler" ja vem toda — filtra/ordena no browser).
const clientTypeMatch = (mediaType, types) => {
  if (!types.size) return true;
  const mt = String(mediaType || "").toLowerCase();
  for (const t of types) {
    if (t === "novel" ? mt.includes("novel") : mt.includes(t)) return true;
  }
  return false;
};
const clientGenreMatch = (genres, sel) => {
  if (!sel.size) return true;
  const set = new Set((genres || []).map((g) => g.toLowerCase()));
  for (const g of sel) if (!set.has(g.toLowerCase())) return false;
  return true;
};
// Id do estado (chip) -> texto contido no campo `status` do item.
const CLIENT_STATUS_TEXT = {
  complete: "finished",
  publishing: "publishing",
  hiatus: "on hiatus",
  discontinued: "discontinued",
};
const clientStatusMatch = (status, sel) => {
  if (!sel.size) return true;
  const st = String(status || "").toLowerCase();
  for (const s of sel) if (CLIENT_STATUS_TEXT[s] && st.includes(CLIENT_STATUS_TEXT[s])) return true;
  return false;
};

// Tipos (Jikan) — multi-seleção; vazio = todos.
const TYPES = [
  { id: "manhwa", label: "Manhwa" },
  { id: "manhua", label: "Manhua" },
  { id: "manga", label: "Mangá" },
  { id: "novel", label: "Novel" },
];

// Estado de publicacao (Jikan) — multi-seleção; vazio = qualquer.
const STATUSES = [
  { id: "complete", label: "Completo" },
  { id: "publishing", label: "A publicar" },
  { id: "hiatus", label: "Em pausa" },
  { id: "discontinued", label: "Descontinuado" },
];

const SORTS = [
  { id: "popularity", label: "Popularidade" },
  { id: "rating", label: "Nota" },
  { id: "recent", label: "Mais recentes" },
];

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

// `embedded`: renderizado dentro de outra página (ex.: "Escolhe algo para mim"),
// sem o invólucro/título próprios.
export default function Manga({ embedded = false }) {
  const { settings } = useSettings();
  const [tab, setTab] = useState("forYou"); // forYou | toRead | filters

  const body = (
    <>
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
    </>
  );

  if (embedded) return <div className="manga-page">{body}</div>;
  return (
    <div className="sub-page manga-page">
      <h2 className="row-title">Mangá, Manhwa &amp; Manhua</h2>
      {body}
    </div>
  );
}

// --- Recomendacoes com base na lista do MAL ---
function ForYou() {
  const [types, setTypes] = useState(() => new Set());
  const [items, setItems] = useState([]);
  const [topGenres, setTopGenres] = useState([]);
  const [read, setRead] = useState(0);
  const [linked, setLinked] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true); // carga inicial / troca de tipo
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const seenRef = useRef(new Set()); // ids ja mostrados (para trazer novos)

  // Carga de raiz (1.ª vez ou ao mudar o tipo): limpa o que ja foi mostrado.
  async function loadFresh(typeSet) {
    setLoading(true);
    setError(null);
    seenRef.current = new Set();
    try {
      const d = await api.mangaRecommend({ types: [...typeSet].join(","), seen: "" });
      setLinked(d.linked !== false);
      setRead(d.read || 0);
      setTopGenres(d.topGenres || []);
      const its = d.items || [];
      its.forEach((i) => seenRef.current.add(i.id));
      setItems(its);
      setHasMore(Boolean(d.hasMore));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // "Mais recomendacoes": acrescenta titulos NOVOS (diz ao servidor o que ja viu).
  async function loadMore() {
    setLoadingMore(true);
    try {
      const d = await api.mangaRecommend({
        types: [...types].join(","),
        seen: [...seenRef.current].join(","),
      });
      const fresh = (d.items || []).filter((i) => !seenRef.current.has(i.id));
      fresh.forEach((i) => seenRef.current.add(i.id));
      setItems((prev) => [...prev, ...fresh]);
      setHasMore(Boolean(d.hasMore) && fresh.length > 0);
      if (d.topGenres?.length) setTopGenres(d.topGenres);
    } catch {
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    loadFresh(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onToggle(id) {
    setTypes((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      loadFresh(next);
      return next;
    });
  }

  if (loading && !items.length) return <p className="status">A ver o que andas a ler...</p>;
  if (error) return <p className="status error">{error}</p>;

  if (!linked) {
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
        {read ? ` (${read} títulos analisados)` : ""}. Nunca te recomendo nada que já
        tenhas na lista.
      </p>

      <div className="manga-filter-block">
        <label className="manga-filter-label">Tipo (vazio = todos)</label>
        <MultiChips options={TYPES} value={types} onToggle={onToggle} />
      </div>

      {topGenres.length ? (
        <div className="manga-toptags">
          <span className="muted">Com base em:</span>
          {topGenres.map((g) => (
            <span key={g} className="genre-chip want">
              {g}
            </span>
          ))}
        </div>
      ) : null}

      {loading ? (
        <p className="status">A escolher recomendações...</p>
      ) : items.length ? (
        <>
          <div className="grid" style={{ marginTop: 18 }}>
            {items.map((it) => (
              <MangaCard key={it.id} item={it} />
            ))}
          </div>
          {hasMore && (
            <div className="load-more-wrap">
              <button className="load-more" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? "A procurar mais..." : "Mais recomendações"}
              </button>
            </div>
          )}
        </>
      ) : (
        <p className="muted" style={{ marginTop: 18 }}>
          Não consegui recomendar nada com estes tipos. Tira alguns filtros, ou lê (e
          marca no MAL) títulos com géneros, e tenta de novo.
        </p>
      )}
    </>
  );
}

// --- "Para ler": a lista plan_to_read do MAL (filtrada/ordenada no browser) ---
const TOREAD_SORTS = [
  { id: "rating", label: "Nota" },
  { id: "title", label: "Título" },
];

function ToRead() {
  const [data, setData] = useState(null); // { linked, items }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [types, setTypes] = useState(() => new Set());
  const [statuses, setStatuses] = useState(() => new Set());
  const [genreSel, setGenreSel] = useState(() => new Set());
  const [sort, setSort] = useState("rating");
  const [dir, setDir] = useState("desc");

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

  const all = data?.items || [];

  // Géneros que de facto aparecem na lista, por frequência (so estes interessam).
  const availGenres = useMemo(() => {
    const counts = new Map();
    for (const it of all) for (const g of it.genres || []) counts.set(g, (counts.get(g) || 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([g]) => g);
  }, [all]);

  const shown = useMemo(() => {
    let list = all.filter(
      (it) =>
        clientTypeMatch(it.mediaType, types) &&
        clientStatusMatch(it.status, statuses) &&
        clientGenreMatch(it.genres, genreSel)
    );
    const mul = dir === "asc" ? -1 : 1;
    list = [...list].sort((a, b) => {
      if (sort === "title") return a.title.localeCompare(b.title) * mul;
      // nota: em falta vai sempre para o fim
      if (a.rating == null && b.rating == null) return 0;
      if (a.rating == null) return 1;
      if (b.rating == null) return -1;
      return (b.rating - a.rating) * mul;
    });
    return list;
  }, [all, types, statuses, genreSel, sort, dir]);

  const toggleType = toggleInSet(setTypes);
  const toggleStatus = toggleInSet(setStatuses);
  const toggleGenre = toggleInSet(setGenreSel);

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

  if (!all.length) {
    return (
      <p className="muted" style={{ marginTop: 14 }}>
        A tua lista de "para ler" está vazia. Adiciona mangá ao plan to read no MAL.
      </p>
    );
  }

  return (
    <>
      <p className="muted" style={{ marginTop: 14 }}>
        Os títulos que marcaste como "para ler" (plan to read) no MyAnimeList
        {all.length ? ` (${all.length})` : ""}.
      </p>

      <div className="manga-filter-block">
        <label className="manga-filter-label">Tipo (vazio = todos)</label>
        <MultiChips options={TYPES} value={types} onToggle={toggleType} />
      </div>

      <div className="manga-filter-block">
        <label className="manga-filter-label">Estado (vazio = qualquer)</label>
        <MultiChips options={STATUSES} value={statuses} onToggle={toggleStatus} />
      </div>

      <div className="manga-filter-block">
        <label className="manga-filter-label">Ordenar</label>
        <div className="lib-sort">
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            {TOREAD_SORTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <button
            className="lib-sort-dir"
            title={dir === "desc" ? "Decrescente" : "Crescente"}
            onClick={() => setDir((d) => (d === "desc" ? "asc" : "desc"))}
          >
            {dir === "desc" ? "↓" : "↑"}
          </button>
        </div>
      </div>

      {availGenres.length > 0 && (
        <div className="manga-filter-block">
          <label className="manga-filter-label">
            Géneros{genreSel.size ? ` (${genreSel.size})` : ""}
          </label>
          <div className="genre-grid">
            {availGenres.map((g) => (
              <button
                key={g}
                className={`genre-chip ${genreSel.has(g) ? "want" : ""}`}
                onClick={() => toggleGenre(g)}
              >
                {genreSel.has(g) ? "+ " : ""}
                {g}
              </button>
            ))}
          </div>
        </div>
      )}

      {shown.length ? (
        <div className="grid" style={{ marginTop: 18 }}>
          {shown.map((it) => (
            <MangaCard key={it.id} item={it} />
          ))}
        </div>
      ) : (
        <p className="muted" style={{ marginTop: 18 }}>
          Nada na tua lista com estes filtros.
        </p>
      )}
    </>
  );
}

// --- Procura por filtros ---
function Filters() {
  const { settings } = useSettings();
  const [types, setTypes] = useState(() => new Set(["manhwa"]));
  const [statuses, setStatuses] = useState(() => new Set());
  const [notInList, setNotInList] = useState(false);
  const [sort, setSort] = useState("popularity");
  const [dir, setDir] = useState("desc");
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
  const toggleStatus = toggleInSet(setStatuses);
  const toggleGenre = toggleInSet(setGenreSel);

  async function search(p = 1) {
    setLoading(true);
    setSearched(true);
    try {
      const d = await api.mangaDiscover({
        types: [...types].join(","),
        statuses: [...statuses].join(","),
        genres: [...genreSel].join(","),
        notInList: notInList ? "1" : "",
        sort,
        dir,
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
        Escolhe um ou mais tipos, um ou mais estados e os géneros/temas (ex.:
        Romance, Viagem no tempo) — eu trago títulos com essas tags.
      </p>

      <div className="manga-filter-block">
        <label className="manga-filter-label">Tipo (vazio = todos)</label>
        <MultiChips options={TYPES} value={types} onToggle={toggleType} />
      </div>

      <div className="manga-filter-block">
        <label className="manga-filter-label">Estado (vazio = qualquer)</label>
        <MultiChips options={STATUSES} value={statuses} onToggle={toggleStatus} />
      </div>

      <div className="manga-filter-block">
        <label className="manga-filter-label">Ordenar</label>
        <div className="lib-sort">
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            {SORTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <button
            className="lib-sort-dir"
            title={dir === "desc" ? "Decrescente" : "Crescente"}
            onClick={() => setDir((d) => (d === "desc" ? "asc" : "desc"))}
          >
            {dir === "desc" ? "↓" : "↑"}
          </button>
        </div>
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
