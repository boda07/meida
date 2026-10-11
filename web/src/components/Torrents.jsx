import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client.js";
import VideoPlayer from "./VideoPlayer.jsx";
import { useT } from "../i18n/I18nContext.jsx";

const QUALITY_ORDER = ["4K", "1080P", "720P", "480P", "360P", "?"];

function sizeToBytes(s) {
  if (!s) return 0;
  const m = s.match(/([\d.]+)\s*([KMGT])B/i);
  if (!m) return 0;
  const mult = { K: 1e3, M: 1e6, G: 1e9, T: 1e12 }[m[2].toUpperCase()] || 1;
  return parseFloat(m[1]) * mult;
}

// Filtro de audio (anime): o backend ja marca cada torrent com `dub`/`dual`.
function matchAudio(t, mode) {
  if (mode === "all") return true;
  if (mode === "dub") return !!t.dub;
  return !t.dub; // "sub"
}

// Procura torrents (Torrentio + YTS...) e reproduz o escolhido no nosso player.
// Se o Real-Debrid estiver ligado, os torrents em cache reproduzem logo (sem
// esperar por peers); os outros caem para o WebTorrent local.
export default function Torrents({ type, imdb, title, season, episode, anime, defaultAudio, startAt, onProgress, onAudioChange }) {
  const t = useT();
  const [list, setList] = useState(null);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [subs, setSubs] = useState([]);
  const [quality, setQuality] = useState("all");
  const [sortBy, setSortBy] = useState("seeders");
  const [compat, setCompat] = useState("all");
  const [codec, setCodec] = useState("all");
  const [audio, setAudio] = useState(
    anime ? (defaultAudio === "dub" ? "dub" : "sub") : "all"
  );

  // Escolher aqui também grava. Sem isto, o dub escolhido nos torrents era
  // estado interno deste componente: perdia-se ao sair da página e o "continua
  // a ver" voltava ao sub.
  //
  // "all" só quer dizer "não filtrar por áudio" — não corresponde a nenhum
  // valor de URL de provider, por isso o pai é que decide se isso deve mudar a
  // preferência guardada do título. Passamos o valor e deixamos a decisão ao pai.
  function mudarAudio(a) {
    setAudio(a);
    onAudioChange?.(a);
  }
  // Real-Debrid: { linked, instant: Map<infoHash, true> }
  const [debrid, setDebrid] = useState(null);
  // URL já resolvido (Debrid é async: primeiro resolve, depois toca).
  const [videoSrc, setVideoSrc] = useState(null);
  const [streaming, setStreaming] = useState(false);
  const [streamErr, setStreamErr] = useState(null);

  useEffect(() => {
    setSelected(null);
    setVideoSrc(null);
    setStreamErr(null);
    if (!imdb) return;
    setList(null);
    setError(null);
    const opts = { type, imdb, title };
    if (type === "tv") {
      opts.season = season;
      opts.episode = episode;
    }
    api
      .torrents(opts)
      .then((d) => setList(d.torrents))
      .catch((e) => setError(e.message));
  }, [type, imdb, title, season, episode]);

  // Estado do Real-Debrid + disponibilidade instant dos torrents apresentados.
  useEffect(() => {
    if (!list?.length) return;
    let alive = true;
    const hashes = list.map((t) => t.infoHash);
    api
      .debridAvailability(hashes)
      .then((d) => {
        if (!alive) return;
        const instant = new Map();
        for (const [h, v] of Object.entries(d.instant || {})) {
          if (v?.instant) instant.set(h, true);
        }
        setDebrid({ linked: !!d.linked, instant });
      })
      .catch(() => setDebrid((p) => p || { linked: false, instant: new Map() }));
    return () => {
      alive = false;
    };
  }, [list]);

  // Legendas (OpenSubtitles) para usar no player do torrent.
  useEffect(() => {
    if (!imdb) return;
    const opts = { imdb };
    if (type === "tv") {
      opts.season = season;
      opts.episode = episode;
    }
    api
      .subtitles(opts)
      .then((d) => setSubs(d.subtitles || []))
      .catch(() => setSubs([]));
  }, [type, imdb, season, episode]);

  // Qualidades presentes (para os botoes do filtro), pela ordem habitual.
  const qualities = useMemo(() => {
    const set = new Set((list || []).map((t) => t.quality));
    return QUALITY_ORDER.filter((q) => set.has(q));
  }, [list]);

  // Aplica filtros + ordenação.
  const shown = useMemo(() => {
    let arr = list || [];
    if (quality !== "all") arr = arr.filter((t) => t.quality === quality);
    if (compat === "playable") arr = arr.filter((t) => t.playable);
    if (compat === "instant")
      arr = arr.filter((t) => debrid?.instant?.has(t.infoHash));
    if (codec !== "all") arr = arr.filter((t) => t.codec === codec);
    if (anime && audio !== "all") arr = arr.filter((t) => matchAudio(t, audio));
    const sorted = [...arr].sort((a, b) => {
      // Com Debrid ligado, os torrents em cache ficam no topo (começam logo).
      const ai = debrid?.instant?.has(a.infoHash) ? 1 : 0;
      const bi = debrid?.instant?.has(b.infoHash) ? 1 : 0;
      if (ai !== bi) return bi - ai;
      if (sortBy === "sizeAsc") return sizeToBytes(a.size) - sizeToBytes(b.size);
      if (sortBy === "size") return sizeToBytes(b.size) - sizeToBytes(a.size);
      if (sortBy === "quality") {
        const ra = QUALITY_ORDER.indexOf(a.quality);
        const rb = QUALITY_ORDER.indexOf(b.quality);
        return (ra === -1 ? QUALITY_ORDER.length : ra) - (rb === -1 ? QUALITY_ORDER.length : rb);
      }
      return (b.seeders ?? -1) - (a.seeders ?? -1); // seeders desc (default)
    });
    return sorted;
  }, [list, quality, sortBy, anime, audio, compat, codec, debrid]);

  // Ao escolher um torrent: se Debrid estiver ligado e o torrent estiver em
  // cache, resolve o stream via Debrid (logo). Senão, usa WebTorrent local.
  async function pick(t) {
    setSelected(t);
    setStreamErr(null);
    setVideoSrc(null);
    const tryDebrid = debrid?.linked && debrid?.instant?.has(t.infoHash);
    if (tryDebrid) {
      setStreaming(true);
      try {
        const d = await api.debridStream(t.infoHash, t.fileIdx);
        setVideoSrc(d.url);
      } catch (e) {
        // Se o Debrid falhar, cai para o WebTorrent (stream local).
        setStreamErr(e.message);
        setVideoSrc(localStreamUrl(t));
      } finally {
        setStreaming(false);
      }
    } else {
      setVideoSrc(localStreamUrl(t));
    }
  }

  function localStreamUrl(t) {
    return (
      `/api/stream/${t.infoHash}` +
      (t.fileIdx != null ? `?fileIdx=${t.fileIdx}` : "")
    );
  }

  if (!imdb)
    return <p className="muted">{t("Este título não tem IMDB id — torrents indisponiveis.")}</p>;
  if (error) return <p className="auth-error">{error}</p>;
  if (!list) return <p className="muted">{t("A procurar torrents...")}</p>;
  if (!list.length) return <p className="muted">{t("Nenhum torrent encontrado.")}</p>;

  const haveInstant = debrid?.linked && [...(debrid.instant || [])].length > 0;

  return (
    <div className="torrents">
      {selected && (streaming || streamErr || videoSrc) && (
        <>
          {streaming && <p className="muted">{t("A preparar stream no Real-Debrid...")}</p>}
          {streamErr && (
            <p className="muted" style={{ fontSize: 12 }}>
              {t("Debrid indisponível, a tocar via torrent local")} — {streamErr}
            </p>
          )}
          {videoSrc && (
            <VideoPlayer
              key={selected.infoHash + (videoSrc || "")}
              src={videoSrc}
              infoHash={selected.infoHash}
              subtitles={subs}
              startAt={startAt}
              onProgress={onProgress}
              onRemoved={() => {
                setSelected(null);
                setVideoSrc(null);
              }}
            />
          )}
        </>
      )}
      <div className="torrent-filters">
        <div className="tf-qualities">
          <button
            className={`tf-chip ${quality === "all" ? "active" : ""}`}
            onClick={() => setQuality("all")}
          >
            {t("Todas")}
          </button>
          {qualities.map((q) => (
            <button
              key={q}
              className={`tf-chip ${quality === q ? "active" : ""}`}
              onClick={() => setQuality(q)}
            >
              {q}
            </button>
          ))}
        </div>
        {anime && (
          <div className="tf-qualities">
            {[
              { id: "sub", label: "Legendado" },
              { id: "dub", label: "Dobrado" },
              { id: "all", label: "Todos" },
            ].map((a) => (
              <button
                key={a.id}
                className={`tf-chip ${audio === a.id ? "active" : ""}`}
                onClick={() => mudarAudio(a.id)}
              >
                {t(a.label)}
              </button>
            ))}
          </div>
        )}
        <label className="tf-sort">
          {t("Ordenar:")}
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="seeders">{t("Mais seeders")}</option>
            <option value="quality">{t("Qualidade")}</option>
            <option value="size">{t("Maior tamanho")}</option>
            <option value="sizeAsc">{t("Menor tamanho")}</option>
          </select>
        </label>
        <div className="tf-compat">
          <button
            className={`tf-chip ${compat === "all" ? "active" : ""}`}
            onClick={() => setCompat("all")}
          >
            {t("Todos")}
          </button>
          {haveInstant && (
            <button
              className={`tf-chip ${compat === "instant" ? "active" : ""}`}
              onClick={() => setCompat(compat === "instant" ? "all" : "instant")}
              title={t("Só torrents que já estão em cache no Real-Debrid (reproduzem logo)")}
            >
              {t("⚡ Debrid")}
            </button>
          )}
          <button
            className={`tf-chip ${compat === "playable" ? "active" : ""}`}
            onClick={() => setCompat("playable")}
          >
            {t("✓ Reproduz no browser")}
          </button>
          <button
            className={`tf-chip ${codec === "x264" ? "active" : ""}`}
            onClick={() => setCodec(codec === "x264" ? "all" : "x264")}
            title={t("Só torrents x264 (mais compatíveis com o browser)")}
          >
            {t("x264")} {/* i18n: codec, igual nos dois idiomas */}
          </button>
          <button
            className={`tf-chip ${codec === "x265" ? "active" : ""}`}
            onClick={() => setCodec(codec === "x265" ? "all" : "x265")}
            title={t("Só torrents x265/HEVC (mais pequenos, mas o browser não reproduz)")}
          >
            {t("x265")} {/* i18n: codec, igual nos dois idiomas */}
          </button>
        </div>
      </div>

      <div className="torrent-list">
        {shown.map((tt, i) => {
          const isInstant = debrid?.instant?.has(tt.infoHash);
          return (
            <button
              key={`${tt.infoHash}-${i}`}
              className={`torrent-item ${
                selected?.infoHash === tt.infoHash ? "active" : ""
              }`}
              onClick={() => pick(tt)}
            >
              <span className="tq">{tt.quality}</span>
              <span className="tt">
                {tt.title}
                {isInstant && (
                  <span className="tinstant" title={t("Já está em cache no Real-Debrid — reproduz logo")}>⚡ Debrid</span>
                )}
                {tt.provider && (
                  <span className="tprovider" title={t("Fonte: {p}", { p: tt.provider })}>
                    {tt.provider}
                  </span>
                )}
                {anime && tt.dub && (
                  <span className="taudio">{tt.dual ? t("DUB") : t("Legendado")}</span>
                )}
              </span>
              <span className="tmeta">
                {tt.playable ? (
                  <span className="tplay" title={t("Reproduz nativamente no browser (mp4/webm)")}>{t("✓ browser")}</span>
                ) : (
                  <span
                    className="tnoplay"
                    title={
                    tt.codec === "x265"
                      ? t(".mkv x265 — o Chrome/Safari não reproduzem este codec. Prefere .mp4 x264.")
                      : t("{e} {c} — pode não reproduzir no browser. Prefere .mp4.", {
                          e: tt.ext || "",
                          c: tt.codec || "",
                        })
                  }
                  >
                    ⚠ {tt.ext ? tt.ext.slice(1).toUpperCase() : "?"}
                  </span>
                )}
                {tt.size ? tt.size : ""}
                {tt.seeders != null ? ` · 👤 ${tt.seeders}` : ""}
              </span>
            </button>
          );
        })}
        {!shown.length && (
          <p className="muted">{t("Nenhum torrent nesta qualidade.")}</p>
        )}
      </div>
    </div>
  );
}