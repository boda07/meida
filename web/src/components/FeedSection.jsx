// O feed de atividade com o seu proprio estado e cabecalho.
//
// Usado em dois sitios:
//   * Home, como conteudo principal (`showHeader`);
//   * perfil, dentro da aba "Atividade" (`username`).
//
// A lista em si e' `ActivityList` (sem estado); este componente so' liga o
// gancho ao desenho.
import { Link } from "react-router-dom";
import { useT } from "../i18n/I18nContext.jsx";
import { useAtividade } from "../activity/useAtividade.js";
import ActivityList from "./ActivityList.jsx";

export default function FeedSection({ username = null, showHeader = false }) {
  const t = useT();
  const { items, loading, loadingMore, error, errorMais, hasMore, carregarMais } = useAtividade({
    username,
  });

  const empty = username ? (
    <p className="muted">
      {t("Ainda não há atividade. Marca um episódio ou um filme como visto e aparece aqui.")}
    </p>
  ) : (
    <div className="feed-empty">
      <p>{t("Ainda não há atividade por aqui.")}</p>
      <p className="muted">
        {t("Segue pessoas para veres o que andam a ver — ou marca um episódio como visto.")}
      </p>
      <Link className="modal-btn" to="/users">
        {t("Descobrir pessoas")}
      </Link>
    </div>
  );

  return (
    <section className={`feed ${showHeader ? "feed-home" : "feed-profile"}`}>
      {showHeader && (
        <header className="feed-head">
          <div>
            <p className="feed-eyebrow">{t("A tua rede")}</p>
            <h1 className="feed-title">{t("O que andam a ver")}</h1>
            <p className="feed-sub">{t("A atividade recente de quem segues.")}</p>
          </div>
          <Link className="feed-people-link" to="/users">
            {t("Descobrir pessoas")}
          </Link>
        </header>
      )}

      <ActivityList
        items={items}
        loading={loading}
        error={error}
        empty={empty}
      />

      {/* Erro da pagina SEGUINTE: a lista fica, e o botao continua la' para
          tentar outra vez. Antes, um erro aqui substituia o feed inteiro por
          uma mensagem e o botao desaparecia. */}
      {errorMais && (
        <p className="status error">
          {t("Não foi possível carregar mais atividade: {erro}", { erro: errorMais })}
        </p>
      )}

      {hasMore && !loading && !error && (
        <div className="feed-more">
          <button
            className="lib-pager-btn"
            onClick={carregarMais}
            disabled={loadingMore}
          >
            {loadingMore ? t("A carregar...") : t("Carregar mais")}
          </button>
        </div>
      )}
    </section>
  );
}
