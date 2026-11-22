// Tokens de serviços externos (MAL, AniList, Letterboxd, Real-Debrid).
//
// Antes cada um era uma função à parte repetida quatro vezes. Agora é uma
// tabela só; as funções CONTINUAM separadas para os importadores não mudarem.
import { db } from "../db/index.js";
import { now } from "./util.js";

function setToken(id, provider, payload) {
  db.prepare(
    `INSERT INTO user_tokens (user_id, provider, payload, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, provider) DO UPDATE SET
       payload = excluded.payload, updated_at = excluded.updated_at`
  ).run(id, provider, payload == null ? null : JSON.stringify(payload), now());
}

function getToken(id, provider) {
  const r = db
    .prepare("SELECT payload FROM user_tokens WHERE user_id = ? AND provider = ?")
    .get(id, provider);
  if (!r?.payload) return null;
  try {
    return JSON.parse(r.payload);
  } catch {
    return null;
  }
}

/* ===== Tokens do MyAnimeList (por utilizador) ===== */
// { accessToken, refreshToken, expiresAt, username }
export function setMalTokens(id, tokens) {
  setToken(id, "mal", tokens);
}
export function getMalTokens(id) {
  return getToken(id, "mal");
}

/* ===== Tokens do AniList (por utilizador) ===== */
export function setAnilistTokens(id, tokens) {
  setToken(id, "anilist", tokens);
}
export function getAnilistTokens(id) {
  return getToken(id, "anilist");
}

/* ===== Letterboxd (por utilizador) ===== */
// { username }
export function setLetterboxd(id, lb) {
  setToken(id, "letterboxd", lb);
}
export function getLetterboxd(id) {
  return getToken(id, "letterboxd");
}

/* ===== Real-Debrid (por utilizador) ===== */
// { token }
export function setDebrid(id, debrid) {
  setToken(id, "debrid", debrid);
}
export function getDebrid(id) {
  return getToken(id, "debrid");
}