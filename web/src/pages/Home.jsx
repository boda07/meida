import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import { useSettings } from "../settings/SettingsContext.jsx";
import MediaRow from "../components/MediaRow.jsx";
import ContinueWatching from "../components/ContinueWatching.jsx";
import Hero from "../components/Hero.jsx";

// Escolhe varios destaques (com imagem de fundo) para o slideshow do banner.
function pickHeroes(rows, n = 6) {
  const seen = new Set();
  const pool = rows
    .flatMap((r) => r.items)
    .filter((i) => i.backdrop && (seen.has(i.id) ? false : seen.add(i.id)));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, n);
}

export default function Home() {
  const { settings } = useSettings();
  const [rows, setRows] = useState([]);
  const [heroes, setHeroes] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .catalog()
      .then((d) => {
        setRows(d.rows);
        setHeroes(pickHeroes(d.rows));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [settings.titleLang, settings.overviewLang]);

  if (loading) return <p className="status">A carregar...</p>;
  if (error)
    return (
      <div className="status error">
        <p>Não consegui carregar o catálogo: {error}</p>
        <p className="muted">
          Verifica que criaste <code>server/.env</code> com a tua chave do TMDB.
        </p>
      </div>
    );

  return (
    <div className="catalog-page home">
      <Hero items={heroes} />
      <div className="rows">
        <ContinueWatching />
        {rows.map((row) => (
          <MediaRow key={row.id} title={row.title} items={row.items} />
        ))}
      </div>
    </div>
  );
}
