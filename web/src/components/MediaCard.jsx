import { useState } from "react";
import { Link } from "react-router-dom";
import { imageUrl } from "../api/client.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { useLibrary } from "../library/LibraryContext.jsx";
import { CheckIcon } from "./icons.jsx";
import { useT } from "../i18n/I18nContext.jsx";

export default function MediaCard({ item, landscape = false }) {
  const t = useT();
  const { user } = useAuth();
  const lib = useLibrary();
  // Prefer the user's library state (se existir) — senão, o estado vem do catálogo.
  const entry = lib ? lib.getEntry(item.type, item.id) : null;
  const watched = entry?.watched ? true : item.watched;
  const watchlist = entry?.watchlist ? true : item.watchlist;
  // `!watched` faz parte do que decide se o botao DESENHA. Sem isto o `+`
  // aparecia em cima do selo de visto e nao fazia nada: o `quickAdd` de baixo
  // faz `if (!canQuickAdd || watched) return`, ou seja num cartaz ja visto o
  // clique era engolido. Pior do que nao ter botao: parecia clicavel e era
  // inerte. O proprio comentario do botao diz "so' quando ainda nao foi visto".
  const canQuickAdd = Boolean(user) && lib && !lib.loading && !watched;

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

  // Ação do botão de quick-add. O botão so' desenha quando `canQuickAdd`, e esse
  // ja exclui os cartaz vistos — por isso o ramo "visto" abaixo deixou de fazer
  // sentido e foi removido: prometia "Ver detalhes" num botao que, em cartaz
  // visto, nao levava a lado nenhum. A navegacao continua a funcionar pelo
  // cartaz, que e' um `Link` ao detalhe.
  const quickAria = watchlist ? t("Marcar como visto") : t("Adicionar à minha lista");

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
         {watched && (
            <div className="card-watched" title="Visto">
              <CheckIcon />
            </div>
          )}
         {watchlist && !watched && <div className="card-watchlist">+</div>}
         {entry?.score != null && (
           <div className="card-score" title={t("A tua nota")}>
             <svg
               aria-hidden="true"
               width="12"
               height="12"
               viewBox="0 0 24 24"
               fill="currentColor"
             >
               {/* Pontos de VERDADE (pares x,y). A versao anterior era
                    `points="12 2l3 7h7l-5 4 2 7-6-4-6 4 2-7-5-4h7z"`, que e'
                    sintaxe de `<path d>` — comandos `l`, `h` — metida no atributo
                    `points`, que so' aceita pares de numeros. O browser lia
                    ZERO vertices e a estrela nao desenhava (medido: 0x0). */}
                <polygon points="12 2 15 9 22 9 17 13 19 20 12 16 5 20 7 13 2 9 9 9" />
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
                // visto (antes era um "olhinho" desenhado à mão, que saía
                // como um rabisco — um tick é mais claro para esta acção)
                <path d="M20 6 9 17l-5-5" />
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
