// Teste de fumo das @mencoes, com o servidor a correr a serio.
//
// Os testes de `scripts/testar-mencoes.mjs` provam a logica. Este prova o resto:
// que a rota responde, que a lista traz quem tem ligacao connosco em cima, e que
// um "@fulano" num comentario chega a notificar essa pessoa — e nao a notificar a
// si proprio, nem a duplicar.
//
// Nao entra no `npm test` porque precisa de um servidor a correr. Corre-se com
// `node scripts/testar-mencoes-fumo.mjs` enquanto `npm run dev:server` estiver no
// ar. Sem servidor, salta com aviso em vez de falhar.
const BASE = process.env.MEIDA_TESTE_BASE || "http://127.0.0.1:5175";

let n = 0, mau = 0;
function ok(rotulo, cond) {
  if (cond) { n++; console.log("  OK    " + rotulo); }
  else { mau++; console.log("  FALHA " + rotulo); }
}

async function health() {
  try {
    const r = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(4000) });
    return r.ok;
  } catch {
    return false;
  }
}

function nomeUnico(base) {
  return `${base}${Math.random().toString(36).slice(2, 8)}`;
}

async function registar(username, password) {
  const r = await fetch(`${BASE}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.token) throw new Error(`registo falhou: ${r.status} ${JSON.stringify(d)}`);
  return { token: d.token, user: d.user };
}

const auth = (t) => ({ authorization: `Bearer ${t}`, "content-type": "application/json" });
const getJson = async (u, o) => {
  const r = await fetch(`${BASE}${u}`, o);
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
// A rota responde `{ items, unread }` — `items`, nao `notifications`.
const tipos = (d) => (d.body.items || []).map((x) => x.kind);

(async () => {
  if (!(await health())) {
    console.log(`  (servidor nao responde em ${BASE} — a correr o teste de fumo)`);
    process.exit(0);
  }

  const ana = await registar(nomeUnico("ana"), "senha12345");
  const bento = await registar(nomeUnico("bento"), "senha12345");
  const tmdbId = 16023 + Math.floor(Math.random() * 1000);
  const onde = { type: "movie", tmdbId };

  // ---- 1) A lista abre mesmo sem escrever nada ----------------------------------
  // E' o caso logo apos "@": com `searchUsers("")` a lista vinha vazia e a pessoa
  // via que o "@ nao fazia nada.
  const todos = await getJson("/api/users/suggest?q=", { headers: auth(ana.token) });
  ok("a lista sem query responde 200", todos.status === 200);
  ok("a lista sem query traz alguem", (todos.body.users || []).length > 0);
  ok("devolve tambem quem tem ligacao", Array.isArray(todos.body.linked));

  // ---- 2) Filtra pelo que se escreve ---------------------------------------------
  const filtrada = await getJson(`/api/users/suggest?q=${ana.user.username}`, { headers: auth(ana.token) });
  ok("filtra pelo nome escrito", (filtrada.body.users || []).some((u) => u.username === ana.user.username));
  ok("a filtrada traz so o que corresponde",
    (filtrada.body.users || []).every((u) => u.username.includes(ana.user.username)));

  // ---- 3) Quem e' seguido sobe para o topo ---------------------------------------
  await getJson(`/api/users/${bento.user.id}/follow`, { method: "POST", headers: auth(ana.token) });
  const comLigacao = await getJson("/api/users/suggest?q=", { headers: auth(ana.token) });
  const nomes = (comLigacao.body.users || []).map((u) => u.username);
  const ligados = (comLigacao.body.linked || []).map(Number);
  ok("quem se segue aparece na lista", nomes.includes(bento.user.username));
  ok("quem se segue e' marcado como ligado", ligados.includes(Number(bento.user.id)));
  ok("quem tem ligacao connosco vem antes de quem nao tem", (() => {
    if (ligados.length === 0) return false;
    const ids = comLigacao.body.users.map((u) => Number(u.id));
    const ultimoLigado = ids.map((id, i) => (ligados.includes(id) ? i : -1)).filter((i) => i >= 0).pop();
    const primeiroSolto = ids.findIndex((id) => !ligados.includes(id));
    return primeiroSolto === -1 || ultimoLigado < primeiroSolto;
  })());

  // ---- 4) Um "@fulano" no comentario notifica essa pessoa ------------------------
  const semMencao = await getJson("/api/comments", {
    method: "POST",
    headers: auth(ana.token),
    body: JSON.stringify({ ...onde, body: `comentario sem mencao ${Date.now()}` }),
  });
  ok("comentario sem mencao e' aceite", semMencao.status === 200);

  const comMencao = await getJson("/api/comments", {
    method: "POST",
    headers: auth(bento.token),
    body: JSON.stringify({ ...onde, body: `olá @${ana.user.username}, viste isto? ${Date.now()}` }),
  });
  ok("comentario com mencao e' aceite", comMencao.status === 200);
  ok("o texto da mencao fica tal e qual (com o '@' e o username)",
    (comMencao.body.comment?.body || "").includes(`@${ana.user.username}`));

  await new Promise((r) => setTimeout(r, 250));
  const sinoAna = await getJson("/api/notifications", { headers: auth(ana.token) });
  const sinoBento = await getJson("/api/notifications", { headers: auth(bento.token) });
  ok("quem foi mencionado recebe notificacao do tipo 'mention'", tipos(sinoAna).includes("mention"));
  ok("quem nao foi mencionado nao recebe", !tipos(sinoBento).includes("mention"));

  // ---- 5) Nunca notificar-se a si proprio ----------------------------------------
  const proprio = await getJson("/api/comments", {
    method: "POST",
    headers: auth(ana.token),
    body: JSON.stringify({ ...onde, body: `nota para mim @${ana.user.username} ${Date.now()}` }),
  });
  ok("mencao a si proprio e' aceite (o comentario cria-se na mesma)", proprio.status === 200);
  await new Promise((r) => setTimeout(r, 250));
  const sino2 = await getJson("/api/notifications", { headers: auth(ana.token) });
  ok("nao ha notificacao de mencao a si proprio",
    !(sino2.body.items || []).some((x) => x.kind === "mention" && x.actor?.id === ana.user.id));

  // ---- 6) Nao duplica ---------------------------------------------------------------
  const repetido = await getJson("/api/comments", {
    method: "POST",
    headers: auth(bento.token),
    body: JSON.stringify({
      ...onde,
      body: `@${ana.user.username} @${ana.user.username} @${ana.user.username} socorro ${Date.now()}`,
    }),
  });
  ok("tres mencoes a mesma pessoa no mesmo comentario", repetido.status === 200);
  await new Promise((r) => setTimeout(r, 250));
  const sino3 = await getJson("/api/notifications", { headers: auth(ana.token) });
  const doBento = (sino3.body.items || []).filter(
    (x) => x.kind === "mention" && x.actor?.id === bento.user.id && x.refId === repetido.body.comment?.id
  );
  ok("tres '@fulano' no mesmo comentario dao UMA notificacao", doBento.length === 1);

  // ---- 7) Email nao notifica --------------------------------------------------------
  const email = await getJson("/api/comments", {
    method: "POST",
    headers: auth(bento.token),
    body: JSON.stringify({ ...onde, body: `manda para a@b.com sobre isto ${Date.now()}` }),
  });
  ok("comentario com email e' aceite", email.status === 200);
  await new Promise((r) => setTimeout(r, 250));
  const sino4 = await getJson("/api/notifications", { headers: auth(ana.token) });
  ok("'a@b.com' nao gera notificacao para ninguem",
    !(sino4.body.items || []).some((x) => x.kind === "mention" && x.refId === email.body.comment?.id));

  console.log(mau ? `\n  ${mau} FALHA(S)` : `\n  ${n} verificacoes passam`);
  process.exit(mau ? 1 : 0);
})().catch((e) => {
  console.log("  ERRO: " + (e?.message || e));
  process.exit(1);
});
