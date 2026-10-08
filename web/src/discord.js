// Presence no Discord: mostra o que o utilizador esta a ver ("A ver <titulo> S1E2
// 12:34/45:00"). Tudo local e gratis — nenhum pedido a servidores.
//
// Em Electron vai por IPC ate ao processo principal (que fala com o Discord pelo
// Named Pipe). Numa versao web/PWA nao ha nada a fazer: o `window.electronAPI`
// nao existe e estas funcoes passam a no-op silencioso.

import { settingsStore } from "./api/client.js";

// O frontend nunca deve partir se o Discord nao existir: qualquer erro aqui e
// engolido de proposito (a presenca e umaACTIVIDADE, nunca uma funcionalidade).
function bridge() {
  return typeof window !== "undefined" ? window.electronAPI : null;
}

// Desligado nas Definicoes? Presenca nenhuma.
function enabled() {
  return settingsStore.get().discordPresence !== false;
}

export function presenceSupported() {
  return Boolean(bridge()?.setPresence);
}

function clock(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(ss)}` : `${m}:${pad(ss)}`;
}

// Cartaz grande no Discord. O poster pode ja ser um URL absoluto (imagens do
// Jikan/MAL) ou o caminho do TMDB (ex.: "/abc.jpg"), como em imageUrl().
function posterUrl(poster, size = "w342") {
  if (!poster) return "";
  if (/^https?:\/\//i.test(poster)) return poster;
  return `https://image.tmdb.org/t/p/${size}${poster}`;
}

// `phase` = "tv" | "anime" | "movie"; devolve a linha de baixo do Discord.
function subLine(phase, season, episode, position, duration) {
  const bits = [];
  if ((phase === "tv" || phase === "anime") && episode) {
    bits.push(season ? `S${season}E${episode}` : `E${episode}`);
  }
  if (position != null && duration > 0) {
    bits.push(`${clock(position)} / ${clock(duration)}`);
  }
  return bits.join(" · ");
}

/**
 * Mostra/actualiza a presenca.
 * @param {{title?:string, type?:string, season?:number, episode?:number,
 *          position?:number, duration?:number, poster?:string,
 *          paused?:boolean}} media
 */
export function showPresence(media) {
  const api = bridge();
  if (!api?.setPresence || !media?.title || !enabled()) return;
  try {
    api.setPresence({
      details: media.title,
      state: subLine(media.type, media.season, media.episode, media.position, media.duration),
      largeImage: posterUrl(media.poster),
      largeText: media.title,
      // `paused` congela o contador do Discord. Sem isto o tempo continuava a
      // correr com o video parado.
      paused: Boolean(media.paused),
    });
  } catch {
    /* silencioso */
  }
}

// Esconde a presenca (saiu da pagina, fechou o titulo, desligou nas Definicoes).
export function clearPresence() {
  const api = bridge();
  if (!api?.clearPresence) return;
  try {
    api.clearPresence();
  } catch {
    /* silencioso */
  }
}