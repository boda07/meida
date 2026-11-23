// Episodios de anime: a lista real (titulos, datas, filler/recap) e a
// sintese por numero quando a API nao a tem.
import { BACKUP_URL, jikanFetch, jikanFetchBase, sleep } from "./fetch.js";

// Agrupa episodios em "temporadas" (cours). O Jikan nao diz a que temporada
// cada episodio pertence, mas os animes de TV japonesa saem em cours de ~12-13
// episodios: quebramos a cada 13, e mais cedo se houver uma pausa longa (>=60
// dias) no meio (split-cour). Sem datas, cai nos blocos de 13.
export function groupEpisodesBySeason(episodes) {
  const DAY = 24 * 60 * 60 * 1000;
  const COUR_SIZE = 13;
  const seasons = [];
  let cur = [];
  const pushCur = () => {
    if (!cur.length) return;
    seasons.push({
      seasonNumber: seasons.length + 1,
      label: `Temporada ${seasons.length + 1}`,
      episodes: cur,
    });
    cur = [];
  };
  for (const ep of episodes) {
    const last = cur[cur.length - 1];
    const gapLong =
      last?.aired && ep.aired && ep.aired - last.aired >= 60 * DAY;
    if (cur.length >= COUR_SIZE || (cur.length >= 10 && gapLong)) pushCur();
    cur.push(ep);
  }
  pushCur();
  if (!seasons.length) {
    return [{ seasonNumber: 1, label: "Temporada 1", episodes: [] }];
  }
  return seasons;
}

// Normaliza as linhas cruas de /anime/{id}/episodes para a lista interna.
//
// O Jikan oficial devolve o numero em `episode` e um `mal_id` por episodio. O
// espelho Tenrai NAO devolve nenhum dos dois (so `title` + `aired`) — era
// exatamente por isso que o filtro antigo `(e.episode ?? e.mal_id) != null`
// descartava TODOS os episodios e a anime aparecia sem nenhum. Quando nao ha
// numero em lado nenhum, usa a posicao na lista (1-based): a API devolve os
// episodios por ordem, por isso a posicao e o numero. Funcao pura para poder
// ser testada sem rede.
export function normalizarEpisodios(rows) {
  return (Array.isArray(rows) ? rows : [])
    .filter((e) => {
      if (!e || typeof e !== "object") return false;
      // Um titulo so com espacos nao e' um titulo: sem numero e' lixo da API.
      const titulo = typeof e.title === "string" ? e.title.trim() : "";
      return titulo !== "" || e.episode != null || e.mal_id != null;
    })
    .sort((a, b) => (a.episode ?? a.mal_id ?? 0) - (b.episode ?? b.mal_id ?? 0))
    .map((e, index) => {
      const num = e.episode ?? e.mal_id ?? index + 1;
      return {
        episodeNumber: num,
        name: e.title?.trim() ? e.title : `Episódio ${num}`,
        aired: e.aired ? new Date(e.aired).getTime() || null : null,
        filler: Boolean(e.filler),
        recap: Boolean(e.recap),
      };
    });
}

// Ultimo recurso para animes sem lista de episodios na API: o /anime/{id}/full
// sabe QUANTOS episodios existem (o `episodes: 13` do Zan Sayonara Zetsubou
// Sensei), mesmo quando o /episodes volta vazio. So o numero interessa para
// montar os botoes — os providers resolvem o episodio pelo numero, nao pelo
// titulo. Nao usado quando a API traz a lista real.
export function episodiosPorNumero(total) {
  const n = Number(total);
  if (!Number.isFinite(n) || n <= 0) return [];
  return Array.from({ length: Math.floor(n) }, (_, i) => ({
    episodeNumber: i + 1,
    name: `Episódio ${i + 1}`,
    aired: null,
    filler: false,
    recap: false,
  }));
}

// Ultimo recurso para animes sem lista de episodios na API: o /anime/{id}/full
// sabe QUANTOS episodios existem, mesmo quando o /episodes volta vazio (o
// espelho Tenrai tem a base incompleta para alguns titulos). So o numero
// interessa para montar os botoes — os providers resolvem o episodio pelo
// numero, nao pelo titulo. So e' usado quando a lista real vem vazia.
async function numEpisodiosDoFull(malId) {
  try {
    const d = await jikanFetch(`/anime/${malId}`);
    const n = Number(d?.data?.episodes) || 0;
    return n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

// Episodios reais de um anime (titulos, datas, filler/recap) via
// /anime/{id}/episodes, paginado (100 por pagina). Agrupa por temporada.
// Tolerante: se uma pagina falhar, usa o que ja tem (e a cache em disco do
// jikanFetch torna as visitas seguintes instantaneas).
export async function getAnimeEpisodes(malId) {
  // Tenta o primario (Tenrai) primeiro.
  let first;
  try {
    first = await jikanFetch(`/anime/${malId}/episodes`);
  } catch {
    first = null;
  }
  // O espelho Tenrai devolve HTTP 200 com `data: []` para animes que nao tem na
  // base dele (ex.: Zan Sayonara Zetsubou Sensei, ID 6377). Sem isto o jikanFetch
  // nao caia para o backup porque nao houve erro de rede — e o anime ficava sem
  // episodios. Com `!first` volta a ser o mesmo caso: tenta-se o backup.
  if (!first || !first?.data?.length) {
    try {
      first = await jikanFetchBase(BACKUP_URL, `/anime/${malId}/episodes`);
    } catch {
      first = null;
    }
  }
  const pages = [];
  if (first?.data?.length) {
    pages.push(first);
    const last = Math.min(
      first?.pagination?.last_visible_page || 1,
      // teto: animes com 1200+ eps (ex.: One Piece) — busca tudo.
      12
    );
    for (let p = 2; p <= last; p++) {
      await sleep(350); // respeita o rate limit do Jikan
      try {
        pages.push(await jikanFetch(`/anime/${malId}/episodes?page=${p}`));
      } catch {
        break; // parciais chegam (melhor que nada)
      }
    }
  }
  const episodes = normalizarEpisodios(pages.flatMap((d) => d?.data || []));
  // Nenhuma fonte devolveu a lista. Em vez de mostrar "Temporada 1 (0 eps)",
  // usa o total que o /anime/{id} conhece e sintetiza os numeros: assim o anime
  // fica com os botoes de episodio certainos e o player resolve pela fonte.
  const list = episodes.length
    ? episodes
    : episodiosPorNumero(await numEpisodiosDoFull(malId));
  return groupEpisodesBySeason(list);
}