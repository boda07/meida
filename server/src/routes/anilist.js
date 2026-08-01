import { Router } from "express";
import crypto from "node:crypto";
import { requireAuth } from "../services/auth.js";
import {
  anilistEnabled,
  buildAuthUrl,
  linkAccount,
  updateEpisode,
  importAnilistList,
  syncCrossWithMal,
  status as anilistStatus,
  unlink as anilistUnlink,
} from "../services/anilist.js";

export const anilistRouter = Router();

// Estados OAuth pendentes (state -> { userId }). Curta duracao.
const pending = new Map();
function cleanup() {
  const now = Date.now();
  for (const [k, v] of pending) if (now - v.at > 10 * 60 * 1000) pending.delete(k);
}

// Esta o AniList configurado neste servidor?
anilistRouter.get("/anilist/enabled", (req, res) => {
  res.json({ enabled: anilistEnabled() });
});

// Estado da ligacao do utilizador atual.
anilistRouter.get("/anilist/status", requireAuth, (req, res) => {
  res.json(anilistStatus(req.user.id));
});

// Inicia o OAuth: devolve o URL de autorizacao para o frontend abrir.
anilistRouter.get("/anilist/login", requireAuth, (req, res) => {
  if (!anilistEnabled()) return res.status(400).json({ error: "AniList nao configurado no servidor." });
  cleanup();
  const state = crypto.randomBytes(16).toString("hex");
  pending.set(state, { userId: req.user.id, at: Date.now() });
  res.json({ authUrl: buildAuthUrl(state) });
});

// Callback do AniList (aberto no browser). Troca o code por tokens e guarda-os.
anilistRouter.get("/anilist/callback", async (req, res) => {
  const { code, state } = req.query;
  const entry = state ? pending.get(String(state)) : null;
  const page = (msg) =>
    `<!doctype html><html><head><meta charset="utf-8"><title>MEIDA + AniList</title>
     <style>body{background:#0f0f12;color:#fff;font-family:system-ui;display:flex;
     min-height:100vh;align-items:center;justify-content:center;text-align:center}
     .c{max-width:420px;padding:24px}b{color:#6ab2f0}</style></head>
     <body><div class="c">${msg}</div></body></html>`;

  if (!code || !entry) {
    return res.status(400).send(page("Falha ao ligar o AniList. Volta a tentar na app."));
  }
  pending.delete(String(state));
  try {
    const tok = await linkAccount(entry.userId, String(code));
    res.send(page(`<h2><b>AniList ligado!</b></h2><p>Bem-vindo, ${tok.username || "utilizador"}. Ja podes fechar esta janela e voltar a app.</p>`));
  } catch (e) {
    res.status(500).send(page(`Erro: ${e.message}`));
  }
});

// Desligar a conta AniList.
anilistRouter.post("/anilist/unlink", requireAuth, (req, res) => {
  anilistUnlink(req.user.id);
  res.json({ ok: true });
});

// Importar a lista do AniList para a biblioteca da app (entradas tipo "anime").
anilistRouter.post("/anilist/import", requireAuth, async (req, res, next) => {
  try {
    const r = await importAnilistList(req.user.id);
    res.json(r);
  } catch (err) {
    next(err);
  }
});

// Scrobble: marca um episodio como visto no AniList.
anilistRouter.post("/anilist/scrobble", requireAuth, async (req, res, next) => {
  try {
    const { malId, episode } = req.body || {};
    if (!malId) return res.status(400).json({ error: "falta malId" });
    const result = await updateEpisode(req.user.id, Number(malId), Number(episode) || 1);
    res.json({ ok: true, status: result.status, watched: result.numEpisodesWatched });
  } catch (err) {
    next(err);
  }
});

// Cross-sync MAL <-> AniList (requer as duas contas ligadas). Empurra o maximo
// de episodios vistos para a conta atrasada.
anilistRouter.post("/anilist/sync", requireAuth, async (req, res, next) => {
  try {
    const result = await syncCrossWithMal(req.user.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});
