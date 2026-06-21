import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import HlsPlayer from "./HlsPlayer.jsx";

// Reprodução "sem anúncios": extrai o stream direto e junta legendas.
export default function Extract({ details, season, episode }) {
  const [data, setData] = useState(null);
  const [subs, setSubs] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  // Extrair stream
  useEffect(() => {
    setLoading(true);
    setError(null);
    setData(null);
    const opts = {
      type: details.type,
      tmdb: details.id,
      imdb: details.imdbId,
      title: details.title,
      year: details.year,
    };
    if (details.type === "tv") {
      opts.season = season;
      opts.episode = episode;
    }
    api
      .extract(opts)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [details, season, episode]);

  // Legendas (OpenSubtitles) — independente da extracao
  useEffect(() => {
    if (!details.imdbId) return;
    const opts = { imdb: details.imdbId };
    if (details.type === "tv") {
      opts.season = season;
      opts.episode = episode;
    }
    api
      .subtitles(opts)
      .then((d) => setSubs(d.subtitles || []))
      .catch(() => setSubs([]));
  }, [details, season, episode]);

  if (loading) return <p className="muted">A extrair stream sem anúncios...</p>;
  if (error)
    return (
      <div className="extract-empty">
        <p>Sem stream direto para este título de momento.</p>
        <p className="muted">
          Os extractores gratuitos são instaveis. Usa o separador{" "}
          <b>Providers</b> (com anúncios) ou <b>Torrents</b>. Para reprodução sem
          anúncios fiavel, liga um extractor (Consumet) em{" "}
          <code>EXTRACTOR_API_BASE</code> no <code>server/.env</code>.
        </p>
      </div>
    );

  const allSubs = [...subs, ...(data.subtitles || [])];
  return (
    <>
      <HlsPlayer sources={data.sources} subtitles={allSubs} />
      <p className="muted" style={{ fontSize: 12 }}>
        Fonte: {data.provider}
        {allSubs.length ? ` · ${allSubs.length} legendas` : " · sem legendas"}
      </p>
    </>
  );
}
