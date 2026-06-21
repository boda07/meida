import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "../db.js";
import { config } from "../config.js";

const insertUser = db.prepare(
  "INSERT INTO users (username, password_hash) VALUES (?, ?)"
);
const findByUsername = db.prepare("SELECT * FROM users WHERE username = ?");
const findById = db.prepare("SELECT id, username, avatar FROM users WHERE id = ?");
const updateAvatar = db.prepare("UPDATE users SET avatar = ? WHERE id = ?");

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
  if (findByUsername.get(username)) throw httpError(409, "Esse utilizador ja existe.");

  const hash = bcrypt.hashSync(password, 10);
  const info = insertUser.run(username, hash);
  const user = { id: info.lastInsertRowid, username, avatar: null };
  return { token: signToken(user), user };
}

export function login(username, password) {
  username = String(username || "").trim();
  const row = findByUsername.get(username);
  if (!row || !bcrypt.compareSync(String(password || ""), row.password_hash)) {
    throw httpError(401, "Utilizador ou password invalidos.");
  }
  const user = { id: row.id, username: row.username, avatar: row.avatar || null };
  return { token: signToken(user), user };
}

// Atualiza o avatar (emoji predefinido tipo "emoji:🦊" ou URL http(s) de imagem).
export function setAvatar(userId, avatar) {
  const value = String(avatar || "").trim().slice(0, 500) || null;
  if (value && value.length > 4 && !/^(emoji:|https?:\/\/)/i.test(value)) {
    throw httpError(400, "Avatar invalido (usa um predefinido ou um URL de imagem).");
  }
  updateAvatar.run(value, userId);
  return findById.get(userId);
}

export function userFromToken(token) {
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    return findById.get(payload.id) || null;
  } catch {
    return null;
  }
}

function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

// Middleware: exige token valido no header Authorization: Bearer <token>.
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  const user = token ? userFromToken(token) : null;
  if (!user) return res.status(401).json({ error: "Nao autenticado." });
  req.user = user;
  next();
}
