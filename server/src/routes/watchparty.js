// Watch Party SEM dependencias externas: salas in-memory no proprio servidor,
// com Server-Sent Events (SSE) para o realtime. O cliente abre um EventSource
// para a sala (a presenca e o heartbeat sao o proprio stream) e publica
// eventos via POST /api/wp/send.
//
// Seguranca (2026-10-16):
//   - Codigo de sala com 6-12 alfanumericos maiusculos (^[A-Z0-9]{6,12}$).
//   - Limite de salas globais e por IP (nao deixa esgotar memoria).
//   - Limite de membros por sala (20).
//   - Payload `data` limitado a 2 KB.
//   - Lista fechada de `kind` validos.
//   - Login obrigatorio: Bearer em /wp/send, ?token= no SSE de /wp/stream.
import { Router } from "express";
import { requireAuth } from "../services/auth.js";

const router = Router();

// ---------------------------------------------------------------------------
// Limites (constantes, fáceis de ajustar)
// ---------------------------------------------------------------------------
const MAX_ROOMS_GLOBAL = 500;   // salas activas no servidor
const MAX_ROOMS_PER_IP = 10;    // salas activas por IP (evita um IP esgotar tudo)
const MAX_MEMBERS_PER_ROOM = 20; // membros por sala
const MAX_DATA_BYTES = 2 * 1024; // 2 KB de payload por evento

// Codigo de sala: 6-12 caracteres alfanumericos maiusculos.
const ROOM_CODE_RE = /^[A-Z0-9]{6,12}$/;

// Tipos de evento permitidos (lista fechada: so o que e necessario).
const KIND_ALLOWED = new Set([
  "nav",       // navegar para outro episodio/filme (host -> membros)
  "play",      // play/pause
  "pause",
  "seek",      // posicao de reproducao
  "hello",     // membro novo entrou (host reenvia rota atual)
  "members",   // lista de membros (servidor -> cliente)
  "event",     // evento generico encaminhado para os outros
]);

// Contagem de salas por IP (chave = ip do socket). Limpeza lazzy: quando uma
// sala fica vazia, removemos a contagem correspondente.
const roomsPerIp = new Map(); // ip -> Set<code>
function incRoomIp(ip, code) {
  let s = roomsPerIp.get(ip);
  if (!s) { s = new Set(); roomsPerIp.set(ip, s); }
  s.add(code);
}
function decRoomIp(ip, code) {
  const s = roomsPerIp.get(ip);
  if (!s) return;
  s.delete(code);
  if (s.size === 0) roomsPerIp.delete(ip);
}

// Salas em memoria: code (maiusculas) -> { members: Map<clientId, { nick, res, ip }> }
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

// ---------------------------------------------------------------------------
// Middleware de autenticacao para /wp/send (Bearer). O SSE (/wp/stream) usa
// ?token= na query porque o EventSource nao suporta headers customizados.
// ---------------------------------------------------------------------------
function authBearer(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Login necessario." });
  // requireAuth ja faz a validacao completa do token; reusamos a logica.
  return requireAuth(req, res, next);
}

// Publica um evento da sala para todos (menos o autor). Ex.: nav, playback,
// hello, sync-request.
router.post("/wp/send", authBearer, (req, res) => {
  const { room, from, kind, data } = req.body || {};
  const code = String(room || "").toUpperCase();
  if (!code || !ROOM_CODE_RE.test(code)) {
    return res.status(400).json({ error: "Codigo de sala invalido (6-12 A-Z0-9)." });
  }
  if (!kind || !KIND_ALLOWED.has(kind)) {
    return res.status(400).json({ error: "Evento nao permitido." });
  }
  const dataStr = data == null ? "" : String(data);
  if (Buffer.byteLength(dataStr) > MAX_DATA_BYTES) {
    return res.status(400).json({ error: "Payload demasiado grande (max 2 KB)." }); }
  const r = rooms.get(code);
  if (!r) return res.status(404).json({ error: "Sala nao encontrada." });
  broadcast(r, { type: "event", kind, data, from }, from);
  res.json({ ok: true });
});

// Stream SSE: enquanto o cliente estiver ligado, esta na sala. A ligacao em si
// e a presenca (fechar o stream = sair da sala e atualiza a lista dos outros).
router.get("/wp/stream", (req, res, _next) => {
  const token = req.query.token;
  if (!token) return res.status(401).json({ error: "Login necessario." });
  // Injetamos o token no header Authorization para o requireAuth validar.
  req.headers.authorization = `Bearer ${token}`;
  return requireAuth(req, res, () => {
    const code = String(req.query.room || "").toUpperCase();
    const client = String(req.query.client || "").slice(0, 100);
    const nick = String(req.query.nick || "?").slice(0, 40);
    const ip = req.ip || req.socket?.remoteAddress || "desconhecido";
    if (!code || !client) return res.status(400).json({ error: "room e client sao obrigatorios." });
    if (!ROOM_CODE_RE.test(code)) {
      return res.status(400).json({ error: "Codigo de sala invalido (6-12 A-Z0-9)." }); }

    // Limite de salas globais.
    let room = rooms.get(code);
    if (!room) {
      if (rooms.size >= MAX_ROOMS_GLOBAL) {
        return res.status(429).json({ error: "Limite de salas atingido. Tenta mais tarde." }); }
      // Limite de salas por IP.
      const ipRooms = roomsPerIp.get(ip);
      if (ipRooms && ipRooms.size >= MAX_ROOMS_PER_IP && !ipRooms.has(code)) {
        return res.status(429).json({ error: "Limite de salas por IP atingido." }); }
      room = { members: new Map(), ip };
      rooms.set(code, room);
      incRoomIp(ip, code);
    } else if (room.ip !== ip) {
      // Uma sala ja existe com outro IP: nao deixamos este IP criar outra sala
      // com o mesmo codigo, mas pode entrar se houver vaga. (o codigo ja existe)
    }

    if (room.members.size >= MAX_MEMBERS_PER_ROOM && !room.members.has(client)) {
      return res.status(429).json({ error: "Sala cheia (maximo 20 membros)." }); }

    res.set({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.flushHeaders?.();
    res.write(": connected\n\n");

    const member = { nick, res, ip };
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
        if (room.members.size === 0) {
          rooms.delete(code);
          decRoomIp(ip, code);
        } else announceMembers(room, client);
      }
    };
    req.on("close", cleanup);
    res.on("close", cleanup);
  });
});

export { router as watchPartyRouter };
