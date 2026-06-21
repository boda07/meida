import { Router } from "express";
import crypto from "node:crypto";
import { requireAuth } from "../services/auth.js";
import { upsertLibrary, importProgress } from "../store.js";

// "2020-12-15" | "2020-12" | "2020" -> ISO (meio-dia UTC) ou null.
function isoDate(d) {
  const parts = String(d || "").split("-");
  if (!/^\d{4}$/.test(parts[0])) return null;
  const mo = /^\d{2}$/.test(parts[1] || "") ? parts[1] : "01";
  const da = /^\d{2}$/.test(parts[2] || "") ? parts[2] : "01";
  const dt = new Date(`${parts[0]}-${mo}-${da}T12:00:00Z`);
  return isNaN(dt.getTime()) ? null : dt.toISOString();
}
import {
  malEnabled,
  makeVerifier,
  buildAuthUrl,
  linkAccount,
  getAnimeList,
  updateEpisode,
  status as malStatus,
  unlink as malUnlink,
} from "../services/mal.js";

export const malRouter = Router();

// Estados OAuth pendentes (state -> { verifier, userId }). Curta duracao.
const pending = new Map();
function cleanup() {
  const now = Date.now();
  for (const [k, v] of pending) if (now - v.at > 10 * 60 * 1000) pending.delete(k);
}

// Esta o MAL configurado neste servidor?
malRouter.get("/mal/enabled", (req, res) => {
  res.json({ enabled: malEnabled() });
});

// Estado da ligacao do utilizador atual.
malRouter.get("/mal/status", requireAuth, (req, res) => {
  res.json(malStatus(req.user.id));
});

// Inicia o OAuth: devolve o URL de autorizacao para o frontend abrir.
malRouter.get("/mal/login", requireAuth, (req, res) => {
  if (!malEnabled()) return res.status(400).json({ error: "MAL nao configurado no servidor." });
  cleanup();
  const state = crypto.randomBytes(16).toString("hex");
  const verifier = makeVerifier();
  pending.set(state, { verifier, userId: req.user.id, at: Date.now() });
  res.json({ authUrl: buildAuthUrl(state, verifier) });
});

// Callback do MAL (aberto no browser). Troca o code por tokens e guarda-os.
malRouter.get("/mal/callback", async (req, res) => {
  const { code, state } = req.query;
  const entry = state ? pending.get(String(state)) : null;
  const page = (msg) =>
    `<!doctype html><html><head><meta charset="utf-8"><title>MEIDA + MAL</title>
     <style>body{background:#0f0f12;color:#fff;font-family:system-ui;display:flex;
     min-height:100vh;align-items:center;justify-content:center;text-align:center}
     .c{max-width:420px;padding:24px}b{color:#c90303}</style></head>
     <body><div class="c">${msg}</div></body></html>`;

  if (!code || !entry) {
    return res.status(400).send(page("Falha ao ligar o MAL. Volta a tentar na app."));
  }
  pending.delete(String(state));
  try {
    await linkAccount(entry.userId, String(code), entry.verifier);
    res.send(page("<h2><b>MAL ligado!</b></h2><p>Ja podes fechar esta janela e voltar a app.</p>"));
  } catch (e) {
    res.status(500).send(page(`Erro: ${e.message}`));
  }
});

// Desligar a conta MAL.
malRouter.post("/mal/unlink", requireAuth, (req, res) => {
  malUnlink(req.user.id);
  res.json({ ok: true });
});

// Importar a lista do MAL para a biblioteca da app (entradas tipo "anime").
malRouter.post("/mal/import", requireAuth, async (req, res, next) => {
  try {
    const list = await getAnimeList(req.user.id);
    let count = 0;
    let diary = 0;
    for (const it of list) {
      const node = it.node || {};
      const ls = it.list_status || {};
      if (!node.id) continue;
      const watched = ls.status === "completed";
      const watchlist = ls.status === "plan_to_watch" || ls.status === "watching";
      const titleRomaji = node.title || "";
      const titleEn = node.alternative_titles?.en || "";
      const poster = node.main_picture?.large || node.main_picture?.medium || null;
      upsertLibrary({
        userId: req.user.id,
        tmdbId: node.id, // id do MAL (a app trata "anime" por malId)
        type: "anime",
        title: titleEn || titleRomaji, // ingles por default
        titleEn: titleEn || null,
        titleRomaji: titleRomaji || null,
        genres: (node.genres || []).map((g) => g.name),
        poster,
        watched: watched ? 1 : 0,
        watchlist: watchlist ? 1 : 0,
        score: ls.score ? ls.score : null,
      });
      count++;

      // Diario: usa as datas de inicio/fim que o MAL guarda por anime.
      const startedAt = isoDate(ls.start_date);
      const finishedAt = isoDate(ls.finish_date);
      if (startedAt || finishedAt) {
        const watching = ls.status === "watching";
        const seen = ls.num_episodes_watched || 0;
        importProgress({
          userId: req.user.id,
          type: "anime",
          tmdbId: node.id,
          title: titleEn || titleRomaji,
          poster,
          // "A ver" -> retoma no episodio seguinte; concluido -> ultimo visto.
          episode: watching ? seen + 1 : seen || null,
          startedAt,
          finishedAt,
          status: watching ? "watching" : "finished",
        });
        diary++;
      }
    }
    res.json({ imported: count, diary });
  } catch (err) {
    next(err);
  }
});

// Scrobble: marca um episodio como visto no MAL.
malRouter.post("/mal/scrobble", requireAuth, async (req, res, next) => {
  try {
    const { malId, episode } = req.body || {};
    if (!malId) return res.status(400).json({ error: "falta malId" });
    const result = await updateEpisode(req.user.id, Number(malId), Number(episode) || 1);
    res.json({ ok: true, status: result?.status, watched: result?.num_episodes_watched });
  } catch (err) {
    next(err);
  }
});
