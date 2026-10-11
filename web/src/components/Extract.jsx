import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import HlsPlayer from "./HlsPlayer.jsx";
import { useT } from "../i18n/I18nContext.jsx";

// Reprodução "sem anúncios": extrai o stream direto e junta legendas.
export default function Extract({ details, season, episode, startAt, onProgress }) {
  const t = useT();
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

  if (loading) return <p className="muted">{t("A extrair stream sem anúncios...")}</p>;
  if (error)
    return (
      <div className="extract-empty">
        <p>{t("Sem stream direto para este título de momento.")}</p>
        <p className="muted">
          {t("Os extractores gratuitos são instaveis. Usa o separador {a} (com anúncios) ou {b}.", {
            a: <b>{t("Providers")}</b>,
            b: <b>{t("Torrents")}</b>,
          })}{" "}
          {t("Para reprodução sem anúncios fiavel, liga um extractor (Consumet) em {chave} no {onde}.", {
            chave: <code>EXTRACTOR_API_BASE</code>,
            onde: <code>server/.env</code>,
          })}
        </p>
      </div>
    );

  const allSubs = [...subs, ...(data.subtitles || [])];
  return (
    <>
      <HlsPlayer sources={data.sources} subtitles={allSubs} startAt={startAt} onProgress={onProgress} />
      <p className="muted" style={{ fontSize: 12 }}>
        Fonte: {data.provider}
        {allSubs.length
            ? " · " + t("{n} legendas", { n: allSubs.length })
            : " · " + t("sem legendas")}
      </p>
    </>
  );
}
