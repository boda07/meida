// Carregar a ficha, as temporadas, os episodios e o "Se gostaste disto".
//
// Tudo o que vem da API para a pagina de detalhe vive aqui. A pagina desenha.
import { useEffect, useRef, useState } from "react";
import { api } from "../api/client.js";

export function useDetalhes({ type, id, user, settings, idioma, t, retoma }) {
  const { resumeRef, loadedSeasonRef, takeResumeEpisode } = retoma;
  const [details, setDetails] = useState(null);
  const [error, setError] = useState(null);

  // Estado de series
  const [season, setSeason] = useState(1);
  const [episodes, setEpisodes] = useState([]);
  const [episode, setEpisode] = useState(1);
  const [similar, setSimilar] = useState([]); // "Se gostaste disto"

  // Anime: episodios reais do MAL agrupados por temporada (uma vez por titulo).
  // Se a API falhar, cai na lista gerada a partir do total (como antes).
  const animeEpsLoaded = useRef(null); // malId ja carregado
  const [animeSeasons, setAnimeSeasons] = useState([]);

  // Carregar detalhes
  useEffect(() => {
    setDetails(null);
    setError(null);
    api
      .details(type, id)
      .then((d) => {
        setDetails(d);
        // O ano do titulo (a "decada favorita" da pagina /stats precisa dele). O
        // catalogo ja o traz nos detalhes, portanto aqui nao custa nenhum pedido
        // extra — so' gravar. E so' para quem esta' com a sessao iniciada: sem
        // token a chamada da 401 e nao vale a pena tentar.
        //
        // O servidor so' escreve se o titulo estiver na biblioteca e o ano ainda
        // nao estiver la, por isso repetir isto numa ficha ja visitada nao faz
        // trabalho nenhum.
        const ano = Number(d.year);
        if (user && Number.isFinite(ano) && ano > 0) {
          api.saveLibraryYear(d.type || type, id, ano).catch(() => {
            /* e' um extra opcional: falhar aqui nao pode atrapalhar a ficha */
          });
        }
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
  }, [type, id, settings.titleLang, settings.overviewLang, idioma, user, resumeRef]);

  // Carregar episodios quando a temporada muda
  useEffect(() => {
    if (details?.type !== "tv") return;
    api
      .season(details.id, season)
      .then((d) => {
        setEpisodes(d.episodes);
        // Aplica o episodio de retoma apenas na 1a carga efetiva desta temporada.
        // Re-invocacoes do efeito (StrictMode/refetch) deixam o episodio atual
        // intacto em vez de o repor a 1.
        if (loadedSeasonRef.current !== season) {
          loadedSeasonRef.current = season;
          setEpisode(takeResumeEpisode());
        }
      })
      .catch((e) => setError(e.message));
  }, [details, season, settings.overviewLang, loadedSeasonRef, takeResumeEpisode]);

  // "Se gostaste disto" (TMDB similar / recomendacoes do MAL). Uma vez por titulo.
  useEffect(() => {
    if (!details) return;
    api
      .recommendations(details.type === "anime" ? "anime" : details.type, details.id)
      .then((d) => setSimilar(d.items || []))
      .catch(() => setSimilar([]));
  }, [details]);

  // Anime: episodios reais do MAL agrupados por temporada (uma vez por titulo).
  useEffect(() => {
    if (!details?.isAnime || details.isMovie) return;
    if (animeEpsLoaded.current === details.malId) return;
    const r = resumeRef.current;
    const resumeEp = r.pending && r.episode ? r.episode : null;
    const fallback = () => {
      const n = details.episodeCount || 12;
      setAnimeSeasons([]);
      setEpisodes(
        Array.from({ length: n }, (_, i) => ({
          episodeNumber: i + 1,
          name: t("Episódio {n}", { n: i + 1 }),
        }))
      );
      // Usa o episodio de retoma capturado de forma sincrona (resistente a
      // re-invocacoes do efeito em StrictMode) em vez de consumir takeResumeEpisode.
      setEpisode(resumeEp || takeResumeEpisode());
    };
    api
      .animeEpisodes(details.malId)
      .then((d) => {
        const seasons = d.seasons || [];
        // O servidor devolve SEMPRE pelo menos uma temporada, mesmo sem
        // episodios (`groupEpisodesBySeason([])` = 1 temporada com 0 eps), por
        // isso `!seasons.length` nunca era verdade e o fallback nunca corria —
        // o anime ficava com "Temporada 1 (0 eps)". O que decide e haver
        // algum episodio em alguma temporada.
        if (!seasons.some((s) => s.episodes?.length)) return fallback();
        animeEpsLoaded.current = details.malId;
        setAnimeSeasons(seasons);
        const target = resumeEp
          ? seasons.find((s) => s.episodes.some((e) => e.episodeNumber === resumeEp))
          : null;
        const s = target || seasons[0];
        setSeason(s.seasonNumber);
        setEpisodes(s.episodes);
        setEpisode(resumeEp || takeResumeEpisode());
      })
      .catch(() => fallback());
  }, [details, t, resumeRef, takeResumeEpisode]);

  return {
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
  };
}