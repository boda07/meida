import { useAuth } from "../auth/AuthContext.jsx";
import ContinueWatching from "../components/ContinueWatching.jsx";
import FeedSection from "../components/FeedSection.jsx";
import LoadingStatus from "../components/LoadingStatus.jsx";
import MediaRow from "../components/MediaRow.jsx";
import { useT } from "../i18n/I18nContext.jsx";
import { useCatalogo } from "../home/useCatalogo.js";

/**
 * @param {object} p
 * @param {string} [p.generos]  os generos escolhidos no onboarding, separados
 *   por virgulas, ja em pronto para o `/api/discover`. Vem do `App.jsx`.
 *
 * A pagina comeca pelo **feed de atividade**: a app e' para ver coisas, e o que
 * os outros andam a ver e' a melhor porta de entrada. O catalogo fica logo
 * abaixo, para nao se perder a descoberta: a linha dos generos escolhidos no
 * onboarding continua a ser a primeira das rows.
 *
 * Os dados vem de `useCatalogo`; a pagina desenha e nada mais.
 */
export default function Home({ generos = "" }) {
  const t = useT();
  const { user } = useAuth();
  const { rows, porGenero, error, loading } = useCatalogo(generos);

  return (
    <div className="catalog-page home home-feed-page">
      {/* O feed aparece sempre, mesmo que o catalogo ainda esteja a carregar (ou
          tenha falhado). Antes, um erro do TMDB escondia a pagina inteira — e o
          feed nao depende do TMDB para nada.
          Sem sessao nao ha feed: `/api/feed` exige autenticacao e um 401 no
          primeiro bloco da Home parecia a app partida a quem so' quer espreitar
          o catalogo. Quem nao tem conta ve o catalogo de sempre. */}
      {user ? <FeedSection showHeader /> : null}

      <div className="rows">
        <ContinueWatching />
        {error ? (
          <div className="status error">
            <p>{t("Não consegui carregar o catálogo: {erro}", { erro: error })}</p>
            <p className="muted">
              {t("Verifica que criaste {ficheiro} com a tua chave do TMDB.", {
                ficheiro: <code>server/.env</code>,
              })}
            </p>
          </div>
        ) : loading ? (
          <LoadingStatus>{t("A carregar")}</LoadingStatus>
        ) : (
          <>
            {porGenero ? (
              <MediaRow
                key={porGenero.id}
                title={porGenero.title}
                items={porGenero.items}
                // A row dos generos nao e' uma lista fixa: leva os escolhidos no
                // onboarding e o titulo ja' traduzido (o servidor nao sabe qual e').
                href={`/all/ob-generos?genres=${encodeURIComponent(generos)}&title=${encodeURIComponent(porGenero.title)}`}
              />
            ) : null}
            {rows.map((row) => (
              // "Ver todos" abre a lista COMPLETA desta linha (paginada), nao a
              // categoria inteira: "Filmes populares" tem de abrir os filmes
              // populares, e nao a pagina de Filmes com as suas proprias rows.
              <MediaRow key={row.id} title={t(row.title)} items={row.items} href={`/all/${row.id}`} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
