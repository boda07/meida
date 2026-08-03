import { useState } from "react";
import { Link } from "react-router-dom";
import { imageUrl } from "../api/client.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { useLibrary } from "../library/LibraryContext.jsx";

export default function MediaCard({ item, landscape = false }) {
  const { user } = useAuth();
  const lib = useLibrary();
  // Prefer the user's library state (se existir) — senão, o estado vem do catálogo.
  const entry = lib ? lib.getEntry(item.type, item.id) : null;
  const watched = entry?.watched ? true : item.watched;
  const watchlist = entry?.watchlist ? true : item.watchlist;
  const canQuickAdd = Boolean(user) && lib && !lib.loading;

  // Adiciona rapidamente à library (watchlist) ou marca como visto. Optimista.
  async function quickAdd(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!canQuickAdd || watched) return;
    try {
      if (watchlist) {
        await lib.markWatched(item.type, item.id, item.title, item.poster, entry?.score);
      } else {
        await lib.quickAdd(item.type, item.id, item.title, item.poster);
      }
    } catch {
      /* silencioso: o estado volta ao servidor na próxima refresh */
    }
  }

  // Escolhe poster (portrait) ou backdrop (landscape)
  const img = landscape
    ? imageUrl(item.backdrop, "w500")
    : imageUrl(item.poster, "w342");
  const [broken, setBroken] = useState(false);

  const subtitle = item.type === "tv" ? `${item.year || ""} · Série` : item.year;

  // Ação do botão de quick-add (depende do estado actual).
  let quickAria = "Adicionar à minha lista";
  if (watchlist && !watched) {
    quickAria = "Marcar como visto";
  } else if (watched) {
    quickAria = "Ver detalhes";
  }

  return (
    <Link
      to={`/details/${item.type}/${item.id}`}
      className={`card ${landscape ? "card-landscape" : "card-portrait"}`}
    >
      <div className="card-poster">
        {img && !broken ? (
          <img src={img} alt={item.title} loading="lazy" onError={() => setBroken(true)} />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              background: "#333",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {item.title}
          </div>
        )}
         <div className="card-scrim" />
         {item.new && <div className="card-badge">NOVO</div>}
         {watched && <div className="card-watched">✓</div>}
         {watchlist && !watched && <div className="card-watchlist">+</div>}
         {entry?.score != null && (
           <div className="card-score" title="A tua nota">
             <svg
               aria-hidden="true"
               width="12"
               height="12"
               viewBox="0 0 24 24"
               fill="currentColor"
             >
               <polygon points="12 2l3 7h7l-5 4 2 7-6-4-6 4 2-7-5-4h7z" />
             </svg>
             {Math.round(entry.score)}
           </div>
         )}
        {/* Botão rápido: (+) para adicionar à lista; marca visto se já está na lista.
            Só aparece para utilizadores autenticados e só quando ainda não foi visto. */}
        {canQuickAdd && (
          <button
            className={`quick-add ${watchlist && !watched ? "mark" : ""}`}
            onClick={quickAdd}
            title={quickAria}
            aria-label={quickAria}
          >
            <svg
              aria-hidden="true"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {watchlist && !watched ? (
                // olhinho a confirmar que foi visto
                <path d="M1 12s6 6 11 11 11-5 11-11S17 1 12 1 1 12z" />
              ) : (
                // cruz +
                <>
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </>
              )}
            </svg>
          </button>
        )}
      </div>
      <div className="card-footer">
        <h3 className="card-title">{item.title}</h3>
        {subtitle && <div className="card-subtitle">{subtitle}</div>}
      </div>
      {item.progress && (
        <div className="card-progress">
          <div className="card-progress-bar" style={{ width: `${item.progress}%` }} />
        </div>
      )}
    </Link>
  );
}
