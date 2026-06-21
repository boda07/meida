import { Router } from "express";
import { requireAuth } from "../services/auth.js";
import {
  upsertLibrary,
  getLibraryItem,
  setLetterboxd,
  getLetterboxd,
  importProgress,
} from "../store.js";
import { importDiary, importFilms, importWatchlist } from "../services/letterboxd.js";

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

    // what: "films" (so vistos) | "watchlist" (so watchlist) | "all" (ambos).
    const what = req.body?.what || "all";
    const doFilms = what === "all" || what === "films";
    const doWatch = what === "all" || what === "watchlist";

    // Filmes vistos = lista completa (/films/, com nota); watchlist = paginas.
    const [films, watchlist] = await Promise.all([
      doFilms ? importFilms(lb.username) : Promise.resolve([]),
      doWatch ? importWatchlist(lb.username) : Promise.resolve([]),
    ]);

    const watchedIds = new Set();
    for (const f of films) {
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

    // Diario: o RSS do Letterboxd traz as datas em que viste os filmes mais
    // recentes (~50). Cria entradas no diario com essas datas.
    let diary = 0;
    if (doFilms) {
      try {
        const recent = await importDiary(lb.username);
        for (const d of recent) {
          if (!d.watchedDate) continue;
          const dt = new Date(`${d.watchedDate}T12:00:00Z`);
          if (isNaN(dt.getTime())) continue;
          const li = getLibraryItem(req.user.id, d.tmdbId, "movie");
          importProgress({
            userId: req.user.id,
            type: "movie",
            tmdbId: d.tmdbId,
            title: li?.title || d.title,
            poster: li?.poster || d.poster || null,
            finishedAt: dt.toISOString(),
            status: "finished",
          });
          diary++;
        }
      } catch {
        /* sem RSS -> importa na mesma o resto */
      }
    }

    res.json({ imported: films.length, watchlist: wl, diary });
  } catch (err) {
    next(err);
  }
});
