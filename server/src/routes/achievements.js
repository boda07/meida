import { Router } from "express";
import { requireAuth } from "../services/auth.js";
import { listLibrary } from "../store.js";
import { listProgress } from "../store.js";

export const achievementsRouter = Router();
achievementsRouter.use(requireAuth);

// Definicao de todas as conquistas. `check` recebe os dados do utilizador e
// devolve true/false. `icon` identifica o SVG no cliente (sem emojis).
const BADGES = [
  {
    id: "first",
    label: "Primeiro passo",
    desc: "Marcaste o teu primeiro título como visto.",
    icon: "movie",
    check: (d) => d.watchedCount >= 1,
  },
  {
    id: "movies_10",
    label: "Matiné",
    desc: "Viste 10 filmes.",
    icon: "movie",
    check: (d) => d.moviesWatched >= 10,
  },
  {
    id: "movies_50",
    label: "Cinéfilo",
    desc: "Viste 50 filmes.",
    icon: "movie",
    check: (d) => d.moviesWatched >= 50,
  },
  {
    id: "movies_100",
    label: "Colecionador",
    desc: "Viste 100 filmes.",
    icon: "movie",
    check: (d) => d.moviesWatched >= 100,
  },
  {
    id: "tv_5",
    label: "Maratonista",
    desc: "Viste 5 séries.",
    icon: "tv",
    check: (d) => d.tvWatched >= 5,
  },
  {
    id: "tv_20",
    label: "Viciado",
    desc: "Viste 20 séries.",
    icon: "tv",
    check: (d) => d.tvWatched >= 20,
  },
  {
    id: "anime_10",
    label: "Otaku",
    desc: "Viste 10 animes.",
    icon: "anime",
    check: (d) => d.animeWatched >= 10,
  },
  {
    id: "anime_50",
    label: "Mestre anime",
    desc: "Viste 50 animes.",
    icon: "anime",
    check: (d) => d.animeWatched >= 50,
  },
  {
    id: "rated_5",
    label: "Crítico",
    desc: "Dás a tua primeira nota a 5 títulos.",
    icon: "star",
    check: (d) => d.ratedCount >= 5,
  },
  {
    id: "rated_20",
    label: "Curador",
    desc: "Avaliaste 20 títulos.",
    icon: "star",
    check: (d) => d.ratedCount >= 20,
  },
  {
    id: "library_100",
    label: "Biblioteca",
    desc: "Tens 100 títulos na tua lista.",
    icon: "list",
    check: (d) => d.totalCount >= 100,
  },
  {
    id: "watched_100",
    label: "Centenário",
    desc: "Viste 100 títulos no total.",
    icon: "fire",
    check: (d) => d.watchedCount >= 100,
  },
  {
    id: "streak_7",
    label: "Implacável",
    desc: "7 dias de racha: viste ou marcaste algo por 7 dias seguidos.",
    icon: "streak",
    check: (d) => d.bestStreak >= 7,
  },
  {
    id: "streak_30",
    label: "Lenda",
    desc: "30 dias de racha.",
    icon: "streak",
    check: (d) => d.bestStreak >= 30,
  },
];

// Data local "YYYY-MM-DD" a partir de um ISO.
function dayOf(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

// Racha atual e historical a partir de um Set de dias de atividade.
function computeStreak(days) {
  if (!days.size) return { streak: 0, bestStreak: 0 };
  const sorted = [...days].sort((a, b) => (a < b ? 1 : -1)); // desc
  // Dia mais recente com atividade.
  const latest = sorted[0];
  const today = dayOf(new Date().toISOString());
  // Só conta racha "vivo" se a última atividade foi hoje ou ontem.
  const isLive = latest === today || latest === yesterday(today);
  let streak = 0;
  let cur = today;
  if (isLive) {
    // conta para trás a partir de hoje (ou ontem se hoje não houve)
    if (!days.has(today)) cur = yesterday(today);
    while (days.has(cur)) {
      streak++;
      cur = yesterday(cur);
    }
  }
  // Melhor racha histórica (independentemente de estar "vivo").
  let best = 0;
  let run = 0;
  const asc = [...days].sort();
  let prev = null;
  for (const day of asc) {
    if (prev === null || day === tomorrow(prev)) {
      run++;
      best = Math.max(best, run);
    } else {
      run = 1;
    }
    prev = day;
  }
  return { streak: isLive ? streak : streak, bestStreak: Math.max(best, streak) };
}

function yesterday(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d - 1));
  return dt.toISOString().slice(0, 10);
}
function tomorrow(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + 1));
  return dt.toISOString().slice(0, 10);
}

achievementsRouter.get("/achievements", (req, res) => {
  const library = listLibrary(req.user.id);
  const progress = listProgress(req.user.id);

  const counts = {
    movies: 0,
    tv: 0,
    anime: 0,
    watched: 0,
    rated: 0,
    total: library.length,
    days: new Set(),
  };
  for (const i of library) {
    const day = i.updatedAt ? dayOf(i.updatedAt) : null;
    if (day) counts.days.add(day);
    if (i.watched) {
      counts.watched++;
      if (i.type === "movie") counts.movies++;
      else if (i.type === "tv") counts.tv++;
      else if (i.type === "anime") counts.anime++;
    }
    if (i.score != null) counts.rated++;
  }
  for (const p of progress) {
    if (p.startedAt) counts.days.add(dayOf(p.startedAt));
    if (p.finishedAt) counts.days.add(dayOf(p.finishedAt));
    if (p.updatedAt) counts.days.add(dayOf(p.updatedAt));
  }

  const { streak, bestStreak } = computeStreak(counts.days);

  const data = {
    moviesWatched: counts.movies,
    tvWatched: counts.tv,
    animeWatched: counts.anime,
    watchedCount: counts.watched,
    ratedCount: counts.rated,
    totalCount: counts.total,
    streak,
    bestStreak,
  };

  const badges = BADGES.map((b) => ({
    id: b.id,
    label: b.label,
    desc: b.desc,
    icon: b.icon,
    unlocked: !!b.check(data),
  }));

  res.json({ badges, streak, bestStreak });
});
