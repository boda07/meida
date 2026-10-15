// As metas e os desafios da pagina /achievements.
//
// Fica numa rota a parte e nao dentro de `/achievements` por uma razao concreta:
// `/achievements` devolve um payload fixo (badges + racha) que ja tem consumidores,
// e meter o alvo la dentro obrigaria a mexer no formato. Aqui e' GET + PUT do
// alvo, e o resto sai da mesma biblioteca.
//
// O que a rota NAO faz e' inventar datas. Ver `metas.js`: a biblioteca nao tem
// "data em que viste", so `updated_at`. Tudo o que sai daqui respeita isso.
import { Router } from "express";
import { requireAuth } from "../services/auth.js";
import { listLibrary, getMeta, setMeta } from "../store.js";
import { ALVO_OMISSAO, contaFilmesPorAno, contaDecadas } from "../metas.js";

export const goalsRouter = Router();
goalsRouter.use(requireAuth);

/** O que a pessoa pode escolher como alvo. Fecha a lista de propositos. */
const ALVOS = [10, 25, 50, 100, 200, 365];

function alvoAtual(userId) {
  const guardado = Number(getMeta(userId).alvoFilmes);
  // Um alvo fora da lista (um teste antigo, uma base importada) cai no
  // omissao em vez de aparecer no anel como "0 de 73".
  return ALVOS.includes(guardado) ? guardado : ALVO_OMISSAO;
}

goalsRouter.get("/goals", (req, res) => {
  const linhas = listLibrary(req.user.id);
  const anoAgora = new Date().getUTCFullYear();
  res.json({
    alvo: alvoAtual(req.user.id),
    alvos: ALVOS,
    // A contagem vem por ano e o cliente escolhe o dele: o servidor pode estar
    // em UTC e a virada do ano nao pode ser decideda aqui (ver `metas.js`).
    filmesPorAno: contaFilmesPorAno(linhas, anoAgora),
    decadas: contaDecadas(linhas, anoAgora),
    totalVistos: linhas.filter((l) => l.watched === 1 && l.type === "movie").length,
  });
});

// **PATCH e nao PUT, e nao por acaso.** O `patch_` de `web/src/api/client.js`
// manda PATCH, e `updateProfile` ja usa o mesmo para `/api/auth/profile`:
// mudar o alvo e' uma actualizacao parcial do `meta`, nao substituir o recurso.
// Com PUT aqui o servidor respondia 404, o `handle()` do cliente rebentava e a
// seccao das metas desaparecia sem dizer nada. Aconteceu na primeira versao,
// medido no browser a 2026-10-14.
goalsRouter.patch("/goals", (req, res) => {
  const alvo = Number(req.body?.alvo);
  if (!ALVOS.includes(alvo)) {
    return res.status(400).json({ error: "alvo invalido", alvos: ALVOS });
  }
  setMeta(req.user.id, { alvoFilmes: alvo });
  return res.json({ alvo });
});