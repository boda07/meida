import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api/client.js";
import { useSettings } from "../settings/SettingsContext.jsx";
import MediaCard from "../components/MediaCard.jsx";

export default function Search() {
  const [params] = useSearchParams();
  const { settings } = useSettings();
  const q = params.get("q") || "";
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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

  return (
    <div className="sub-page">
      <h2 className="row-title">Resultados para "{q}"</h2>
      <div className="grid">
        {results.map((item) => (
          <MediaCard key={`${item.type}-${item.id}`} item={item} />
        ))}
      </div>
    </div>
  );
}
