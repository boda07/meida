import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { api, imageUrl } from "../api/client.js";
import { useSettings } from "../settings/SettingsContext.jsx";
import Player from "../components/Player.jsx";
import SourceSelector from "../components/SourceSelector.jsx";
import LibraryControls from "../components/LibraryControls.jsx";
import Torrents from "../components/Torrents.jsx";
import Extract from "../components/Extract.jsx";

export default function Details() {
  const { type, id } = useParams();
  const { settings } = useSettings();
  const [details, setDetails] = useState(null);
  const [error, setError] = useState(null);

  // Estado de series
  const [season, setSeason] = useState(1);
  const [episodes, setEpisodes] = useState([]);
  const [episode, setEpisode] = useState(1);

  // Fontes / player
  const [embeds, setEmbeds] = useState([]);
  const [active, setActive] = useState(null);

  // Separador inicial vindo das definicoes (providers/extract/torrents)
  const [mode, setMode] = useState(settings.defaultTab || "providers");

  // Carregar detalhes
  useEffect(() => {
    setDetails(null);
    setError(null);
    setActive(null);
    api
      .details(type, id)
      .then((d) => {
        setDetails(d);
        if (d.type === "tv" && d.seasons?.length) {
          setSeason(d.seasons[0].seasonNumber);
        }
      })
      .catch((e) => setError(e.message));
  }, [type, id, settings.titleLang, settings.overviewLang]);

  // Carregar episodios quando a temporada muda
  useEffect(() => {
    // Anime (serie): lista de episodios gerada a partir do total do MAL.
    if (details?.isAnime && !details.isMovie) {
      const n = details.episodeCount || 12;
      setEpisodes(
        Array.from({ length: n }, (_, i) => ({
          episodeNumber: i + 1,
          name: `Episodio ${i + 1}`,
        }))
      );
      setEpisode(1);
      return;
    }
    if (details?.type !== "tv") return;
    api
      .season(details.id, season)
      .then((d) => {
        setEpisodes(d.episodes);
        setEpisode(1);
      })
      .catch((e) => setError(e.message));
  }, [details, season, settings.overviewLang]);

  // Carregar fontes quando temos contexto suficiente
  useEffect(() => {
    if (!details) return;
    // Anime: fontes por id do MyAnimeList (MegaPlay/VidLink/VidSrc.cc), sem TMDB.
    if (details.isAnime) {
      setActive(null);
      api
        .sources({
          mal: details.malId,
          episode: details.isMovie ? 1 : episode,
          audio: settings.animeAudio,
        })
        .then((d) => {
          setEmbeds(d.embeds);
          setActive(d.embeds[0] || null);
        })
        .catch((e) => setError(e.message));
      return;
    }

    const opts = { type: details.type, tmdb: details.id, imdb: details.imdbId };
    if (details.type === "tv") {
      opts.season = season;
      opts.episode = episode;
    }
    setActive(null);
    api
      .sources(opts)
      .then((d) => {
        setEmbeds(d.embeds);
        setActive(d.embeds[0] || null);
      })
      .catch((e) => setError(e.message));
  }, [details, season, episode, settings.animeAudio]);

  // Scrobble MAL: marca o episodio de anime como visto apos ~15s com fonte ativa.
  const scrobbledRef = useRef(new Set());
  useEffect(() => {
    if (!details?.isAnime || !details.malId || !active) return;
    const ep = details.isMovie ? 1 : episode;
    const key = `${details.malId}:${ep}`;
    if (scrobbledRef.current.has(key)) return;
    const t = setTimeout(() => {
      scrobbledRef.current.add(key);
      api.malScrobble(details.malId, ep).catch(() => {});
    }, 15000);
    return () => clearTimeout(t);
  }, [details, active, episode]);

  if (error) return <p className="status error">{error}</p>;
  if (!details) return <p className="status">A carregar...</p>;

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
            {details.runtime && <span className="tag">{details.runtime} min</span>}
            {details.genres?.map((g) => (
              <span className="tag" key={g}>
                {g}
              </span>
            ))}
          </div>
          <p className="details-overview">{details.overview || "Sem sinopse."}</p>
          <LibraryControls details={details} />
        </div>
      </div>

      {(details.type === "tv" || (details.isAnime && !details.isMovie)) && (
        <div className="episodes">
          {details.type === "tv" && (
            <div className="season-picker">
              <label>Temporada:</label>
              <select
                value={season}
                onChange={(e) => setSeason(Number(e.target.value))}
              >
                {details.seasons?.map((s) => (
                  <option key={s.seasonNumber} value={s.seasonNumber}>
                    {s.name} ({s.episodeCount} eps)
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="episode-list">
            {episodes.map((ep) => (
              <button
                key={ep.episodeNumber}
                className={`episode-btn ${
                  ep.episodeNumber === episode ? "active" : ""
                }`}
                onClick={() => setEpisode(ep.episodeNumber)}
              >
                <span className="ep-num">{ep.episodeNumber}</span>
                <span className="ep-name">{ep.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {details.isAnime ? (
        <div className="watch">
          <SourceSelector
            embeds={embeds}
            activeId={active?.provider}
            onSelect={setActive}
          />
          {active ? (
            <Player src={active.embedUrl} title={details.title} />
          ) : (
            <p className="muted">A carregar fontes...</p>
          )}
          <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
            Fontes dedicadas de anime (sub/dub via MyAnimeList). Muda entre
            legendado e dobrado nas Definicoes.
          </p>
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
          <button
            className={mode === "extract" ? "active" : ""}
            onClick={() => setMode("extract")}
          >
            Sem anuncios
          </button>
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
              activeId={active?.provider}
              onSelect={setActive}
            />
            {active ? (
              <Player src={active.embedUrl} title={details.title} />
            ) : (
              <p className="muted">A carregar fontes...</p>
            )}
            <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
              As legendas proprias so funcionam nos separadores{" "}
              <b>Sem anuncios</b> e <b>Torrents</b> (os Providers sao paginas
              externas em iframe).
            </p>
          </>
        )}
        {mode === "extract" && (
          <Extract details={details} season={season} episode={episode} />
        )}
        {mode === "torrents" && (
          <Torrents
            type={details.type}
            imdb={details.imdbId}
            season={season}
            episode={episode}
          />
        )}
      </div>
      )}
    </div>
  );
}
