import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import { useSettings } from "../settings/SettingsContext.jsx";
import MediaRow from "../components/MediaRow.jsx";
import ContinueWatching from "../components/ContinueWatching.jsx";
import Hero from "../components/Hero.jsx";

function pickHero(rows) {
  const pool = rows.flatMap((r) => r.items).filter((i) => i.backdrop);
  return pool.length ? pool[Math.floor(Math.random() * Math.min(pool.length, 8))] : null;
}

export default function Home() {
  const { settings } = useSettings();
  const [rows, setRows] = useState([]);
  const [hero, setHero] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .catalog()
      .then((d) => {
        setRows(d.rows);
        setHero(pickHero(d.rows));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [settings.titleLang, settings.overviewLang]);

  if (loading) return <p className="status">A carregar...</p>;
  if (error)
    return (
      <div className="status error">
        <p>Nao consegui carregar o catalogo: {error}</p>
        <p className="muted">
          Verifica que criaste <code>server/.env</code> com a tua chave do TMDB.
        </p>
      </div>
    );

  return (
    <div className="catalog-page">
      <Hero item={hero} />
      <div className="rows">
        <ContinueWatching />
        {rows.map((row) => (
          <MediaRow key={row.id} title={row.title} items={row.items} />
        ))}
      </div>
    </div>
  );
}
