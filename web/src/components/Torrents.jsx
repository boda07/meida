import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client.js";
import VideoPlayer from "./VideoPlayer.jsx";

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
export default function Torrents({ type, imdb, title, season, episode, anime, defaultAudio, startAt, onProgress }) {
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
    return <p className="muted">Este título não tem IMDB id — torrents indisponiveis.</p>;
  if (error) return <p className="auth-error">{error}</p>;
  if (!list) return <p className="muted">A procurar torrents...</p>;
  if (!list.length) return <p className="muted">Nenhum torrent encontrado.</p>;

  const haveInstant = debrid?.linked && [...(debrid.instant || [])].length > 0;

  return (
    <div className="torrents">
      {selected && (streaming || streamErr || videoSrc) && (
        <>
          {streaming && <p className="muted">A preparar stream no Real-Debrid...</p>}
          {streamErr && (
            <p className="muted" style={{ fontSize: 12 }}>
              Debrid indisponível, a tocar via torrent local — {streamErr}
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
            Todas
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
                onClick={() => setAudio(a.id)}
              >
                {a.label}
              </button>
            ))}
          </div>
        )}
        <label className="tf-sort">
          Ordenar:
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="seeders">Mais seeders</option>
            <option value="quality">Qualidade</option>
            <option value="size">Maior tamanho</option>
            <option value="sizeAsc">Menor tamanho</option>
          </select>
        </label>
        <div className="tf-compat">
          <button
            className={`tf-chip ${compat === "all" ? "active" : ""}`}
            onClick={() => setCompat("all")}
          >
            Todos
          </button>
          {haveInstant && (
            <button
              className={`tf-chip ${compat === "instant" ? "active" : ""}`}
              onClick={() => setCompat(compat === "instant" ? "all" : "instant")}
              title="Só torrents que já estão em cache no Real-Debrid (reproduzem logo)"
            >
              ⚡ Debrid
            </button>
          )}
          <button
            className={`tf-chip ${compat === "playable" ? "active" : ""}`}
            onClick={() => setCompat("playable")}
          >
            ✓ Reproduz no browser
          </button>
          <button
            className={`tf-chip ${codec === "x264" ? "active" : ""}`}
            onClick={() => setCodec(codec === "x264" ? "all" : "x264")}
            title="Só torrents x264 (mais compatíveis com o browser)"
          >
            x264
          </button>
          <button
            className={`tf-chip ${codec === "x265" ? "active" : ""}`}
            onClick={() => setCodec(codec === "x265" ? "all" : "x265")}
            title="Só torrents x265/HEVC (mais pequenos, mas o browser não reproduz)"
          >
            x265
          </button>
        </div>
      </div>

      <div className="torrent-list">
        {shown.map((t, i) => {
          const isInstant = debrid?.instant?.has(t.infoHash);
          return (
            <button
              key={`${t.infoHash}-${i}`}
              className={`torrent-item ${
                selected?.infoHash === t.infoHash ? "active" : ""
              }`}
              onClick={() => pick(t)}
            >
              <span className="tq">{t.quality}</span>
              <span className="tt">
                {t.title}
                {isInstant && (
                  <span className="tinstant" title="Já está em cache no Real-Debrid — reproduz logo">⚡ Debrid</span>
                )}
                {t.provider && (
                  <span className="tprovider" title={`Fonte: ${t.provider}`}>
                    {t.provider}
                  </span>
                )}
                {anime && t.dub && (
                  <span className="taudio">{t.dual ? "DUAL" : "DUB"}</span>
                )}
              </span>
              <span className="tmeta">
                {t.playable ? (
                  <span className="tplay" title="Reproduz nativamente no browser (mp4/webm)">✓ browser</span>
                ) : (
                  <span
                    className="tnoplay"
                    title={t.codec === "x265" ? ".mkv x265 — o Chrome/Safari não reproduzem este codec. Prefere .mp4 x264." : `${t.ext || ""} ${t.codec || ""} — pode não reproduzir no browser. Prefere .mp4.`}
                  >
                    ⚠ {t.ext ? t.ext.slice(1).toUpperCase() : "?"}
                  </span>
                )}
                {t.size ? t.size : ""}
                {t.seeders != null ? ` · 👤 ${t.seeders}` : ""}
              </span>
            </button>
          );
        })}
        {!shown.length && (
          <p className="muted">Nenhum torrent nesta qualidade.</p>
        )}
      </div>
    </div>
  );
}