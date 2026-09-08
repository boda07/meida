// Watch Party SEM dependencias externas: salas in-memory no proprio servidor,
// com Server-Sent Events (SSE) para o realtime. O cliente abre um EventSource
// para a sala (a presenca e o heartbeat sao o proprio stream) e publica
// eventos via POST /api/wp/send.
import { Router } from "express";

const router = Router();

// Salas em memoria: code (maiusculas) -> { members: Map<clientId, { nick, res }> }
const rooms = new Map();

function membersList(room) {
  return [...room.members.values()].map((m) => ({ nick: m.nick }));
}

function sseEvent(payload) {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

function broadcast(room, payload, exceptId) {
  for (const [id, m] of room.members) {
    if (id === exceptId) continue;
    try {
      m.res.write(sseEvent(payload));
    } catch {
      // cliente desapareceu; o 'close' do stream trata da limpeza
    }
  }
}

function announceMembers(room, exceptId) {
  broadcast(room, { type: "members", members: membersList(room) }, exceptId);
}

// Publica um evento da sala para todos (menos o autor). Ex.: nav, playback,
// hello, sync-request.
router.post("/wp/send", (req, res) => {
  const { room, from, kind, data } = req.body || {};
  const code = String(room || "").toUpperCase();
  if (!code || !kind) return res.status(400).json({ error: "room e kind sao obrigatorios." });
  const r = rooms.get(code);
  if (r) broadcast(r, { type: "event", kind, data, from }, from);
  res.json({ ok: true });
});

// Stream SSE: enquanto o cliente estiver ligado, esta na sala. A ligacao em si
// e a presenca (fechar o stream = sair da sala e atualiza a lista dos outros).
router.get("/wp/stream", (req, res) => {
  const code = String(req.query.room || "").toUpperCase();
  const client = String(req.query.client || "").slice(0, 100);
  const nick = String(req.query.nick || "?").slice(0, 40);
  if (!code || !client) return res.status(400).json({ error: "room e client sao obrigatorios." });

  let room = rooms.get(code);
  if (!room) {
    room = { members: new Map() };
    rooms.set(code, room);
  }

  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders?.();
  res.write(": connected\n\n");

  const member = { nick, res };
  room.members.set(client, member); // reconnect do EventSource: substitui a ligacao

  // Snapshot para o proprio + lista atualizada para os outros.
  res.write(sseEvent({ type: "members", members: membersList(room) }));
  announceMembers(room, client);

  // Heartbeat: proxies podem cortar streams com longas pausas (Render/dev).
  const ping = setInterval(() => {
    try {
      res.write(": ping\n\n");
    } catch {
      clearInterval(ping);
    }
  }, 20000);

  const cleanup = () => {
    clearInterval(ping);
    if (room.members.get(client)?.res === res) {
      room.members.delete(client);
      if (room.members.size === 0) rooms.delete(code);
      else announceMembers(room, client);
    }
  };
  req.on("close", cleanup);
  res.on("close", cleanup);
});

export { router as watchPartyRouter };