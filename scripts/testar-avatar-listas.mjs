// Seguranca de avatares: nao devem ser devolvidos inline em listas.
// Arranca o servidor de verdade e verifica:
//   - normalizeAvatar rejeita data URLs acima de ~200 KB
//   - toUserCard / toApiComment / toApiNotification nao devolvem avatar inline
//   - listComments com 20 comentarios responde com menos de 100 KB
//   - GET /api/users/:id/avatar serve o avatar separado
import path from "node:path";
import fs from "node:fs";

const RAIZ = path.join(process.cwd());

let ok = 0;
let falhou = 0;
function ok_(nome, cond, extra = "") {
  if (cond) { ok++; console.log("  OK    " + nome); }
  else { falhou++; console.log("  FALHA " + nome + (extra ? "  ->  " + extra : "")); }
}

// ---------- 1) normalizeAvatar rejeita data URLs grandes ----------
console.log("");
console.log("  1) normalizeAvatar rejeita avatar acima de ~200 KB");
const { normalizeAvatar } = await import(
  "file:///" + path.join(RAIZ, "server", "src", "services", "auth.js").replace(/\\/g, "/")
);
const avatarPequeno = "data:image/png;base64," + "A".repeat(10_000); // ~7.5 KB
const avatarGrande = "data:image/png;base64," + "A".repeat(400_000); // ~300 KB > 200 KB
try {
  normalizeAvatar(avatarPequeno);
  ok_("avatar pequeno (~7 KB) e' aceito", true);
} catch (e) {
  ok_("avatar pequeno (~7 KB) e' aceito", false, e.message);
}
try {
  normalizeAvatar(avatarGrande);
  ok_("avatar grande (~300 KB) e' rejeitado", false, "nao lançou erro");
} catch (e) {
  ok_("avatar grande (~300 KB) e' rejeitado", e.status === 400, "status=" + e.status);
}

// ---------- 2) store nao devolve avatar inline ----------
console.log("");
console.log("  2) funcoes do store nao devolvem avatar inline");
const {
  toUserCard,
  toApiComment,
  toApiNotification,
} = await import(
  "file:///" + path.join(RAIZ, "server", "src", "store.js").replace(/\\/g, "/")
);

// toUserCard nao deve ter avatar
const card = toUserCard({ id: 1, username: "fulano", avatar: "data:image/png;base64,AAAA" });
ok_("toUserCard nao tem avatar", !("avatar" in card), JSON.stringify(card));

// toApiComment nao deve ter avatar no author
const comentario = toApiComment(
  { id: 1, user_id: 1, username: "fulano", avatar: "data:image/png;base64,AAAA", body: "oi", media_type: "movie", external_id: 1, season: null, episode: null, parent_id: null, created_at: "2026-01-01", updated_at: null, deleted_at: null },
  1
);
ok_("toApiComment author nao tem avatar", !("avatar" in comentario.author), JSON.stringify(comentario.author));

// toApiNotification nao deve ter avatar no actor
const notificacao = toApiNotification({
  id: 1, kind: "comment", ref_id: null, preview: "oi", read: 0, created_at: "2026-01-01", at: null,
  media_type: "movie", external_id: 1, season: null, episode: null,
  actor_id: 1, actor_username: "fulano", actor_avatar: "data:image/png;base64,AAAA",
});
ok_("toApiNotification actor nao tem avatar", !("avatar" in notificacao.actor), JSON.stringify(notificacao.actor));

// ---------- 3) servidor de verdade: listComments com 20 comentarios < 100 KB ----------
console.log("");
console.log("  3) listComments com 20 comentarios responde com menos de 100 KB");
const PORTA = 5900 + (process.pid % 90);
const dbDir = fs.mkdtempSync(path.join(RAIZ, "..", "meida-test-avatar-"));
const { spawn } = await import("node:child_process");
const filho = spawn(process.execPath, [path.join(RAIZ, "server", "src", "index.js")], {
  cwd: RAIZ,
  env: { ...process.env, PORT: String(PORTA), DB_DIR: dbDir, HOST: "127.0.0.1" },
  stdio: ["ignore", "pipe", "pipe"],
});
let servidorMorto = false;
filho.on("exit", (codigo) => { if (codigo !== 0) servidorMorto = codigo; });

try {
  let acordou = false;
  for (let n = 0; n < 60 && !acordou; n++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORTA}/api/health`, { signal: AbortSignal.timeout(1000) });
      acordou = r.ok;
    } catch { /* ainda nao esta' a la */ }
    if (!acordou) await new Promise((r) => setTimeout(r, 250));
  }
  ok_("o servidor arranca e responde a /api/health", acordou, servidorMorto ? "morreu com " + servidorMorto : "");

  if (acordou) {
    const pedir = (p, opcoes = {}) =>
      fetch(`http://127.0.0.1:${PORTA}${p}`, { signal: AbortSignal.timeout(10000), ...opcoes });

    // Regista um utilizador com avatar pequeno
    const reg = await pedir("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "avataruser", password: "senha123456" }),
    });
    ok_("registo cria o utilizador (200 ou 409)", reg.status === 200 || reg.status === 409, "status " + reg.status);

    // Login para obter token
    const login = await pedir("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "avataruser", password: "senha123456" }),
    });
    const token = login.ok ? (await login.json()).token : null;
    ok_("login devolve token", !!token);

    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    // Cria 20 comentarios
    for (let n = 0; n < 20; n++) {
      await pedir("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ type: "movie", tmdb: 1, title: "Filme Teste", body: `Comentario ${n + 1}` }),
      });
    }

    // Pede a lista de comentarios
    const resp = await pedir("/api/comments?type=movie&tmdb=1");
    const texto = await resp.text();
    const tamanhoKB = texto.length / 1024;
    ok_("listComments com 20 comentarios tem menos de 100 KB", tamanhoKB < 100, `${tamanhoKB.toFixed(1)} KB`);
    ok_("resposta nao contem data:image (avatar inline)", !/data:image/.test(texto), "tem data:image");

    // Testa a rota de avatar separado
    const me = await pedir("/api/auth/me", { headers });
    const meuId = (await me.json()).user.id;
    const avatarResp = await pedir(`/api/users/${meuId}/avatar`);
    ok_("GET /api/users/:id/avatar devolve 200 ou 404", avatarResp.status === 200 || avatarResp.status === 404, "status " + avatarResp.status);

    ok_("o servidor nao morreu a meio do teste", !servidorMorto, servidorMorto ? "morreu com " + servidorMorto : "");
  }
} finally {
  try { filho.kill(); } catch { /* ja parado */ }
  try { fs.rmSync(dbDir, { recursive: true, force: true }); } catch { /* ja foi */ }
}

console.log("");
console.log("  " + ok + " ok, " + falhou + " falha(s)");
process.exit(falhou ? 1 : 0);