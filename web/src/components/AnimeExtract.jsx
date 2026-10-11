import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import { useSettings } from "../settings/SettingsContext.jsx";
import HlsPlayer from "./HlsPlayer.jsx";
import { useT } from "../i18n/I18nContext.jsx";

// Reprodução de anime "sem anúncios" no nosso player (via extrator alojado).
// Da legendas soft (toggle no player) e sync no watch party (HlsPlayer).
export default function AnimeExtract({ details, episode, startAt, onProgress, audio }) {
  const t = useT();
  const { settings } = useSettings();
  const animeAudio = audio || settings.animeAudio;
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
        audio: animeAudio,
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [details, episode, animeAudio]);

  if (loading)
    return (
      <p className="muted">
        {t("A extrair stream sem anúncios (a 1a vez pode demorar ~30s a acordar o servidor)...")}
      </p>
    );
  if (error || !data?.sources?.length)
    return (
      <div className="extract-empty">
        <p>{t("Sem stream sem anúncios para este episódio de momento.")}</p>
        <p className="muted">
          {t("{erro} — usa o separador {separador}.", {
            erro: error || t("O extrator não devolveu fontes."),
            separador: <b>{t("Fontes")}</b>,
          })}
        </p>
      </div>
    );

  return (
    <>
      <HlsPlayer
        sources={data.sources}
        subtitles={data.subtitles}
        startAt={startAt}
        onProgress={onProgress}
      />
      <p className="muted" style={{ fontSize: 12 }}>
        {t("Fonte: {fonte} · {audio} · {n} legendas (liga/desliga no player)", {
          fonte: data.provider,
          audio: t(animeAudio === "dub" ? "Dobrado" : "Legendado"),
          n: (data.subtitles || []).length,
        })}
      </p>
    </>
  );
}
