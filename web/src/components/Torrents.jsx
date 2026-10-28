import { useState } from "react";
import VideoPlayer from "./VideoPlayer.jsx";
import { useT } from "../i18n/I18nContext.jsx";
import { useTorrents } from "./useTorrents.js";
import { useTorrentFilters } from "./useTorrentFilters.js";
import { useTorrentPlayer } from "./useTorrentPlayer.js";

// Procura torrents (Torrentio + YTS...) e reproduz o escolhido no nosso player.
// Se o Real-Debrid estiver ligado, os torrents em cache reproduzem logo (sem
// esperar por peers); os outros caem para o WebTorrent local.
export default function Torrents({ type, imdb, title, season, episode, anime, defaultAudio, startAt, onProgress, onAudioChange }) {
  const t = useT();

  // Busca, Debrid e legendas.
  const { list, error, subs, debrid } = useTorrents({ type, imdb, title, season, episode });

  // Filtros e ordenacao.
  const {
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
  } = useTorrentFilters({ list, debrid, anime, defaultAudio });

  // Reproducao (Debrid vs WebTorrent).
  const { videoSrc, streaming, streamErr, pick, setVideoSrc } = useTorrentPlayer({ debrid });

  const [selected, setSelected] = useState(null);

  if (!imdb)
    return <p className="muted">{t("Este título não tem IMDB id — torrents indisponiveis.")}</p>;
  if (error) return <p className="auth-error">{error}</p>;
  if (!list) return <p className="muted">{t("A procurar torrents...")}</p>;
  if (!list.length) return <p className="muted">{t("Nenhum torrent encontrado.")}</p>;

  // Ao escolher um torrent: guarda a selecao e pede o stream.
  const escolher = (tt) => {
    setSelected(tt);
    pick(tt);
  };

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
            {t("x264")}
          </button>
          <button
            className={`tf-chip ${codec === "x265" ? "active" : ""}`}
            onClick={() => setCodec(codec === "x265" ? "all" : "x265")}
            title={t("Só torrents x265/HEVC (mais pequenos, mas o browser não reproduz)")}
          >
            {t("x265")}
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
              onClick={() => escolher(tt)}
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
