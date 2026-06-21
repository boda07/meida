import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";
import { useAuth } from "../auth/AuthContext.jsx";

// Controlos de biblioteca para a pagina de detalhe: marcar como visto e nota 1-10.
export default function LibraryControls({ details }) {
  const { user } = useAuth();
  const [entry, setEntry] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user) return;
    setEntry(null);
    api
      .libraryItem(details.type, details.id)
      .then((d) => setEntry(d.item))
      .catch((e) => setError(e.message));
  }, [user, details.type, details.id]);

  if (!user) {
    return (
      <p className="muted lib-login-hint">
        <Link to="/login">Entra</Link> para marcares como visto e dares nota.
      </p>
    );
  }

  async function save(patch) {
    setError(null);
    try {
      const d = await api.saveLibrary({
        tmdbId: details.id,
        type: details.type,
        title: details.title,
        poster: details.poster,
        genres: details.genres || [],
        ...patch,
      });
      setEntry(d.item);
    } catch (e) {
      setError(e.message);
    }
  }

  const watched = entry?.watched || false;
  const watchlist = entry?.watchlist || false;
  const score = entry?.score || "";

  return (
    <div className="lib-controls">
      <button
        className={`lib-watchlist ${watchlist ? "on" : ""}`}
        onClick={() => save({ watchlist: !watchlist })}
      >
        {watchlist ? "✓ Na watchlist" : "+ Watchlist"}
      </button>

      <button
        className={`lib-watched ${watched ? "on" : ""}`}
        onClick={() => save({ watched: !watched })}
      >
        {watched ? "✓ Visto" : "Marcar como visto"}
      </button>

      <label className="lib-score">
        Nota:
        <select
          value={score}
          onChange={(e) =>
            save({ score: e.target.value ? Number(e.target.value) : null })
          }
        >
          <option value="">—</option>
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>

      {error && <span className="auth-error">{error}</span>}
    </div>
  );
}
