// Seletor de provider de embed + atalhos para sites externos.
//
// Para adicionar/remover um site basta editar a lista `EXTERNAL_SITES`. Cada
// entrada recebe (title, isMovie, season, episode, slug, epString) e devolve
// o URL (ou null para não mostrar). `slug` é o título normalizado (ex.:
// "Marvel's Luke Cage" -> "marvels-luke-cage") e `epString` é "S02E06".

// Slug normalizado: minúsculas, sem acentos/apóstrofos, hífens.
function toSlug(title) {
  if (!title) return "";
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/'/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// Padrões de URL das redes clonadas tipo "ridomovies". Usam
// /tv/<slug>/season-<s>/episode-<e> para séries.
const tvPath = ({ slug, season, episode }) =>
  `tv/${slug}/season-${season || 1}/episode-${episode || 1}`;

const rido = (domain) => (c) =>
  `https://${domain}/${c.isMovie ? "movie" : ""}/${c.isMovie ? c.slug : tvPath(c)}`;

const EXTERNAL_SITES = [
  { name: "RidoMovies", icon: "🎬", build: rido("ridomovies.su") },
  { name: "RidoMovies .top", icon: "🎬", build: rido("ridomovies.top") },
  { name: "RidoMovies .cv", icon: "🎬", build: rido("ridomovies.cv") },
  { name: "RidoMovies .rest", icon: "🎬", build: rido("ridomovies.rest") },
];

function buildExternal(title, isMovie, season, episode) {
  if (!title) return [];
  const slug = toSlug(title);
  if (!slug) return [];
  const epString = isMovie
    ? ""
    : `S${String(season || 1).padStart(2, "0")}E${String(episode || 1).padStart(2, "0")}`;
  const results = [];
  for (const site of EXTERNAL_SITES) {
    const url = site.build({ title, isMovie, slug, season, episode, epString });
    if (url) results.push({ name: site.name, icon: site.icon, url, title: site.title });
  }
  return results;
}

export default function SourceSelector({
  embeds,
  activeId,
  onSelect,
  deadIds,
  title,
  isMovie,
  season,
  episode,
}) {
  const extSites = buildExternal(title, isMovie, season, episode);

  const searchQuery = encodeURIComponent(
    `${title || ""} ${isMovie ? "" : `S${String(season || 1).padStart(2, "0")}E${String(episode || 1).padStart(2, "0")}`}`
      .trim()
  );
  const googleUrl = title
    ? `https://www.google.com/search?q=${searchQuery}+watch+online`
    : null;

  const hasEmbeds = Boolean(embeds?.length);

  return (
    <div className="sources-container">
      {hasEmbeds ? (
        <div className="sources">
          <span className="sources-label">Fonte:</span>
          <div className="sources-list">
            {embeds.map((e) => {
              const isDead = deadIds?.has(e.provider);
              return (
                <button
                  key={e.provider}
                  className={`source-btn ${e.provider === activeId ? "active" : ""} ${
                    isDead ? "dead" : ""
                  }`}
                  onClick={() => onSelect(e)}
                  title={isDead ? `${e.name}: em baixo (último teste falhou)` : e.name}
                >
                  {e.name}
                  {isDead && <span className="source-dead-tag">em baixo</span>}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="muted" style={{ marginBottom: 12 }}>
          Sem fontes internas disponíveis.
        </p>
      )}

      {(extSites.length || googleUrl) && (
        <div className="sources-external">
          <span className="sources-label">Site externo:</span>
          <div className="sources-list">
            {extSites.map((s) => (
              <a
                key={s.url}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="source-btn external-btn"
                title={`${s.name}: abrir ${isMovie ? "o filme" : "o episódio"} num novo separador`}
              >
                {s.icon} {s.name} ↗
              </a>
            ))}
            {googleUrl && (
              <a
                href={googleUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="source-btn external-btn"
                title="Procurar este filme/episódio no Google"
              >
                🔍 Pesquisar no Google ↗
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}