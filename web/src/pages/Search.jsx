import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api/client.js";
import { useSettings } from "../settings/SettingsContext.jsx";
import MediaRow from "../components/MediaRow.jsx";

const TYPE_FILTERS = [
  { id: "all", label: "Tudo" },
  { id: "movie", label: "Filmes" },
  { id: "tv", label: "Séries" },
  { id: "anime", label: "Anime" },
];

export default function Search() {
  const [params] = useSearchParams();
  const { settings } = useSettings();
  const q = params.get("q") || "";
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [typeFilter, setTypeFilter] = useState("all");

  useEffect(() => {
    if (!q) {
      setResults([]);
      return;
    }
    setLoading(true);
    setError(null);
    const t = setTimeout(() => {
      api
        .search(q)
        .then((d) => setResults(d.results))
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [q, settings.titleLang, settings.overviewLang]);

  if (!q) return <p className="status muted">Escreve algo na pesquisa.</p>;
  if (loading) return <p className="status">A procurar "{q}"...</p>;
  if (error) return <p className="status error">{error}</p>;
  if (!results.length)
    return <p className="status muted">Sem resultados para "{q}".</p>;

  // Agrupa por tipo (estilo Stremio): Filmes / Séries / Anime.
  const groups = [
    { type: "movie", label: "Filmes" },
    { type: "tv", label: "Séries" },
    { type: "anime", label: "Anime" },
  ]
    .filter((g) => typeFilter === "all" || typeFilter === g.type)
    .map((g) => ({ ...g, items: results.filter((r) => r.type === g.type) }))
    .filter((g) => g.items.length);

  return (
    <div className="sub-page">
      <h2 className="row-title">Resultados para "{q}"</h2>
      <div className="lib-filters">
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
      <div className="rows">
        {groups.map((g) => (
          <MediaRow
            key={g.type}
            title={`${g.label} (${g.items.length})`}
            items={g.items}
          />
        ))}
      </div>
    </div>
  );
}
