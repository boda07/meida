import { Router } from "express";
import { requireAuth } from "../services/auth.js";
import { upsertLibrary, getLibraryItem, setLetterboxd, getLetterboxd } from "../store.js";
import { importDiary, importWatchlist } from "../services/letterboxd.js";

export const letterboxdRouter = Router();
letterboxdRouter.use(requireAuth);

// Estado da ligacao do utilizador atual.
letterboxdRouter.get("/letterboxd/status", (req, res) => {
  const lb = getLetterboxd(req.user.id);
  res.json({ username: lb?.username || null });
});

// Liga uma conta: valida que o RSS publico existe e guarda o username.
letterboxdRouter.post("/letterboxd/link", async (req, res, next) => {
  try {
    const username = String(req.body?.username || "").trim();
    if (!username) return res.status(400).json({ error: "Indica o teu username do Letterboxd." });
    // importDiary valida o utilizador (404 se nao existir).
    await importDiary(username);
    setLetterboxd(req.user.id, { username: username.toLowerCase() });
    res.json({ ok: true, username: username.toLowerCase() });
  } catch (err) {
    next(err);
  }
});

letterboxdRouter.post("/letterboxd/unlink", (req, res) => {
  setLetterboxd(req.user.id, null);
  res.json({ ok: true });
});

// Importa o diario recente (filmes vistos + nota) e a watchlist do Letterboxd
// para a biblioteca. Vistos e watchlist nao se sobrepoem (visto tem prioridade).
letterboxdRouter.post("/letterboxd/import", async (req, res, next) => {
  try {
    const lb = getLetterboxd(req.user.id);
    if (!lb?.username) return res.status(400).json({ error: "Liga primeiro a tua conta Letterboxd." });

    const [diary, watchlist] = await Promise.all([
      importDiary(lb.username),
      importWatchlist(lb.username),
    ]);

    const watchedIds = new Set();
    for (const f of diary) {
      watchedIds.add(f.tmdbId);
      upsertLibrary({
        userId: req.user.id,
        tmdbId: f.tmdbId,
        type: "movie",
        title: f.title,
        poster: f.poster,
        watched: 1,
        watchlist: 0,
        score: f.rating != null ? f.rating : null, // a tua nota (1-10)
      });
    }

    let wl = 0;
    for (const f of watchlist) {
      if (watchedIds.has(f.tmdbId)) continue; // ja visto -> nao volta a watchlist
      const existing = getLibraryItem(req.user.id, f.tmdbId, "movie");
      if (existing?.watched) continue;
      upsertLibrary({
        userId: req.user.id,
        tmdbId: f.tmdbId,
        type: "movie",
        title: f.title,
        poster: f.poster,
        watched: 0,
        watchlist: 1,
        score: existing?.score ?? null,
      });
      wl++;
    }

    res.json({ imported: diary.length, watchlist: wl });
  } catch (err) {
    next(err);
  }
});
