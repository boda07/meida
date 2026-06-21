import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import { useSettings } from "../settings/SettingsContext.jsx";
import MediaRow from "../components/MediaRow.jsx";
import Hero from "../components/Hero.jsx";

// Escolhe um item aleatorio com backdrop para o banner.
function pickHero(rows) {
  const pool = rows.flatMap((r) => r.items).filter((i) => i.backdrop);
  return pool.length ? pool[Math.floor(Math.random() * Math.min(pool.length, 8))] : null;
}

export default function Category({ category, title }) {
  const { settings } = useSettings();
  const [rows, setRows] = useState([]);
  const [hero, setHero] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

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
  }, [category, settings.titleLang, settings.overviewLang]);

  if (loading) return <p className="status">A carregar {title}...</p>;
  if (error) return <p className="status error">{error}</p>;

  return (
    <div className={`catalog-page ${hero ? "" : "no-hero"}`}>
      {hero && <Hero item={hero} />}
      <div className="rows">
        {rows.map((row) => (
          <MediaRow key={row.id} title={row.title} items={row.items} />
        ))}
      </div>
    </div>
  );
}
