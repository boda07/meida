import { useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { imageUrl } from "../api/client.js";
import { useSettings } from "../settings/SettingsContext.jsx";
import { useAuth } from "../auth/AuthContext.jsx";
import { useWatchParty } from "../watchparty/WatchPartyContext.jsx";
import Player from "../components/Player.jsx";
import SourceSelector from "../components/SourceSelector.jsx";
import LibraryControls from "../components/LibraryControls.jsx";
import CompareRating from "../components/CompareRating.jsx";
import Trailer from "../components/Trailer.jsx";
import AddToList from "../components/AddToList.jsx";
import Torrents from "../components/Torrents.jsx";
import Extract from "../components/Extract.jsx";
import AnimeExtract from "../components/AnimeExtract.jsx";
import LoadingStatus from "../components/LoadingStatus.jsx";
import MediaRow from "../components/MediaRow.jsx";
import Comments from "../components/Comments.jsx";
import { useT } from "../i18n/I18nContext.jsx";
import { nomeEpisodio, nomeTemporada } from "../details/nomes.js";
import { useRetoma } from "../details/useRetoma.js";
import { useDetalhes } from "../details/useDetalhes.js";
import { useAudioTitulo } from "../details/useAudioTitulo.js";
import { useAbasPlayer } from "../details/useAbasPlayer.js";
import { useFontes } from "../details/useFontes.js";
import { usePresenca } from "../details/usePresenca.js";
import { useProgresso } from "../details/useProgresso.js";
import { useDiario } from "../details/useDiario.js";
import { useWatchPartySync } from "../details/useWatchPartySync.js";
import { useBlocos, EP_BLOCK } from "../details/useBlocos.js";

// A ordem dos ganchos nao e' livre: cada um precisa do que o de cima devolve.
//   useRetoma -> useDetalhes -> useAudioTitulo -> useAbasPlayer -> useFontes
//   -> usePresenca -> useProgresso -> useDiario -> useWatchPartySync
export default function Details() {
  const t = useT();
  const { type, id } = useParams();
  const [searchParams] = useSearchParams();
  const { settings, update } = useSettings();
  const { user } = useAuth();
  const party = useWatchParty();

  const retoma = useRetoma(searchParams);
  const {
    details,
    error,
    setError,
    season,
    setSeason,
    episodes,
    setEpisodes,
    episode,
    setEpisode,
    animeSeasons,
    similar,
  } = useDetalhes({
    type,
    id,
    user,
    settings,
    idioma: t.idioma,
    t,
    retoma,
  });
  const { animeAudio, escolherAudio } = useAudioTitulo({
    details,
    animeAudioDefault: settings.animeAudio,
  });
  const { mode, setMode, extractOn, animeExtractorOn } = useAbasPlayer(settings.defaultTab);
  const {
    embeds,
    active,
    setActive: setActiveFonte,
    playerIndex,
    setPlayerIndex: setPlayerIndexFonte,
    fonteManual,
    fonteSalva,
    escolherFonte,
    wantedSourceRef,
    activeProviderRef,
    deadProviders,
  } = useFontes({ details, season, episode, animeAudio, settings, update, onError: setError });

  const { reportPos, posAtual } = usePresenca({
    user,
    details,
    active,
    season,
    episode,
    activeProviderRef,
  });
  const { startAt, nextEpisodePos } = useProgresso({
    user,
    details,
    season,
    episode,
    active,
    activeProviderRef,
    embeds,
    wantedSourceRef,
    setActive: setActiveFonte,
    setPlayerIndex: setPlayerIndexFonte,
    animeSeasons,
    episodes,
    resumeAtRef: retoma.resumeAtRef,
  });

  const { finishing, finishMsg, isMovieLike, markFinished } = useDiario({
    details,
    season,
    episode,
    t,
    nextEpisodePos,
  });

  useWatchPartySync({
    party,
    season,
    episode,
    mode,
    active,
    embeds,
    wantedSourceRef,
    setSeason,
    setEpisode,
    setMode,
    setActive: setActiveFonte,
    setPlayerIndex: setPlayerIndexFonte,
  });

  const { epStart, setEpStart, manyEps, epRanges, visibleEpisodes } = useBlocos(episodes, episode);

  // Comparar avaliacao (botao proprio, com a sessao iniciada).
  const [compareOpen, setCompareOpen] = useState(false);

  if (error) return <p className="status error">{error}</p>;
  if (!details) return <LoadingStatus>{t("A carregar")}</LoadingStatus>;

  const backdrop = imageUrl(details.backdrop, "w1280");

  return (
    <div className="details">
      {backdrop && (
        <div
          className="details-backdrop"
          style={{ backgroundImage: `url(${backdrop})` }}
        />
      )}

      <div className="details-head">
        {imageUrl(details.poster, "w342") && (
          <img
            className="details-poster"
            src={imageUrl(details.poster, "w342")}
            alt={details.title}
          />
        )}
        <div className="details-meta">
          <h1>
            {details.title}{" "}
            {details.year && <span className="muted">({details.year})</span>}
          </h1>
          <div className="details-tags">
            {details.rating && <span className="tag">⭐ {details.rating}</span>}
            {details.runtime && (
              <span className="tag">
                {details.runtime} {t("min")}
              </span>
            )}
            {details.genres?.map((g) => (
              <span className="tag" key={g}>
                {g}
              </span>
            ))}
          </div>
          <p className="details-overview">{details.overview || t("Sem sinopse.")}</p>
          <div className="details-actions">
            <Trailer src={details.trailer} />
            <AddToList details={details} />
            <LibraryControls details={details} />
            {user && (
              <button
                type="button"
                className="lib-trailer"
                onClick={() => setCompareOpen(true)}
              >
                {t("⚖ Comparar avaliação")}
              </button>
            )}
          </div>
        </div>
      </div>

      {(details.type === "tv" || (details.isAnime && !details.isMovie)) && (
        <div className="episodes">
          {(details.type === "tv"
            ? details.seasons?.length
            : animeSeasons.length > 1) && (
            <div className="season-picker">
              <label>{t("Temporada:")}</label>
              <select
                value={season}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  setSeason(n);
                  // Anime: os episodios da temporada ja estao em memoria.
                  if (details.isAnime) {
                    const s = animeSeasons.find((x) => x.seasonNumber === n);
                    if (s) setEpisodes(s.episodes);
                  }
                }}
              >
                {details.type === "tv"
                  ? details.seasons?.map((s) => (
                      <option key={s.seasonNumber} value={s.seasonNumber}>
                        {nomeTemporada(s, t)} ({s.episodeCount} eps)
                      </option>
                    ))
                  : animeSeasons.map((s) => (
                      <option key={s.seasonNumber} value={s.seasonNumber}>
                        {nomeTemporada(s, t)} ({s.episodes.length} eps)
                      </option>
                    ))}
              </select>
            </div>
          )}
          {manyEps && (
            <div className="ep-ranges">
              {epRanges.map((start) => {
                const end = Math.min(start + EP_BLOCK, episodes.length);
                return (
                  <button
                    key={start}
                    className={`tf-chip ${epStart === start ? "active" : ""}`}
                    onClick={() => setEpStart(start)}
                  >
                    {start + 1}-{end}
                  </button>
                );
              })}
            </div>
          )}
          <div className="episode-list">
            {visibleEpisodes.map((ep) => (
              <button
                key={ep.episodeNumber}
                className={`episode-btn ${
                  ep.episodeNumber === episode ? "active" : ""
                }`}
                onClick={() => setEpisode(ep.episodeNumber)}
              >
                <span className="ep-num">{ep.episodeNumber}</span>
                <span className="ep-name">{nomeEpisodio(ep.name, t)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {details.isAnime ? (
        <div className="watch">
          <div className="anime-audio-bar">
            <span className="muted" style={{ fontSize: 12 }}>
              {t("Áudio deste título:")}
            </span>
            <div className="mode-tabs" style={{ margin: 0 }}>
              <button
                className={animeAudio === "sub" ? "active" : ""}
                onClick={() => escolherAudio("sub")}
              >
                {t("Legendado")}
              </button>
              <button
                className={animeAudio === "dub" ? "active" : ""}
                onClick={() => escolherAudio("dub")}
              >
                {t("Dobrado")}
              </button>
            </div>
          </div>
          {(animeExtractorOn || details.imdbId) && (
            <div className="mode-tabs">
              <button
                className={mode !== "extract" && mode !== "torrents" ? "active" : ""}
                onClick={() => setMode("providers")}
              >
                {t("Fontes")}
              </button>
              {animeExtractorOn && (
                <button
                  className={mode === "extract" ? "active" : ""}
                  onClick={() => setMode("extract")}
                >
                  {t("Sem anúncios")}
                </button>
              )}
              {details.imdbId && (
                <button
                  className={mode === "torrents" ? "active" : ""}
                  onClick={() => setMode("torrents")}
                >
                  {t("Torrents")}
                </button>
              )}
            </div>
          )}

          {animeExtractorOn && mode === "extract" ? (
            <AnimeExtract
              details={details}
              episode={details.isMovie ? 1 : episode}
              startAt={startAt}
              onProgress={reportPos}
              audio={animeAudio}
            />
          ) : mode === "torrents" && details.imdbId ? (
            <Torrents
              type={details.isMovie ? "movie" : "tv"}
              imdb={details.imdbId}
              title={details.title}
              season={1}
              episode={details.isMovie ? 1 : episode}
              anime
              defaultAudio={animeAudio}
              onAudioChange={escolherAudio}
              startAt={startAt}
              onProgress={reportPos}
            />
          ) : (
            <>
            <SourceSelector
              embeds={embeds}
              savedSource={fonteSalva}
              onSelect={escolherFonte}
              deadIds={deadProviders}
              title={details.title}
              isMovie={details.isMovie}
              season={season}
              episode={episode}
            />
            {embeds.length ? (
              <Player
                embeds={embeds}
                deadIds={deadProviders}
                title={details.title}
                startIndex={playerIndex}
                manual={fonteManual}
                startAt={startAt}
                onProgress={reportPos}
                audio={animeAudio}
              />
            ) : (
              <p className="muted">{t("A carregar fontes...")}</p>
            )}
            <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
              {t("Fontes dedicadas de anime (sub/dub via MyAnimeList). O seletor de áudio em cima só afeta este título.")}
            </p>
            {party?.active && (
              <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                {t("🔴 Watch Party: estas fontes são em iframe, o play/pausa {nao} sincroniza — usem {torrents} para verem em sincronia.", {
                  nao: <b>{t("não")}</b>,
                  torrents: <b>{t("Torrents")}</b>,
                })}
              </p>
            )}
            </>
          )}
        </div>
      ) : (
      <div className="watch">
        <div className="mode-tabs">
          <button
            className={mode === "providers" ? "active" : ""}
            onClick={() => setMode("providers")}
          >
            Providers
          </button>
          {extractOn && (
            <button
              className={mode === "extract" ? "active" : ""}
              onClick={() => setMode("extract")}
            >
              Sem anúncios
            </button>
          )}
          <button
            className={mode === "torrents" ? "active" : ""}
            onClick={() => setMode("torrents")}
          >
            Torrents
          </button>
        </div>

        {mode === "providers" && (
          <>
            <SourceSelector
              embeds={embeds}
              savedSource={fonteSalva}
              onSelect={escolherFonte}
              deadIds={deadProviders}
              title={details.title}
              isMovie={details.isMovie}
              season={season}
              episode={episode}
            />
            {embeds.length ? (
              <Player
                embeds={embeds}
                deadIds={deadProviders}
                title={details.title}
                startIndex={playerIndex}
                manual={fonteManual}
                startAt={startAt}
                onProgress={reportPos}
                audio={animeAudio}
              />
            ) : (
              <p className="muted">{t("A carregar fontes...")}</p>
            )}
            <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
              {t("As legendas próprias (incl. português) só funcionam no separador {torrents}{extra} (os Providers são páginas externas em iframe).", {
                torrents: <b>{t("Torrents")}</b>,
                extra: extractOn ? <> e <b>{t("Sem anúncios")}</b></> : null,
              })}
            </p>
            {party?.active && (
              <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                {t("🔴 Watch Party: aqui (Providers) o play/pausa {nao} sincroniza — usem {torrents}{extra} para verem em sincronia.", {
                  nao: <b>{t("não")}</b>,
                  torrents: <b>{t("Torrents")}</b>,
                  extra: extractOn ? <> ou <b>{t("Sem anúncios")}</b></> : null,
                })}
              </p>
            )}
          </>
        )}
        {mode === "extract" && extractOn && (
          <Extract
            details={details}
            season={season}
            episode={episode}
            startAt={startAt}
            onProgress={reportPos}
          />
        )}
        {mode === "torrents" && (
          <Torrents
            type={details.type}
            imdb={details.imdbId}
            title={details.title}
            season={season}
            episode={episode}
            startAt={startAt}
            onProgress={reportPos}
          />
        )}
      </div>
      )}

      {similar.length > 0 && (
        <MediaRow
          title={t("Se gostaste disto")}
          items={similar}
        />
      )}

      {user && (
        <div className="scrobble-bar">
          <button className="btn scrobble-btn" onClick={markFinished} disabled={finishing}>
            {finishing
              ? t("A guardar...")
              : isMovieLike
              ? t("✓ Marcar como visto")
              : t("✓ Terminei o episódio {n}", { n: episode })}
          </button>
          {!isMovieLike && (
            <span className="muted" style={{ fontSize: 12 }}>
              {t("Guarda no diário e avança o {b} para o próximo episódio{mal}", {
                // O `{b}` e' o nome de um botao/separador, portanto tem de passar
                // pelo tradutor. Estava em portugues hardcoded (`"Continua a
                // ver"`), e com a interface em ingles o texto de fora traduzia e
                // este de dentro nao — lia-se 'moves "Continua a ver" to the
                // next episode' (2026-10-12).
                b: `"${t("Continua a ver")}"`,
                mal: details.isAnime ? " " + t("(e marca no MAL)") : "",
              })}
              .
            </span>
          )}
          {finishMsg && (
            <span className="muted" style={{ fontSize: 12 }}>
              {finishMsg}
            </span>
          )}
        </div>
      )}

      <Comments
        type={details.type}
        tmdbId={details.id}
        season={details.type === "tv" ? season : null}
        episode={details.type === "anime" || details.type === "tv" ? episode : null}
        posAtual={posAtual}
      />

      {compareOpen && (
        <CompareRating details={details} onClose={() => setCompareOpen(false)} />
      )}
    </div>
  );
}