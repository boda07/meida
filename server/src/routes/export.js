import { Router } from "express";
import { requireAuth } from "../services/auth.js";
import { listLibrary, listProgress, upsertLibrarySafe } from "../store.js";
import { importProgress } from "../store.js";

export const exportRouter = Router();
exportRouter.use(requireAuth);

// Export da biblioteca + diario do utilizador em JSON (objecto pronto a usar).
// O frontend gera os ficheiros CSV/JSON a partir daqui (client-side, sem deps).
exportRouter.get("/export", (req, res) => {
  const library = listLibrary(req.user.id);
  const diary = listProgress(req.user.id);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.json({ exportedAt: new Date().toISOString(), library, diary });
});

// Parse CSV simples (sem dependências): respeita aspas-dupladas e escapes.
// Devolve { library: [...], diary: [...] } a partir do formato de export.
// O CSV tem duas secções marcadas com "# biblioteca" / "# diario", cada uma com
// a sua linha de cabeçalho. Parse CSV caseiro (aspas + escape de aspas dupladas).
export function parseCsv(text) {
  const rows = [];
  let cur = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      cur.push(field);
      field = "";
    } else if (ch === "\r") {
      /* ignora \r */
    } else if (ch === "\n") {
      cur.push(field);
      field = "";
      rows.push(cur);
      cur = [];
    } else {
      field += ch;
    }
  }
  if (field || cur.length) {
    cur.push(field);
    rows.push(cur);
  }

  const out = { library: [], diary: [] };
  let mode = null; // "biblioteca" | "diario" | null
  let header = null; // array de nomes de coluna para a secção actual
  for (const r of rows) {
    const first = (r[0] || "").trim();
    if (first.startsWith("# ")) {
      mode = first.slice(2).trim();
      header = null; // redefine o cabeçalho na secção seguinte
      continue;
    }
    if (!mode || !r.length) continue;
    if (!header) {
      header = r.map((h) => (h || "").trim());
      continue;
    }
    const obj = {};
    for (let i = 0; i < header.length; i++) {
      if (header[i]) obj[header[i]] = r[i];
    }
    if (!Object.keys(obj).length) continue;
    if (mode === "biblioteca") out.library.push(toLibraryEntry(obj));
    else if (mode === "diario") out.diary.push(toProgressEntry(obj));
  }
  return out;
}

function toLibraryEntry(o) {
  const num = (s) => (s == null || s === "" ? null : Number(s));
  return {
    type: (o.type || "").trim(),
    tmdbId: Number(o.tmdbId),
    title: o.title || null,
    titleEn: o.titleEn || null,
    titleRomaji: o.titleRomaji || null,
    genres: o.generos ? String(o.generos).split("|").map((g) => g.trim()).filter(Boolean) : [],
    score: num(o.nota),
    rating: num(o.media_comunidade),
    watched: o.visto === "sim",
    watchlist: o.watchlist === "sim",
    updatedAt: o.atualizado_em || null,
  };
}

function toProgressEntry(o) {
  const n = (s) => (s == null || s === "" ? null : s);
  const season = n(o.temporada);
  const episode = n(o.episodio);
  let status = (o.estado || "").trim();
  if (!status) status = o.acabou ? "finished" : "watching";
  return {
    type: (o.type || "").trim(),
    tmdbId: Number(o.tmdbId),
    title: o.title || null,
    season: season != null ? Number(season) : null,
    episode: episode != null ? Number(episode) : null,
    status,
    startedAt: n(o.comecou) || null,
    finishedAt: n(o.acabou) || null,
    updatedAt: n(o.atualizado_em) || null,
  };
}

// Importa (merge) a biblioteca + diario vindos de um ficheiro exportado.
// Body JSON: { format: "json", library: [...], diary: [...] }
// Body JSON: { format: "csv", text: "<conteudo csv>" }
// É um merge conservador: não apaga notas/visto que o ficheiro não traga.
exportRouter.post("/export/import", (req, res, next) => {
  const userId = req.user.id;
  try {
    const { format, library, diary, text } = req.body || {};
    let lib = library;
    let dary = diary;
    if (format === "csv" && typeof text === "string") {
      const parsed = parseCsv(text);
      lib = parsed.library;
      dary = parsed.diary;
    }
    if (!Array.isArray(lib) && !Array.isArray(dary)) {
      return res.status(400).json({ error: "formato invalido" });
    }
    let libCount = 0;
    let diaryCount = 0;
    for (const e of lib || []) {
      if (!e.type || !e.tmdbId) continue;
      upsertLibrarySafe({ userId, ...e });
      libCount++;
    }
    for (const e of dary || []) {
      if (!e.type || !e.tmdbId) continue;
      importProgress({ userId, ...e });
      diaryCount++;
    }
    res.json({ imported: { library: libCount, diary: diaryCount } });
  } catch (e) {
    next(e);
  }
});
