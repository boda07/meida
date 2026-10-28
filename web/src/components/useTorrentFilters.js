import { useMemo, useState } from "react";

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

// Filtros e ordenacao da lista de torrents.
//
// Responsabilidade unica: aplicar filtros (qualidade, compatibilidade, codec,
// audio) e ordenacao (seeders, tamanho, qualidade) sobre a lista bruta.
//
// Devolve: { qualities, shown, setQuality, quality, setSortBy, sortBy,
//           setCompat, compat, setCodec, codec, setAudio, audio, haveInstant }
export function useTorrentFilters({
  list,
  debrid,
  anime = false,
  defaultAudio = "sub",
}) {
  const [quality, setQuality] = useState("all");
  const [sortBy, setSortBy] = useState("seeders");
  const [compat, setCompat] = useState("all");
  const [codec, setCodec] = useState("all");
  const [audio, setAudio] = useState(anime ? defaultAudio : "all");

  // Qualidades presentes (para os botoes do filtro), pela ordem habitual.
  const qualities = useMemo(() => {
    const set = new Set((list || []).map((t) => t.quality));
    return QUALITY_ORDER.filter((q) => set.has(q));
  }, [list]);

  const haveInstant = debrid?.linked && [...(debrid.instant || [])].length > 0;

  // Aplica filtros + ordenacao.
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

  const mudarAudio = (a) => {
    setAudio(a);
    return a;
  };

  return {
    qualities,
    shown,
    haveInstant,
    quality,
    setQuality,
    sortBy,
    setSortBy,
    compat,
    setCompat,
    codec,
    setCodec,
    audio,
    setAudio,
    mudarAudio,
  };
}
