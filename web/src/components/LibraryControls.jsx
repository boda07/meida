import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, openExternal } from "../api/client.js";
import { useAuth } from "../auth/AuthContext.jsx";

// Controlos de biblioteca para a página de detalhe: marcar como visto e nota 1-100.
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
        rating: details.rating ?? null,
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
          {Array.from({ length: 100 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>

      {details.type === "movie" && (
        <button
          className="lib-letterboxd"
          onClick={() => openExternal(`https://letterboxd.com/tmdb/${details.id}/`)}
          title="Abrir no Letterboxd"
        >
          Letterboxd
        </button>
      )}

      {/* Barra: a tua nota vs a média da comunidade (ambas em 0-100). */}
      <CommunityRatingBar community={details.rating} user={entry?.score} />

      {error && <span className="auth-error">{error}</span>}
    </div>
  );
}

// Barra comparativa de notas: comunidade (detalhe) vs a tua nota (library).
// Ambas convertdas para a mesma escala 0-100 para se sobrepor na mesma barra.
function CommunityRatingBar({ community, user }) {
  const comm = community != null ? Math.round(Number(community) * 10) : null; // 0-10 → 0-100
  const me = user != null ? Number(user) : null;
  if (comm == null && me == null) return null;

  return (
    <div className="lib-rating-bar">
      <div className="lib-rating-head">
        <span>Comparar com a comunidade</span>
        <span className="lib-rating-values">
          {comm != null && <span className="lib-rating-comm">Comunidade: {comm}</span>}
          {me != null && <span className="lib-rating-mine">Tu: {me}</span>}
        </span>
      </div>
      <div className="lib-rating-track">
        {/* fundo cinzento da escala */}
        <div className="lib-rating-scale" />
        {/* marca da comunidade */}
        {comm != null && <div className="lib-rating-mark comm" style={{ left: `${Math.min(100, Math.max(0, comm))}%` }} />}
        {/* barra da tua nota (se não houver, não mostra) */}
        {me != null && (
          <div
            className={`lib-rating-fill ${comm != null && me > comm ? "above" : ""}`}
            style={{ width: `${Math.min(100, Math.max(0, me))}%` }}
          />
        )}
        {/* marca da tua nota sobre a barra */}
        {me != null && <div className="lib-rating-mark mine" style={{ left: `${Math.min(100, Math.max(0, me))}%` }} />}
      </div>
    </div>
  );
}
