import { Router } from "express";
import { requireAuth } from "../services/auth.js";
import { getDebrid, setDebrid } from "../store.js";
import {
  checkToken,
  instantInfo,
  addMagnet,
  selectFiles,
  torrentInfo,
  createDownload,
  pickVideoFile,
} from "../services/debrid.js";
import { getMagnet, listActive } from "../services/torrentEngine.js";

export const debridRouter = Router();
debridRouter.use(requireAuth);

// infoHash -> { id (RD), token } do torrent em preparo no Real-Debrid.
const rdIds = new Map();

// Chave -> { url direta, token } para o proxy de streaming (não expor o token).
// flags à parte para expirar: usa o infoHash como chave (um por vez por utilizador).
const streams = new Map(); // key -> { directUrl, token }

// Estado da ligacao do utilizador atual.
debridRouter.get("/debrid/status", (req, res) => {
  const d = getDebrid(req.user.id);
  res.json({ linked: !!d?.token, account: d?.account || null });
});

// Liga uma conta: valida o token e guarda-o (por utilizador).
debridRouter.post("/debrid/link", async (req, res, next) => {
  try {
    const token = String(req.body?.token || "").trim();
    if (!token) return res.status(400).json({ error: "Cola o teu token do Real-Debrid." });
    const account = await checkToken(token);
    setDebrid(req.user.id, { token, account });
    res.json({ ok: true, account });
  } catch (err) {
    next(err);
  }
});

debridRouter.post("/debrid/unlink", (req, res) => {
  setDebrid(req.user.id, null);
  res.json({ ok: true });
});

// Disponibilidade "instant" de hashes. body: { hashes: [infoHash, ...] }
debridRouter.post("/debrid/availability", async (req, res, next) => {
  try {
    const d = getDebrid(req.user.id);
    if (!d?.token) return res.json({ linked: false, instant: {} });
    const hashes = Array.isArray(req.body?.hashes) ? req.body.hashes : [];
    const instant = {};
    await Promise.all(
      hashes.map(async (h) => {
        try {
          const info = await instantInfo(d.token, h);
          const ok = info && Array.isArray(info.files) && info.files.length;
          instant[h] = ok ? { instant: true } : { instant: false };
        } catch {
          instant[h] = { instant: false };
        }
      })
    );
    res.json({ linked: true, instant });
  } catch (err) {
    next(err);
  }
});

// Dá o URL de streaming de um torrent. Instant -> link direto (proxy local de
// bytes). Senão -> adiciona ao RD e devolve o link direto assim que estiver pronto.
debridRouter.get("/debrid/stream/:infoHash", async (req, res, next) => {
  try {
    const token = getDebrid(req.user.id)?.token;
    if (!token) return res.status(400).json({ error: "Liga primeiro o Real-Debrid." });

    const key = req.params.infoHash.toLowerCase();
    const fileIdx = req.query.fileIdx != null ? Number(req.query.fileIdx) : null;

    const torrentId = await ensureAdded(token, key);
    const { torrent, file } = await waitReady(token, torrentId, key, fileIdx);

    // Cria o download (link direto) e guarda para o proxy de bytes.
    const dl = await createDownload(token, torrentId, file.id);
    const directKey = `${key}:${file.id}`;
    streams.set(directKey, { directUrl: dl.download, token });
    res.json({
      url: `/api/debrid/raw/${directKey}`,
      instant: torrent.status === 100, // 100 = já totalmente descarregado (cache)
      size: file.bytes,
    });
  } catch (err) {
    next(err);
  }
});

// Proxy de bytes de um ficheiro RD (adiciona o header de autenticação e encaminha
// o Range). É o que o <video> do browser pede.
debridRouter.get("/debrid/raw/:key", async (req, res, next) => {
  try {
    const s = streams.get(req.params.key);
    if (!s) return res.status(404).json({ error: "Stream expirado ou inexistente." });
    const headers = { Authorization: `Bearer ${s.token}` };
    if (req.headers.range) headers.Range = req.headers.range;
    const upstream = await fetch(s.directUrl, { headers });
    if (!upstream.ok && upstream.status !== 206) {
      return res.status(upstream.status).json({ error: `Real-Debrid ${upstream.status}` });
    }
    res.status(upstream.status);
    for (const h of ["content-type", "content-length", "content-range", "accept-ranges"]) {
      const v = upstream.headers.get(h);
      if (v) res.setHeader(h, v);
    }
    res.setHeader("Access-Control-Allow-Origin", "*");
    if (!upstream.body) return res.end();
    const reader = upstream.body.getReader();
    req.on("close", () => reader.cancel().catch(() => {}));
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
    res.end();
  } catch (err) {
    next(err);
  }
});

// Torrents em preparo no RD + locais (WebTorrent).
debridRouter.get("/debrid/active", (_req, res) => {
  const active = [];
  for (const [infoHash, e] of rdIds) {
    active.push({ infoHash, status: e.status });
  }
  res.json({ active, local: listActive() });
});

// --- helpers ---

async function ensureAdded(token, key) {
  const existing = rdIds.get(key);
  if (existing && existing.token === token) {
    if (existing.id) return existing.id;
  }
  const id = await addMagnet(token, getMagnet(key));
  rdIds.set(key, { id, token, status: "added" });
  await selectFiles(token, id, null);
  return id;
}

async function waitReady(token, id, key, fileIdx) {
  const start = Date.now();
  const timeout = 240000;
  while (Date.now() - start < timeout) {
    const info = await torrentInfo(token, id);
    if (info && info.status && info.status % 100 === 0 && Array.isArray(info.files) && info.files.length) {
      const file = fileIdx != null ? info.files[fileIdx] : pickVideoFile(info.files);
      if (file?.id) {
        rdIds.set(key, { id, token, status: "ready" });
        return { torrent: info, file };
      }
    }
    await new Promise((r) => setTimeout(r, 2500));
  }
  throw Object.assign(new Error("O Real-Debrid demorou demasiado a preparar o torrent."), {
    status: 504,
  });
}
