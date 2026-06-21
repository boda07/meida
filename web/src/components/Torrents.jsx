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

// Procura torrents (Torrentio) e reproduz o escolhido no nosso player.
export default function Torrents({ type, imdb, season, episode }) {
  const [list, setList] = useState(null);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [subs, setSubs] = useState([]);
  const [quality, setQuality] = useState("all");
  const [sortBy, setSortBy] = useState("seeders");

  useEffect(() => {
    setSelected(null);
    if (!imdb) return;
    setList(null);
    setError(null);
    const opts = { type, imdb };
    if (type === "tv") {
      opts.season = season;
      opts.episode = episode;
    }
    api
      .torrents(opts)
      .then((d) => setList(d.torrents))
      .catch((e) => setError(e.message));
  }, [type, imdb, season, episode]);

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

  // Aplica filtro de qualidade + ordenação.
  const shown = useMemo(() => {
    let arr = list || [];
    if (quality !== "all") arr = arr.filter((t) => t.quality === quality);
    const sorted = [...arr].sort((a, b) => {
      if (sortBy === "size") return sizeToBytes(b.size) - sizeToBytes(a.size);
      return (b.seeders ?? -1) - (a.seeders ?? -1); // seeders desc (default)
    });
    return sorted;
  }, [list, quality, sortBy]);

  if (!imdb)
    return <p className="muted">Este título não tem IMDB id — torrents indisponiveis.</p>;
  if (error) return <p className="auth-error">{error}</p>;
  if (!list) return <p className="muted">A procurar torrents...</p>;
  if (!list.length) return <p className="muted">Nenhum torrent encontrado.</p>;

  const streamUrl = selected
    ? `/api/stream/${selected.infoHash}` +
      (selected.fileIdx != null ? `?fileIdx=${selected.fileIdx}` : "")
    : null;

  return (
    <div className="torrents">
      {selected && (
        <VideoPlayer
          key={streamUrl}
          src={streamUrl}
          infoHash={selected.infoHash}
          subtitles={subs}
        />
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
        <label className="tf-sort">
          Ordenar:
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="seeders">Mais seeders</option>
            <option value="size">Maior tamanho</option>
          </select>
        </label>
      </div>

      <div className="torrent-list">
        {shown.map((t, i) => (
          <button
            key={`${t.infoHash}-${i}`}
            className={`torrent-item ${
              selected?.infoHash === t.infoHash ? "active" : ""
            }`}
            onClick={() => setSelected(t)}
          >
            <span className="tq">{t.quality}</span>
            <span className="tt">{t.title}</span>
            <span className="tmeta">
              {t.size ? t.size : ""}
              {t.seeders != null ? ` · 👤 ${t.seeders}` : ""}
            </span>
          </button>
        ))}
        {!shown.length && (
          <p className="muted">Nenhum torrent nesta qualidade.</p>
        )}
      </div>
    </div>
  );
}
