import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { api, imageUrl } from "../api/client.js";
import { useSettings } from "../settings/SettingsContext.jsx";
import { useAuth } from "../auth/AuthContext.jsx";
import { useWatchParty } from "../watchparty/WatchPartyContext.jsx";
import Player from "../components/Player.jsx";
import SourceSelector from "../components/SourceSelector.jsx";
import useProviderHealth from "../components/useProviderHealth.js";
import LibraryControls from "../components/LibraryControls.jsx";
import Trailer from "../components/Trailer.jsx";
import AddToList from "../components/AddToList.jsx";
import Torrents from "../components/Torrents.jsx";
import Extract from "../components/Extract.jsx";
import AnimeExtract from "../components/AnimeExtract.jsx";
import LoadingStatus from "../components/LoadingStatus.jsx";

export default function Details() {
  const { type, id } = useParams();
  const [searchParams] = useSearchParams();
  const { settings } = useSettings();
  const { user } = useAuth();
  const party = useWatchParty();
  const [details, setDetails] = useState(null);
  const [error, setError] = useState(null);

  // Retomar no episódio vindo do "Continua a ver" (?s=temporada&e=episódio&t=seg).
  const resumeRef = useRef({
    season: Number(searchParams.get("s")) || null,
    episode: Number(searchParams.get("e")) || null,
    position: Number(searchParams.get("t")) || null,
    pending: true,
  });
  // Devolve o episódio inicial: o de retoma (uma vez) ou 1.
  function takeResumeEpisode() {
    const r = resumeRef.current;
    if (r.pending && r.episode) {
      r.pending = false;
      return r.episode;
    }
    return 1;
  }
  // Posição (segundos) para retomar a meio, só quando voltamos ao mesmo
  // episódio vindo do "Continua a ver" (senão os players começam do 0).
  const resumeAtRef = useRef(resumeRef.current.position);

  // Estado de séries
  const [season, setSeason] = useState(1);
  const [episodes, setEpisodes] = useState([]);
  const [episode, setEpisode] = useState(1);
  const [epStart, setEpStart] = useState(0); // inicio do bloco de 100 visivel

  // Retomar a meio: posição guardada no servidor para este título (com o
  // episódio a que pertence, para só retomar no mesmo episódio).
  const [saved, setSaved] = useState(null); // { position, season, episode }
  const [startAt, setStartAt] = useState(null); // passado aos players (seg.)
  useEffect(() => {
    if (!user || !details) {
      setSaved(null);
      return;
    }
    api
      .progressItem(details.type, details.id)
      .then((d) => {
        const it = d.item;
        setSaved(
          it?.position
            ? {
                position: it.position,
                duration: it.duration ?? null,
                season: details.type === "tv" ? it.season : null,
                episode: it.episode ?? null,
              }
            : null
        );
      })
      .catch(() => {});
  }, [user, details]);

  // startAt = posição do "Continua a ver" (?t=) ou a guardada, mas só quando o
  // episódio atual é o mesmo em que estivemos. Limpa ao trocar de episódio.
  useEffect(() => {
    const fromUrl = resumeAtRef.current;
    resumeAtRef.current = null; // só vale na primeira abertura
    const curSeason = details?.type === "tv" ? season : null;
    const curEpisode =
      details?.type === "anime" || details?.type === "tv" ? episode : null;
    const match =
      saved && (details?.type === "movie" || (saved.season === curSeason && saved.episode === curEpisode));
    // Retoma a meio só se vale a pena (não logo no início nem quase no fim).
    const worth =
      match && saved.position > 20 && (saved.duration == null || saved.duration - saved.position > 30);
    setStartAt(fromUrl || (worth ? saved.position : null));
  }, [details, season, episode, saved]);

  // Player a reportar posição (nos players próprios: torrents/HLS/extratores).
  const reportPos = useCallback((position, duration) => {
    if (!user || !details) return;
    api
      .progressPosition({
        type: details.type,
        tmdbId: details.id,
        title: details.title,
        poster: details.poster,
        season: details.type === "tv" ? season : null,
        episode: details.type === "anime" || details.type === "tv" ? episode : null,
        position,
        duration,
      })
      .catch(() => {});
  }, [user, details, season, episode]);

  // Fontes / player
  const [embeds, setEmbeds] = useState([]);
  const [active, setActive] = useState(null);
  // Watch Party: fonte (provider) que o host escolheu, para os convidados verem a
  // mesma — senao cada um fica no 1o provider, que pode estar partido ("nao vejo nada").
  const wantedSourceRef = useRef(null);
  // Health-check dos providers (ids mortos; null = ainda desconhecido).
  const deadProviders = useProviderHealth();

  // Fonte inicial: a escolhida pelo host da watch party, ou a primeira viva
  // (salta os que o health-check marcou como mortos).
  function pickDefault(embedsList) {
    const want = wantedSourceRef.current;
    const alive = embedsList.filter(
      (e) => !deadProviders?.has(e.provider)
    );
    return (
      (want && (alive.find((e) => e.provider === want) || embedsList.find((e) => e.provider === want))) ||
      alive[0] ||
      embedsList[0] ||
      null
    );
  }

  // Separador inicial vindo das definições (providers/extract/torrents)
  const [mode, setMode] = useState(settings.defaultTab || "providers");
  // O extrator de anime (player próprio) esta configurado no servidor?
  const [animeExtractorOn, setAnimeExtractorOn] = useState(false);
  // O "Sem anúncios" de filmes/series (Consumet) esta configurado? Se nao (sem
  // Docker), escondemos a aba — so confundia, nunca funcionava.
  const [extractOn, setExtractOn] = useState(null);
  useEffect(() => {
    api.animeEnabled().then((d) => setAnimeExtractorOn(d.enabled)).catch(() => {});
    api.extractEnabled().then((d) => setExtractOn(d.enabled)).catch(() => setExtractOn(false));
  }, []);

  // Se a aba "Sem anúncios" nao esta disponivel mas era o separador inicial,
  // cai para os Providers (para nao ficar um ecra vazio).
  useEffect(() => {
    if (extractOn === false && mode === "extract") setMode("providers");
  }, [extractOn, mode]);

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
          const r = resumeRef.current;
          const wanted =
            r.pending && r.season && d.seasons.some((s) => s.seasonNumber === r.season)
              ? r.season
              : d.seasons[0].seasonNumber;
          setSeason(wanted);
        }
      })
      .catch((e) => setError(e.message));
  }, [type, id, settings.titleLang, settings.overviewLang]);

  // Carregar episódios quando a temporada muda
  useEffect(() => {
    // Anime (série): lista de episódios gerada a partir do total do MAL.
    if (details?.isAnime && !details.isMovie) {
      const n = details.episodeCount || 12;
      setEpisodes(
        Array.from({ length: n }, (_, i) => ({
          episodeNumber: i + 1,
          name: `Episódio ${i + 1}`,
        }))
      );
      setEpisode(takeResumeEpisode());
      return;
    }
    if (details?.type !== "tv") return;
    api
      .season(details.id, season)
      .then((d) => {
        setEpisodes(d.episodes);
        setEpisode(takeResumeEpisode());
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
          anilist: details.anilistId,
          episode: details.isMovie ? 1 : episode,
          audio: settings.animeAudio,
        })
        .then((d) => {
          setEmbeds(d.embeds);
          setActive(pickDefault(d.embeds));
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
        setActive(pickDefault(d.embeds));
      })
      .catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [details, season, episode, settings.animeAudio]);

  // Diário: só considera que estás a ver depois de 5 MINUTOS com uma fonte aberta
  // (assim abrir e fechar logo nao conta). 1x por episodio/sessao. O contador nao
  // reinicia ao trocar de fonte (depende so de haver fonte ativa, nao de qual).
  const startedRef = useRef(new Set());
  const hasSource = Boolean(active);
  useEffect(() => {
    if (!user || !details || !hasSource) return;
    const ep = details.isMovie ? null : episode;
    const s = details.type === "tv" ? season : null;
    const key = `${details.type}:${details.id}:${s}:${ep}`;
    if (startedRef.current.has(key)) return;
    const t = setTimeout(() => {
      startedRef.current.add(key);
      api
        .progressStart({
          type: details.type,
          tmdbId: details.id,
          title: details.title,
          poster: details.poster,
          season: s,
          episode: ep,
        })
        .catch(() => {});
    }, 5 * 60 * 1000);
    return () => clearTimeout(t);
  }, [user, details, hasSource, season, episode]);

  // Próxima posição (para avançar o "continua a ver" ao concluir um episódio).
  function nextEpisodePos() {
    if (details.type === "anime") {
      return episode < episodes.length ? { season: null, episode: episode + 1 } : null;
    }
    if (details.type === "tv") {
      if (episode < episodes.length) return { season, episode: episode + 1 };
      const idx = details.seasons?.findIndex((s) => s.seasonNumber === season) ?? -1;
      const nextS = idx >= 0 ? details.seasons[idx + 1] : null;
      return nextS ? { season: nextS.seasonNumber, episode: 1 } : null;
    }
    return null;
  }

  // Marca como acabado (filme) / conclui o episódio atual (série/anime).
  const [finishing, setFinishing] = useState(false);
  const [finishMsg, setFinishMsg] = useState(null);
  const isMovieLike = details?.isMovie || details?.type === "movie";
  async function markFinished() {
    if (!details || finishing) return;
    setFinishing(true);
    setFinishMsg(null);
    try {
      if (isMovieLike) {
        await api.progressFinish({
          type: details.type,
          tmdbId: details.id,
          title: details.title,
          poster: details.poster,
        });
        await api
          .saveLibrary({
            tmdbId: details.id,
            type: details.type,
            title: details.title,
            poster: details.poster,
            genres: details.genres || [],
            rating: details.rating ?? null,
            watched: true,
          })
          .catch(() => {});
      } else {
        const next = nextEpisodePos();
        await api.progressFinish({
          type: details.type,
          tmdbId: details.id,
          title: details.title,
          poster: details.poster,
          season: details.type === "tv" ? season : null,
          episode,
          nextSeason: next?.season ?? null,
          nextEpisode: next?.episode ?? null,
        });
        if (details.isAnime && details.malId) {
          api.malScrobble(details.malId, episode).catch(() => {});
        }
      }
      setFinishMsg("Guardado no diário.");
    } catch {
      setFinishMsg("Não foi possível guardar.");
    } finally {
      setFinishing(false);
    }
  }

  // Watch Party: sincroniza temporada/episódio/separador E a fonte escolhida.
  const applyingUntil = useRef(0);
  useEffect(() => {
    if (!party?.active) return;
    return party.subscribe((p) => {
      if (p.kind === "hello") {
        party.send("session", { season, episode, mode, provider: active?.provider });
        return;
      }
      if (p.kind !== "session") return;
      applyingUntil.current = Date.now() + 400;
      const d = p.data || {};
      if (d.season != null) setSeason(d.season);
      if (d.episode != null) setEpisode(d.episode);
      if (d.mode) setMode(d.mode);
      if (d.provider) {
        // Guarda para aplicar quando as fontes carregarem; aplica ja se possivel.
        wantedSourceRef.current = d.provider;
        const match = embeds.find((e) => e.provider === d.provider);
        if (match) setActive(match);
      }
    });
  }, [party, season, episode, mode, embeds, active]);

  useEffect(() => {
    if (!party?.active) return;
    if (Date.now() < applyingUntil.current) return;
    party.send("session", { season, episode, mode, provider: active?.provider });
  }, [party, season, episode, mode, active]);

  // Mantem o bloco de 100 visivel alinhado com o episódio atual/selecionado.
  useEffect(() => {
    setEpStart(Math.floor((episode - 1) / 100) * 100);
  }, [episode]);

  if (error) return <p className="status error">{error}</p>;
  if (!details) return <LoadingStatus>A carregar</LoadingStatus>;

  const backdrop = imageUrl(details.backdrop, "w1280");

  // Animes longos (1000+ eps): divide a lista em blocos de 100.
  const EP_BLOCK = 100;
  const manyEps = episodes.length > EP_BLOCK;
  const epRanges = [];
  if (manyEps) {
    for (let i = 0; i < episodes.length; i += EP_BLOCK) epRanges.push(i);
  }
  const visibleEpisodes = manyEps
    ? episodes.slice(epStart, epStart + EP_BLOCK)
    : episodes;

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
          <div className="details-actions">
            <Trailer src={details.trailer} />
            <AddToList details={details} />
            <LibraryControls details={details} />
          </div>
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
                <span className="ep-name">{ep.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {details.isAnime ? (
        <div className="watch">
          {(animeExtractorOn || details.imdbId) && (
            <div className="mode-tabs">
              <button
                className={mode !== "extract" && mode !== "torrents" ? "active" : ""}
                onClick={() => setMode("providers")}
              >
                Fontes
              </button>
              {animeExtractorOn && (
                <button
                  className={mode === "extract" ? "active" : ""}
                  onClick={() => setMode("extract")}
                >
                  Sem anúncios
                </button>
              )}
              {details.imdbId && (
                <button
                  className={mode === "torrents" ? "active" : ""}
                  onClick={() => setMode("torrents")}
                >
                  Torrents
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
            />
          ) : mode === "torrents" && details.imdbId ? (
            <Torrents
              type={details.isMovie ? "movie" : "tv"}
              imdb={details.imdbId}
              season={1}
              episode={details.isMovie ? 1 : episode}
              anime
              defaultAudio={settings.animeAudio}
              startAt={startAt}
              onProgress={reportPos}
            />
          ) : (
            <>
              <SourceSelector
                embeds={embeds}
                activeId={active?.provider}
                onSelect={setActive}
                deadIds={deadProviders}
              />
              {active ? (
                <Player src={active.embedUrl} title={details.title} />
              ) : (
                <p className="muted">A carregar fontes...</p>
              )}
              <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                Fontes dedicadas de anime (sub/dub via MyAnimeList). Muda entre
                legendado e dobrado nas Definições.
              </p>
              {party?.active && (
                <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                  🔴 Watch Party: estas fontes são em iframe, o play/pausa <b>não</b>{" "}
                  sincroniza — usem <b>Torrents</b> para verem em sincronia.
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
              activeId={active?.provider}
              onSelect={setActive}
              deadIds={deadProviders}
            />
            {active ? (
              <Player src={active.embedUrl} title={details.title} />
            ) : (
              <p className="muted">A carregar fontes...</p>
            )}
            <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
              As legendas próprias (incl. português) só funcionam no separador{" "}
              <b>Torrents</b>{extractOn ? <> e <b>Sem anúncios</b></> : null} (os
              Providers são páginas externas em iframe).
            </p>
            {party?.active && (
              <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                🔴 Watch Party: aqui (Providers) o play/pausa <b>não</b> sincroniza
                — usem <b>Torrents</b>{extractOn ? <> ou <b>Sem anúncios</b></> : null}{" "}
                para verem em sincronia.
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
            season={season}
            episode={episode}
            startAt={startAt}
            onProgress={reportPos}
          />
        )}
      </div>
      )}

      {user && (
        <div className="scrobble-bar">
          <button className="btn scrobble-btn" onClick={markFinished} disabled={finishing}>
            {finishing
              ? "A guardar..."
              : isMovieLike
              ? "✓ Marcar como visto"
              : `✓ Terminei o episódio ${episode}`}
          </button>
          {!isMovieLike && (
            <span className="muted" style={{ fontSize: 12 }}>
              Guarda no diário e avança o "Continua a ver" para o próximo episódio
              {details.isAnime ? " (e marca no MAL)" : ""}.
            </span>
          )}
          {finishMsg && (
            <span className="muted" style={{ fontSize: 12 }}>
              {finishMsg}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
