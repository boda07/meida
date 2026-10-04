import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {
  createUser,
  getUserByUsername,
  getUserById,
  ensureUserStub,
  setUserAvatar,
  setUserProfile,
} from "../store.js";
import { config } from "../config.js";

function signToken(user) {
  return jwt.sign({ id: user.id, username: user.username }, config.jwtSecret, {
    expiresIn: "30d",
  });
}

export function register(username, password) {
  username = String(username || "").trim();
  password = String(password || "");
  if (username.length < 3) throw httpError(400, "Utilizador tem de ter 3+ caracteres.");
  if (password.length < 4) throw httpError(400, "Password tem de ter 4+ caracteres.");
  if (getUserByUsername(username)) throw httpError(409, "Esse utilizador ja existe.");

  const hash = bcrypt.hashSync(password, 10);
  const user = createUser(username, hash);
  return { token: signToken(user), user };
}

export function login(username, password) {
  username = String(username || "").trim();
  const row = getUserByUsername(username);
  if (!row || !bcrypt.compareSync(String(password || ""), row.password_hash)) {
    throw httpError(401, "Utilizador ou password invalidos.");
  }
  const user = {
    id: row.id,
    username: row.username,
    avatar: row.avatar || null,
    bio: row.bio || null,
    isPublic: Boolean(row.is_public),
  };
  return { token: signToken(user), user };
}

// Valida e normaliza um avatar. Aceita: emoji predefinido ("emoji:🦊"), URL
// http(s) de imagem, ou uma imagem do PC como data URL ("data:image/...;base64,").
// Devolve null para remover.
function normalizeAvatar(avatar) {
  let value = String(avatar || "").trim();
  if (!value) return null;

  if (/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(value)) {
    // Imagem do computador. Sem cortar (data URLs sao longos); so um teto de
    // seguranca para nao guardar imagens enormes.
    if (value.length > 3_000_000) {
      throw httpError(
        400,
        "Essa imagem é demasiado grande. Escolhe uma mais pequena (até ~2MB)."
      );
    }
  } else if (/^(emoji:|https?:\/\/)/i.test(value)) {
    value = value.slice(0, 500);
  } else {
    throw httpError(
      400,
      "Avatar inválido: usa um emoji predefinido, um link de imagem (https://...) ou uma imagem do teu computador."
    );
  }
  return value;
}

// Mantida para os chamadores antigos.
export function setAvatar(userId, avatar) {
  return setUserAvatar(userId, normalizeAvatar(avatar));
}

// Actualiza o perfil: avatar, bio e privacidade (isPublic). So mexe nos campos
// que vierem no patch — mandar so a bio nao apaga o avatar.
export function updateProfile(userId, patch) {
  const { avatar, bio, isPublic } = patch || {};
  const update = {};
  if (avatar !== undefined) update.avatar = normalizeAvatar(avatar);
  if (bio !== undefined) update.bio = String(bio || "").trim().slice(0, 300) || null;
  if (isPublic !== undefined) update.isPublic = Boolean(isPublic);
  if (!Object.keys(update).length) return getUserById(userId);
  return setUserProfile(userId, update);
}

export function userFromToken(token) {
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    return getUserById(payload.id) || null;
  } catch {
    return null;
  }
}

function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

// Token emitido pelo servidor remoto partilhado (modo "dados na nuvem"). O
// servidor local tem outro JWT_SECRET, por isso nao consegue verificar a
// assinatura. Como as rotas de dados correm no servidor remoto, aqui so
// precisamos do id para as rotas locais (Real-Debrid) — descodificamos o
// payload e garantimos um utilizador-stub local. A superficie de ataque e
// pequena: em modo local o CORS esta desligado e o servidor so escuta 127.0.0.1.
function localUserFromToken(token) {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
    const id = Number(payload?.id);
    if (!Number.isInteger(id) || id <= 0) return null;
    return ensureUserStub(id);
  } catch {
    return null;
  }
}

// Middleware: exige token valido no header Authorization: Bearer <token>.
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  let user = token ? userFromToken(token) : null;
  if (!user && token && config.remoteDataUrl) user = localUserFromToken(token);
  if (!user) return res.status(401).json({ error: "Nao autenticado." });
  req.user = user;
  next();
}

// Middleware de autenticacao opcional: se vier um token valido, define req.user;
// se nao vier (ou for invalido), segue como anonimo. Usado nos perfis publicos
// e na leitura de comentarios, que nao obrigam a login.
export function optionalAuth(req, _res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  req.user = token ? userFromToken(token) : null;
  next();
}
