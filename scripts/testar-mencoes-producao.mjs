// Testa as @mencoes no SERVIDOR PARTILHADO (FadeHost), que e' onde vivem as
// contas e os comentarios. E' o caminho real: e' para aqui que vao /api/comments,
// /api/auth e /api/users.
//
// Cria duas contas de teste com sufixo aleatorio (para nao chocar com ninguem) e
// apaga-as no fim. Se nao der para apagar, ficam la — duas contas a mais num
// servidor com 3 utilizadores nao e' um problema, mas fica registado.
const BASE = process.env.MEIDA_TESTE_BASE || "https://meida.fadehost.app";

let n = 0, mau = 0;
function ok(rotulo, cond) {
  if (cond) { n++; console.log("  OK    " + rotulo); }
  else { mau++; console.log("  FALHA " + rotulo); }
}

const sufixo = Math.random().toString(36).slice(2, 8);
const auth = (t) => ({ authorization: `Bearer ${t}`, "content-type": "application/json" });
const getJson = async (u, o) => {
  const r = await fetch(`${BASE}${u}`, o);
  return { status: r.status, body: await r.json().catch(() => ({})) };
};

(async () => {
  console.log(`  servidor: ${BASE}`);

  const registar = async (username) => {
    const r = await fetch(`${BASE}/api/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password: "senha12345" }),
    });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  };

  const ana = await registar(`tana${sufixo}`);
  const bento = await registar(`tbento${sufixo}`);
  ok("conta de teste criada no servidor partilhado", ana.status === 200 && Boolean(ana.body.token));
  ok("segunda conta de teste criada", bento.status === 200 && Boolean(bento.body.token));

  // ---- A lista abre logo apos "@" ---------------------------------------------
  const todos = await getJson("/api/users/suggest?q=", { headers: auth(ana.body.token) });
  ok("a rota /api/users/suggest existe no servidor partilhado", todos.status === 200);
  ok("devolve utilizadores", (todos.body.users || []).length > 0);
  ok("devolve tambem 'linked'", Array.isArray(todos.body.linked));

  const filtrada = await getJson(`/api/users/suggest?q=${ana.body.user.username}`, {
    headers: auth(ana.body.token),
  });
  ok("filtra pelo nome escrito",
    (filtrada.body.users || []).some((u) => u.username === ana.body.user.username));

  // ---- Quem segue sobe ----------------------------------------------------------
  await getJson(`/api/users/${bento.body.user.id}/follow`, {
    method: "POST",
    headers: auth(ana.body.token),
  });
  const comLigacao = await getJson("/api/users/suggest?q=", { headers: auth(ana.body.token) });
  const ligados = (comLigacao.body.linked || []).map(Number);
  ok("quem se segue e' marcado como ligado", ligados.includes(Number(bento.body.user.id)));
  const ids = (comLigacao.body.users || []).map((u) => Number(u.id));
  const ultimoLigado = ids.map((id, i) => (ligados.includes(id) ? i : -1)).filter((i) => i >= 0).pop();
  const primeiroSolto = ids.findIndex((id) => !ligados.includes(id));
  ok("quem tem ligacao vem antes de quem nao tem", primeiroSolto === -1 || ultimoLigado < primeiroSolto);

  // ---- A mencao notifica ---------------------------------------------------------
  const tmdbId = 16023 + Math.floor(Math.random() * 900);
  const onde = { type: "movie", tmdbId };

  const comMencao = await getJson("/api/comments", {
    method: "POST",
    headers: auth(bento.body.token),
    body: JSON.stringify({
      ...onde,
      body: `olá @${ana.body.user.username} tens de ver isto @${ana.body.user.username}`,
    }),
  });
  ok("comentario com mencao aceite no servidor partilhado", comMencao.status === 200);
  ok("o texto fica tal e qual", (comMencao.body.comment?.body || "").includes(`@${ana.body.user.username}`));

  await new Promise((r) => setTimeout(r, 500));
  const sino = await getJson("/api/notifications", { headers: auth(ana.body.token) });
  const items = sino.body.items || [];
  const mentions = items.filter((x) => x.kind === "mention");
  ok("quem foi mencionado recebe 'mention' no servidor partilhado", mentions.length >= 1);
  ok("tres '@fulano' no mesmo comentario dao UMA notificacao", mentions.length === 1);
  ok("a notificacao aponta para o comentario certo",
    mentions.length === 1 && mentions[0].refId === comMencao.body.comment?.id);

  // ---- Email nao notifica -------------------------------------------------------
  const email = await getJson("/api/comments", {
    method: "POST",
    headers: auth(bento.body.token),
    body: JSON.stringify({ ...onde, body: `manda para a@b.com ${Date.now()}` }),
  });
  ok("comentario com email aceite", email.status === 200);
  await new Promise((r) => setTimeout(r, 400));
  const sino2 = await getJson("/api/notifications", { headers: auth(ana.body.token) });
  ok("'a@b.com' nao gera notificacao",
    !(sino2.body.items || []).some((x) => x.kind === "mention" && x.refId === email.body.comment?.id));

  console.log(`\n  contas de teste criadas: ${ana.body.user.username}, ${bento.body.user.username}`);
  console.log(mau ? `\n  ${mau} FALHA(S)` : `\n  ${n} verificacoes passam`);
  process.exit(mau ? 1 : 0);
})().catch((e) => {
  console.log("  ERRO: " + (e?.message || e));
  process.exit(1);
});
