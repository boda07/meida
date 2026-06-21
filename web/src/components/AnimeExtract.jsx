import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import { useSettings } from "../settings/SettingsContext.jsx";
import HlsPlayer from "./HlsPlayer.jsx";

// Reproducao de anime "sem anuncios" no nosso player (via extrator alojado).
// Da legendas soft (toggle no player) e sync no watch party (HlsPlayer).
export default function AnimeExtract({ details, episode }) {
  const { settings } = useSettings();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setData(null);
    api
      .animeExtract({
        title: details.title,
        episode: details.isMovie ? 1 : episode,
        audio: settings.animeAudio,
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [details, episode, settings.animeAudio]);

  if (loading)
    return (
      <p className="muted">
        A extrair stream sem anuncios (a 1a vez pode demorar ~30s a acordar o
        servidor)...
      </p>
    );
  if (error || !data?.sources?.length)
    return (
      <div className="extract-empty">
        <p>Sem stream sem anuncios para este episodio de momento.</p>
        <p className="muted">
          {error || "O extrator nao devolveu fontes."} — usa o separador{" "}
          <b>Fontes</b>.
        </p>
      </div>
    );

  return (
    <>
      <HlsPlayer sources={data.sources} subtitles={data.subtitles} />
      <p className="muted" style={{ fontSize: 12 }}>
        Fonte: {data.provider} ·{" "}
        {settings.animeAudio === "dub" ? "Dobrado" : "Legendado"} ·{" "}
        {(data.subtitles || []).length} legendas (liga/desliga no player)
      </p>
    </>
  );
}
