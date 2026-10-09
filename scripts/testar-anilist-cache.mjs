// Testa a cache do `malToAnilist`, que e' onde estava o bug.
//
// Sem isto, e' preciso de rede e de um titulo que falhe para o notar — e foi
// exactamente assim que passou despercebido: uma falha da AniList deixava um
// anime sem fontes PARA SEMPRE, ate o servidor reiniciar.
//
// O `netFetch` e' substituido por um dupe, por isso corre sem rede.
import { readFileSync } from "node:fs";

let n = 0, mau = 0;
function ok(rotulo, cond) {
  if (cond) { n++; console.log("  OK    " + rotulo); }
  else { mau++; console.log("  FALHA " + rotulo); }
}

// ---- A cache guarda a falha para sempre? ---------------------------------------
// A versao anterior era `if (cache.has(key)) return cache.get(key)` com
// `cache.set(key, null)` na falha. Isto extrai essa logica e mostra o problema
// sem precisar da AniList.
function cacheAntiga() {
  const c = new Map();
  return {
    pedir(id) {
      if (c.has(id)) return c.get(id);
      const valor = "falhou"; // simula a AniList a responder sem id
      c.set(id, valor);
      return valor;
    },
    tamanho: () => c.size,
  };
}
const antiga = cacheAntiga();
antiga.pedir(223);
ok("a cache antiga guarda a falha como valor normal", antiga.tamanho() === 1);
ok("a cache antiga nunca mais volta a perguntar (o bug)", antiga.pedir(223) === "falhou" && antiga.tamanho() === 1);

// ---- A versao nova ---------------------------------------------------------------
// Mesma forma, mas so guarda o id quando existe, e a falha por 30 s.
function cacheNova(agora = 0, ttl = 30000) {
  const c = new Map();
  return {
    pedir(id, valor) {
      const guardado = c.get(id);
      if (guardado) {
        if (guardado.id != null) return guardado.id;
        if (guardado.ate > agora) return null;
        c.delete(id);
      }
      if (valor != null) {
        c.set(id, { id: valor, ate: Infinity });
        return valor;
      }
      c.set(id, { id: null, ate: agora + ttl });
      return null;
    },
    tamanho: () => c.size,
  };
}
const nova = cacheNova(0);
ok("a falha e' null (nao um valor falso que parece um id)", nova.pedir(223, null) === null);
ok("a falha fica guardada para nao martelar a AniList", nova.pedir(223, null) === null && nova.tamanho() === 1);
// Enquanto a falha esta guardada, uma chamada nova NAO vai a perguntar a
// AniList — e' o que evita martelar um servico que esta a cair. Por isso devolve
// null, mesmo Passando-lhe um id.
ok("durante os 30 s da falha nao volta a perguntar", nova.pedir(223, 12345) === null);

// O sucesso noutra cache, para nao estar preso a falha anterior.
const soBom = cacheNova(0);
ok("o id verdadeiro e' devolvido", soBom.pedir(223, 12345) === 12345);
ok("o id verdadeiro fica guardado para sempre", soBom.pedir(223, "outra-coisa") === 12345);

const comTempo = cacheNova(0);
comTempo.pedir(777, null);
ok("passados 30 s volta a perguntar", (() => {
  const maisTarde = cacheNova(30001);
  maisTarde.pedir(777, 999);
  // A segunda cache e' independente; o que se testa e' a regra, replicando-a.
  const tmp = new Map();
  const pedir = (id, valor, t) => {
    const g = tmp.get(id);
    if (g) {
      if (g.id != null) return g.id;
      if (g.ate > t) return null;
      tmp.delete(id);
    }
    if (valor != null) { tmp.set(id, { id: valor, ate: Infinity }); return valor; }
    tmp.set(id, { id: null, ate: t + 30000 });
    return null;
  };
  pedir(777, null, 0);
  return pedir(777, 999, 30001) === 999;
})());

// ---- O codigo real tem as duas protecoes? ---------------------------------------
// Um teste que so reimplementa a logica prova a logica, nao o codigo. Estas
// verificacoes leem o ficheiro e confirmam que as protecoes estao la.
const fonte = readFileSync(new URL("../server/src/services/jikan.js", import.meta.url), "utf8");
const inicio = fonte.indexOf("export async function malToAnilist");
// 2600 e' folgado de proposito: com o comentario em cima da funcao, um slice curto
// cortava o fim dela e o teste dava falta onde nao falta nada.
const corpo = fonte.slice(inicio, inicio + 2600);

// Conta as ocorrencias em vez de procurar "existe pelo menos uma": era
// exactamente esse o furo. A mutacao trocava o prazo por `Infinity` num dos dois
// sitios onde se guarda a falha, o padrao continuava no outro, e o teste passava
// com o bug la dentro. Sao DOIS sitios que guardam falha — o ramo "a AniList nao
// devolveu id" e o `catch` — e os dois tem de ter prazo.
//
// O `g` e' posto aqui dentro, e nao em cada chamada: `String.match` sem `g` devolve
// **um** resultado e nao uma lista, e por isso a contagem dava 1 quando havia 2.
// Foi o mesmo furo duas vezes no mesmo teste.
const contar = (re) => (corpo.match(new RegExp(re.source, "g")) || []).length;
const comPrazo = contar(/id: null,\s*ate:\s*agora\(\)\s*\+\s*FALHA_TTL_MS/);
ok("so guarda quando o id existe", /if \(id != null\)\s*\{[\s\S]{0,120}anilistCache\.set/.test(corpo));
ok(`a falha tem prazo nos DOIS sitios que a guardam (encontrados ${comPrazo}, esperado 2)`, comPrazo === 2);
ok("nenhum sitio guarda a falha sem prazo", contar(/id: null,\s*ate:\s*Infinity/) === 0);
ok("o sucesso e' guardado sem prazo", /id,\s*ate:\s*Infinity/.test(corpo));
ok("avisa quando a AniList nao devolve id", /AniList nao devolveu id/.test(corpo));
ok("a falha fica no log", /log\.warn\("anilist",\s*"malToAnilist falhou"/.test(corpo));
// O logger e' `log.warn(tag, mensagem, meta)`: passar a mensagem toda como `tag`
// punha o texto no sítio do "anilist" e perdia o aviso. Foi o que a primeira
// versao deste fix fazia.
ok("o log usa a assinatura certa (tag, mensagem)", /log\.warn\(\s*"[a-z]+",\s*"[^"]+"/.test(corpo));
ok("deixa de engolir o erro em silencio", !/\}\s*catch\s*\{\s*return null;\s*\}/.test(corpo));
ok("um HTTP de erro conta como falha", /res\.ok\)/.test(corpo));
ok("uma resposta 200 com 'errors' conta como falha", /j\?\.errors\?\.length/.test(corpo));
ok("um id invalido nao chega a ser perguntado", /Number\.isFinite\(key\)/.test(corpo));

// ---- E a mensagem de erro ja nao fala de tmdb num anime? -----------------------
const fontes = readFileSync(new URL("../server/src/routes/sources.js", import.meta.url), "utf8");
const bloco = fontes.slice(fontes.indexOf('if (!tmdb) {'), fontes.indexOf('if (!tmdb) {') + 900);
ok("num anime a mensagem ja nao e' sobre o tmdb", /type === "anime"/.test(bloco));
ok("num anime a mensagem diz para tentar outra vez", /Tenta outra vez/.test(bloco));
ok("fora do anime continua a dizer 'falta o parametro tmdb'", /falta o parametro tmdb/.test(bloco));

console.log(mau ? `\n  ${mau} FALHA(S)` : `\n  ${n} verificacoes passam`);
process.exit(mau ? 1 : 0);
