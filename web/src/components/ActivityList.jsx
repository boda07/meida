// A lista do feed de atividade. Componente burro: recebe os itens e desenha.
//
// A frase (a parte com regras: qual é o texto de cada `kind`) vem de
// `fraseDaAtividade`; a lista só desenha e trata dos estados (a carregar, erro,
// vazio). Assim o que tem lógica pode ser lido sem React à volta.
import { Link } from "react-router-dom";
import { imageUrl } from "../api/client.js";
import { useT } from "../i18n/I18nContext.jsx";
import { haQuanto, quandoCompleto } from "../lib/tempo.js";
import { linkDaAtividade } from "../lib/atividade.js";
import { fraseDaAtividade } from "../activity/fraseAtividade.jsx";
import Avatar from "./Avatar.jsx";
import LoadingStatus from "./LoadingStatus.jsx";

export default function ActivityList({ items, loading, error, empty }) {
  const t = useT();

  if (loading) return <LoadingStatus>{t("A carregar a atividade")}</LoadingStatus>;
  if (error) {
    return (
      <p className="status error">
        {t("Não foi possível carregar a atividade: {erro}", { erro: error })}
      </p>
    );
  }
  if (!items || items.length === 0) {
    return empty || <p className="muted">{t("Ainda não há atividade.")}</p>;
  }

  return (
    <ol className="activity-list">
      {items.map((it) => {
        const poster = imageUrl(it.poster, "w154");
        const href = linkDaAtividade(it);
        return (
          <li key={it.id} className="activity-item">
            <Link
              className="activity-avatar"
              to={`/u/${encodeURIComponent(it.user?.username || "")}`}
              aria-hidden="true"
              tabIndex={-1}
            >
              <Avatar
                avatar={it.user?.avatar}
                name={it.user?.username || "?"}
                size={40}
                userId={it.user?.id}
              />
            </Link>

            <div className="activity-body">
              <p className="activity-line">{fraseDaAtividade(it, t)}</p>
              <time
                className="activity-time"
                dateTime={it.watchedAt || undefined}
                title={quandoCompleto(it.watchedAt)}
              >
                {haQuanto(it.watchedAt)}
              </time>
            </div>

            <Link
              className={`activity-poster ${poster ? "" : "activity-poster-empty"}`}
              to={href}
              aria-hidden="true"
              tabIndex={-1}
            >
              {poster ? (
                <img src={poster} alt="" loading="lazy" />
              ) : (
                <span>{(it.title || "?").slice(0, 1).toUpperCase()}</span>
              )}
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
