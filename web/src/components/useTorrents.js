import { useEffect, useState } from "react";
import { api } from "../api/client.js";

// Busca de torrents, disponibilidade Real-Debrid e legendas OpenSubtitles.
//
// Responsabilidade unica: chamar as tres APIs e gerir o estado associado
// (lista, erro, debrid, subtitulos). Os filtros e ordenacao vivem noutro hook.
//
// Devolve: { list, error, subs, debrid }
export function useTorrents({ type, imdb, title, season, episode }) {
  const [list, setList] = useState(null);
  const [error, setError] = useState(null);
  const [subs, setSubs] = useState([]);
  const [debrid, setDebrid] = useState(null);

  // Busca torrents.
  useEffect(() => {
    setList(null);
    setError(null);
    if (!imdb) return;
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

  return { list, error, subs, debrid };
}
