import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { audioTituloStore, api, imageUrl } from "../api/client.js";
import { useSettings } from "../settings/SettingsContext.jsx";
import { useAuth } from "../auth/AuthContext.jsx";
import { useWatchParty } from "../watchparty/WatchPartyContext.jsx";
import Player from "../components/Player.jsx";
import SourceSelector from "../components/SourceSelector.jsx";
import useProviderHealth from "../components/useProviderHealth.js";
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
import { clearPresence, showPresence } from "../discord.js";
import { useT } from "../i18n/I18nContext.jsx";

export default function Details() {
  const t = useT();
  const { type, id } = useParams();
  const [searchParams] = useSearchParams();
  const { settings, update } = useSettings();
  const { user } = useAuth();
  const party = useWatchParty();
  const [details, setDetails] = useState(null);
  const [error, setError] = useState(null);

  // Retomar no episódio vindo do "Continua a ver" (?s=temporada&e=episódio&t=seg).
  // A `pending` só é consumida quando a temporada de retoma carrega DE FACTO
  // (guarda loadedSeasonRef); assim os efeitos que correm 2x em StrictMode (dev)
  // não consomem a retoma duas vezes nem repõem o episódio a 1.
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
  // Temporada cuja lista de episódios já foi aplicada — evita que re-invocações
  // do efeito (StrictMode em dev, refetch de detalhes) reponham o episódio a 1.
  const loadedSeasonRef = useRef(null);

  // Estado de séries
  const [season, setSeason] = useState(1);
  const [episodes, setEpisodes] = useState([]);
  const [episode, setEpisode] = useState(1);
  const [epStart, setEpStart] = useState(0); // inicio do bloco de 100 visivel
  const [similar, setSimilar] = useState([]); // "Se gostaste disto"

  // Retomar a meio: posição guardada no servidor para este título (com o
  // episódio a que pertence, para só retomar no mesmo episódio).
  const [saved, setSaved] = useState(null); // { position, season, episode }
  const [startAt, setStartAt] = useState(null); // passado aos players (seg.)
  // Restaura o provider guardado apenas na 1ª entrada do título (não volta a
  // impor ao mudar de episódio/áudio durante a sessão — deixaria o user na mão).
  const restoreProviderDone = useRef(null);
  useEffect(() => {
    restoreProviderDone.current = details ? `${details.type}:${details.id}` : null;
  }, [details]);
  // (o useEffect do progressItem/provider está mais abaixo, depois de `embeds`
  // e `wantedSourceRef` estarem declarados — antes lançava ReferenceError)

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
  const activeProviderRef = useRef(null); // último provider escolhido (ref, p/ não reiniciar timers)
  // Ultima posicao de video que um player reportou (segundos). Serve para o
  // botao "neste momento" dos comentarios. Nos providers em iframe nao ha
  // posicao a que pegar, e por isso fica null.
  const [posAtual, setPosAtual] = useState(null);
  // Trocar de episodio/fonte invalida o tempo: o "12:34" era do anterior.
  useEffect(() => {
    setPosAtual(null);
  }, [details?.id, season, episode]);


  // Fontes / player
  const [embeds, setEmbeds] = useState([]);
  const [active, setActive] = useState(null);
  // Indice activo do player (para o Player fazer fallback/timeout a partir dele).
  const [playerIndex, setPlayerIndex] = useState(0);
  // A pessoa escolheu a fonte a mao? Se sim, o player NAO troca sozinho: era o
  // que estava a acontecer — clicaste no VidLove e, 15 s depois, aparecia o
  // VidLink sem teres pedido nada. So o auto-fallback inicial (sem escolha) e'
  // que salta de fonte sozinho.
  const [fonteManual, setFonteManual] = useState(false);

  // A ultima fonte escolhida, POR TIPO (filme / serie / anime), das Definicoes.
  //
  // **Antes vivia numa chave que tinha o episodio dentro** (`...:${season}:${episode}`),
  // o que anulava a ideia: a escolha de um episodio nunca aparecia no seguinte,
  // que e' exactamente o que se queria evitar. Quem escolheu o MegaPlay porque e'
  // o unico com legendas tinha de o escolher em cada episodio.
  //
  // So' vale se o provider ainda existir nesta lista de fontes; se foi removido
  // ou mudou de id, cai na primeira viva como antes.
  // E' uma funcao, e nao um valor calculado no render. Era um valor, e isso
  // era o segundo bug: quando as fontes chegam (dentro do `.then`) o `embeds` do
  // estado ainda era o antigo - vazio - logo a fonte guardada dava `null` e o
  // player arrancava na primeira. O botao do seletor aparecia certo, porque esse
  // e' desenhado num render seguinte, com a lista ja cheia. Da' a situao mais
  // enganadora que ha: "a fonte esta' marcada mas o video e' outro".
  function fonteGuardada(tipo, lista) {
    const porTipo = settings.lastSource;
    if (!tipo || !porTipo || typeof porTipo !== "object") return null;
    const v = porTipo[tipo];
    if (typeof v !== "string" || !v) return null;
    return (lista || []).some((e) => e.provider === v) ? v : null;
  }
  // A mesma coisa, mas ja' com a lista do estado - e' o que o `SourceSelector`
  // recebe para pintar o botao certo.
  const fonteSalva = fonteGuardada(details?.type, embeds);
  // Escolher a fonte a mao. **Uma so funcao para os dois `SourceSelector`** (o de
// cima e' o de sempre, o de baixo o do separador p2p/torrents) — estavam
// duplicados e qualquer correccao a um tinha de ser feita duas vezes, que e'
// como nasce um "aqui funciona, ali nao".
//
// Os tres passos, e o terceiro e' o que faltava:
//   1. abre nesta fonte e posiciona o player nela;
//   2. trava o auto-fallback (a escolha e' da pessoa);
//   3. guarda nas Definicoes, POR TIPO, para o proximo episodio ja abrir nela.
function escolherFonte(e) {
  setActive(e);
  const idx = embeds.findIndex((x) => x.provider === e?.provider);
  setPlayerIndex(idx >= 0 ? idx : 0);
  setFonteManual(true);
  const tipo = details?.type;
  if (!e?.provider || !tipo) return;
  update({
    lastSource: {
      movie: "",
      tv: "",
      anime: "",
      // O que ja estava gravado, para nao perder a escolha de outro tipo. E os
      // tres chaves acima, para o objecto ter a forma certa mesmo que as
      // Definicoes venham de uma versao antiga sem `lastSource`.
      ...(settings.lastSource || {}),
      [tipo]: e.provider,
    },
  });
}

// Escolhe a fonte inicial E posiciona o player nela.
//
// **O `playerIndex` tem de andar junto do `active`.** Antes so o `active` mudava
// e o `Player` arrancava sempre no indice 0 — isto e', a fonte que a pessoa
// escolheu aparecia marcada no seletor mas o video comecava noutra. E' o mesmo
// sintoma do "volta ao primeiro provider", so que desta vez sem dar erro nenhum.
function abrirEscolhendo(embedsList) {
  const escolhido = pickDefault(embedsList, fonteGuardada(details?.type, embedsList));
  setActive(escolhido);
  const idx = embedsList.findIndex((e) => e.provider === escolhido?.provider);
  setPlayerIndex(idx >= 0 ? idx : 0);
  return escolhido;
}
  // mesma — senao cada um fica no 1o provider, que pode estar partido ("nao vejo nada").
  // Watch Party: fonte (provider) que o host escolheu, para os convidados verem a
  // mesma — senao cada um fica no 1o provider, que pode estar partido ("nao vejo nada").
  const wantedSourceRef = useRef(null);
  // Health-check dos providers (ids mortos; null = ainda desconhecido).
  const deadProviders = useProviderHealth();

  // Fonte inicial: a escolhida pelo host da watch party, ou a primeira viva
  // (salta os que o health-check marcou como mortos).
  function pickDefault(embedsList, saved) {
    const want = wantedSourceRef.current;
    // Se ha uma fonte salva e nao esta morta pelo health-check, usa-a como
    // ponto de partida. Se nao existe ja (o provider foi removido ou mudou o
    // id), cai no primeiro vivo como antes.
    const alive = embedsList.filter(
      (e) => !deadProviders?.has(e.provider)
    );
    const aliveSaved = saved ? alive.find((e) => e.provider === saved) : null;
    return (
      (want && (alive.find((e) => e.provider === want) || embedsList.find((e) => e.provider === want))) ||
      aliveSaved ||
      alive[0] ||
      embedsList[0] ||
      null
    );
  }

// Mantém o ref do último provider escolhido a par do estado ativo.
  useEffect(() => {
    activeProviderRef.current = active?.provider ?? null;
  }, [active]);
  // NOTA: este bloco esta aqui, e' nao antes das declaracoes das fontes, por
  // causa do "temporal dead zone": um array de dependencias so' pode citar
  // `const` JA declaradas acima (o React avalia-o durante o render). Ver o
  // comentario do bloco.
  // Discord: tres estados, conforme o que sabemos — e o que sabemos e' "chegou
  // progresso?", nao "esta a tocar?".
  //
  //   "a-ver"     : o progresso chega (players nossos). O Discord conta tempo.
  //   "pausa"     : o progresso chegou e parou. O Discord congela e diz "Pausado".
  //   "sem-dados" : nunca chegou progresso (players em iframe: MegaPlay, VidLove,
  //                 ...). NAO se diz nada sobre o estado: o Discord mostra o
  //                 titulo sem contador e sem "Pausado".
  //
  // A distincao entre "pausa" e "sem-dados" e' o que faltava. Antes, "sem
  // progresso" era lido como "em pausa" e os iframes ficavam sempre marcados
  // como pausados, mesmo com o video a dar. E antes disso, todos ficavam sempre
  // "a ver", mesmo sem dar play.
  //
  // `PRESENCA_PAUSADA_MS` esta entre o intervalo com que o player reporta (uns
  // 5 s) e o intervalo minimo do Discord (15 s): a pausa aparece sem esperarmos
  // pelo proximo update.
  const PRESENCA_PAUSADA_MS = 10000;
  const [presencaEstado, setPresencaEstado] = useState("sem-dados");
  const ultimoProgressoRef = useRef(0);
  // Uma vez que houve progresso, soubemos que este player da' sinal. Sem isto,
  // um player nosso que arranca devagar seria tomado por um iframe em vez de
  // "ainda nao comecou".
  const viuProgressoRef = useRef(false);

  useEffect(() => {
    if (!details?.title || !active) {
      clearPresence();
      return undefined;
    }
    ultimoProgressoRef.current = Date.now();
    // Fonte nova: ainda nao sabemos nada sobre ela. So' quando `reportPos`
    // chegar e' que passamos a "a-ver".
    viuProgressoRef.current = false;
    setPresencaEstado("sem-dados");
    const t = setInterval(() => {
      const semSinal = Date.now() - ultimoProgressoRef.current > PRESENCA_PAUSADA_MS;
      setPresencaEstado((antes) => {
        // Nunca houve progresso: continuamos sem dados (iframe, ou ainda nao
        // comecou a dar). Nao e' pausa — e' falta de informacao.
        if (!viuProgressoRef.current) return antes === "sem-dados" ? antes : "sem-dados";
        // Houve progresso e agora nao ha: pausa a valer.
        return semSinal ? "pausa" : "a-ver";
      });
    }, 3000);
    return () => clearInterval(t);
    // `details` pela identidade nao: muda a cada pedido e reiniciaria o estado
    // sem motivo. So' as propriedades que o efeito le.
  }, [details?.title, details?.type, details?.poster, active, season, episode]);

  // O intervalo acima so muda o estado. Este efeito e' que o leva ao Discord —
  // sem ele, `presencaEstado` nao chegava a lado nenhum. Nao leva `position`: o
  // `subLine` so escreve o tempo se a posicao existir, e quem a manda e' o
  // `reportPos` abaixo.
  useEffect(() => {
    if (!details?.title || !active) return;
    showPresence({
      title: details.title,
      type: details.type,
      season: details.type === "tv" ? season : null,
      episode: details.type === "anime" || details.type === "tv" ? episode : null,
      poster: details.poster,
      estado: presencaEstado,
    });
    // Ver a nota do efeito de cima: `details` pela identidade reiniciaria o
    // estado a cada pedido.
  }, [details?.title, details?.type, details?.poster, active, season, episode, presencaEstado]);

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
        provider: activeProviderRef.current,
      })
      .catch(() => {});
    setPosAtual(position);
    // Chegou progresso, logo o video esta a dar. E, a partir de agora, sabemos
    // que este player da' sinal — uma ausencia futura e' pausa, nao falta de
    // informacao (ver `viuProgressoRef`).
    ultimoProgressoRef.current = Date.now();
    viuProgressoRef.current = true;
    setPresencaEstado("a-ver");
    // Presença no Discord: aproveita o mesmo callback do progresso para mostrar
    // "12:34 / 45:00" enquanto se vê (o Discord filtra os updates a mais). Este
    // `showPresence` e' o unico que leva `position` — o efeito acima so leva o
    // estado, porque nao tem a posicao.
    showPresence({
      title: details.title,
      type: details.type,
      season: details.type === "tv" ? season : null,
      episode: details.type === "anime" || details.type === "tv" ? episode : null,
      poster: details.poster,
      position,
      duration,
      estado: "a-ver",
    });
  }, [user, details, season, episode]);

  // Presença no Discord (grátis): o título aparece assim que escolhes uma fonte e
  // desaparece se tirares a fonte ou saíres da ficha. O que o Discord diz sobre o
  // estado é decidido pelo efeito acima (`presencaEstado`), não aqui.
  //
  // Este efeito antigo — que mostrava assim que se escolhia uma fonte, sempre
  // "a ver" e sem nunca parar — foi removido: era a origem do defeito. A nota de
  // que "nos providers com iframe não dá para saber se estão a tocar" continua
  // verdadeira, mas só justifica mostrar o TÍTULO, não mostrar como se estivesse
  // a ver. Daí o estado "sem-dados".

  // Saiu da ficha -> esconde a presença (senão ficava "A ver ..." para sempre).
  useEffect(() => () => clearPresence(), []);

  // Lê o progresso guardado (posição + provider). Tem de correr depois de
  // `embeds`/`wantedSourceRef` estarem declarados (usam-nos no corpo e nas deps).
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
        // Restaura a fonte (provider) em que o user estava, para o "Continua a
        // ver" abrir na mesma e não no 1º provider vivo. Só na 1ª entrada.
        if (it?.provider && restoreProviderDone.current === `${details.type}:${details.id}`) {
          restoreProviderDone.current = false;
          wantedSourceRef.current = it.provider;
          const match = embeds.find((e) => e.provider === it.provider);
          if (match) {
            setActive(match);
            setPlayerIndex(embeds.findIndex((e) => e.provider === it.provider));
          }
        }
      })
      .catch(() => {});
  }, [user, details, embeds]);

  // Separador inicial vindo das definições (providers/extract/torrents)
  const [mode, setMode] = useState(settings.defaultTab || "providers");
// Audio do anime, guardado POR TITULO em vez de nas Definicoes: ha animes que
// so existem dobrados e outros que nao tem dobrado nenhum, portanto uma
// definicao global obrigava a trocar sempre. Sem entrada guardada = segue as
// Definicoes.
const [localAudio, setLocalAudio] = useState(null);
const animeAudio = localAudio || settings.animeAudio;
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
    // Titulo novo: solta-se a TRanca do auto-fallback, mas nao a escolha. A fonte
    // continua guardada nas Definicoes e e' por onde o player arranca (ver
    // `abrirEscolhendo`) — o que muda e' que a partir de agora, se essa fonte nao
    // responder, o player salta para a seguinte em vez de ficar preso nela.
    setFonteManual(false);
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
  }, [type, id, settings.titleLang, settings.overviewLang, t.idioma, user]);

  // Carregar episódios quando a temporada muda
  useEffect(() => {
    if (details?.type !== "tv") return;
    api
      .season(details.id, season)
      .then((d) => {
        setEpisodes(d.episodes);
        // Aplica o episódio de retoma apenas na 1a carga efetiva desta temporada.
        // Re-invocações do efeito (StrictMode/refetch) deixam o episódio atual
        // intacto em vez de o repor a 1.
        if (loadedSeasonRef.current !== season) {
          loadedSeasonRef.current = season;
          setEpisode(takeResumeEpisode());
        }
      })
      .catch((e) => setError(e.message));
  }, [details, season, settings.overviewLang]);

  // Chave do titulo para a preferencia de audio: "tipo:id", o mesmo formato
  // que se usa no resto do ficheiro.
  const chaveAudio = details ? `${details.type}:${details.id}` : null;

  // Carrega a preferencia guardada deste titulo assim que os detalhes chegam.
  // Sem isto a escolha vivia so enquanto a pagina estivesse aberta: ao voltar
  // ao Inicio e clicar outra vez em "continua a ver", voltava ao "sub" das
  // Definicoes.
  useEffect(() => {
    if (!chaveAudio) return;
    setLocalAudio(audioTituloStore.get(chaveAudio));
  }, [chaveAudio]);

  // Unico ponto de escrita do audio, para os dois sitios que o escolhem
  // (a barra em cima e os chips dos torrents) gravarem igual.
  //
  // "all" e' exclusivo dos torrents (ver todos os ficheiros, sem escolher
  // audio) e nao corresponde a nenhum valor de URL de provider, por isso NAO
  // mexe na preferencia guardada: se a pessoa tinha o Dragon Ball em dub e foi
  // so ver "Todos" na lista, o dub continua a ser o dos providers.
  function escolherAudio(a) {
    if (a !== "dub" && a !== "sub") return;
    setLocalAudio(a);
    if (chaveAudio) audioTituloStore.set(chaveAudio, a);
  }

  // "Se gostaste disto" (TMDB similar / recomendações do MAL). Uma vez por título.
  useEffect(() => {
    if (!details) return;
    api
      .recommendations(details.type === "anime" ? "anime" : details.type, details.id)
      .then((d) => setSimilar(d.items || []))
      .catch(() => setSimilar([]));
  }, [details]);

  // Anime: episódios reais do MAL agrupados por temporada (uma vez por título).
  // Se a API falhar, cai na lista gerada a partir do total (como antes).
  const animeEpsLoaded = useRef(null); // malId já carregado
  const [animeSeasons, setAnimeSeasons] = useState([]);
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
      // Usa o episódio de retoma capturado de forma síncrona (resistente a
      // re-invocações do efeito em StrictMode) em vez de consumir takeResumeEpisode.
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
        //algum episodio em alguma temporada.
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
  }, [details, t]);

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
          audio: animeAudio,
        })
        .then((d) => {
          setEmbeds(d.embeds);
          abrirEscolhendo(d.embeds);
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
        abrirEscolhendo(d.embeds);
      })
      .catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [details, season, episode, animeAudio]);

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
          provider: activeProviderRef.current,
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
      // Os episódios são globais (1..N) através das temporadas agrupadas.
      const lastSeason = animeSeasons[animeSeasons.length - 1];
      const lastEp = lastSeason
        ? lastSeason.episodes[lastSeason.episodes.length - 1]?.episodeNumber
        : episodes.length;
      return episode < lastEp ? { season: null, episode: episode + 1 } : null;
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
  const [compareOpen, setCompareOpen] = useState(false);
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
          // Se o MAL nao esta ligado, marca no AniList (quando este estiver ligado).
          api.anilistScrobble(details.malId, episode).catch(() => {});
        }
      }
      setFinishMsg(t("Guardado no diário."));
    } catch {
      setFinishMsg(t("Não foi possível guardar."));
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
        if (match) {
          setActive(match);
          setPlayerIndex(embeds.findIndex((e) => e.provider === d.provider));
        }
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
  if (!details) return <LoadingStatus>{t("A carregar")}</LoadingStatus>;

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
                  // Anime: os episódios da temporada já estão em memória.
                  if (details.isAnime) {
                    const s = animeSeasons.find((x) => x.seasonNumber === n);
                    if (s) setEpisodes(s.episodes);
                  }
                }}
              >
                {details.type === "tv"
                  ? details.seasons?.map((s) => (
                      <option key={s.seasonNumber} value={s.seasonNumber}>
                        {s.name} ({s.episodeCount} eps)
                      </option>
                    ))
                  : animeSeasons.map((s) => (
                      <option key={s.seasonNumber} value={s.seasonNumber}>
                        {t(s.label)} ({s.episodes.length} eps)
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
        <MediaRow title={t("Se gostaste disto")} items={similar} />
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
