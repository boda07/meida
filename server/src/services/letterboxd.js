// Integracao com o Letterboxd para FILMES (equivalente ao MyAnimeList no anime).
// O Letterboxd nao tem API publica aberta, por isso usamos:
//  - RSS publico (letterboxd.com/<user>/rss) -> importar o diario (vistos + nota).
//  - Pagina publica do filme -> media da comunidade (JSON-LD aggregateRating).
// A escrita (marcar visto no Letterboxd) precisa da API oficial (ver config).

import { findMovieByTitle } from "./tmdb.js";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Extrai o conteudo da 1a tag <prefix:name> ou <name> de um bloco XML.
function tag(xml, name) {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  if (!m) return null;
  return m[1].replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "").trim();
}

// Importa o diario publico do utilizador (filmes vistos recentemente + nota).
// NOTA: o RSS do Letterboxd so traz a atividade RECENTE (~50 entradas), nao o
// historico completo. Corre periodicamente para ir apanhando o que ves.
export async function importDiary(username) {
  const user = String(username || "").trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
  if (!user) throw httpError(400, "Nome de utilizador do Letterboxd invalido.");

  const res = await fetch(`https://letterboxd.com/${user}/rss/`, {
    headers: { "user-agent": UA, accept: "application/rss+xml,text/xml" },
  });
  if (res.status === 404) throw httpError(404, `Utilizador "${user}" nao encontrado no Letterboxd.`);
  if (!res.ok) throw httpError(502, `Letterboxd RSS ${res.status}`);
  const xml = await res.text();

  const items = [];
  const blocks = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];
  for (const b of blocks) {
    const tmdbId = Number(tag(b, "tmdb:movieId"));
    if (!tmdbId) continue; // ignora listas/entradas sem filme TMDB
    const memberRating = tag(b, "letterboxd:memberRating"); // 0.5-5 (ou ausente)
    const rating10 = memberRating ? Math.round(Number(memberRating) * 2 * 10) / 10 : null;
    // Poster: 1o <img src> da descricao.
    const desc = tag(b, "description") || "";
    const poster = (desc.match(/<img[^>]+src=["']([^"']+)["']/i) || [])[1] || null;
    items.push({
      tmdbId,
      title: tag(b, "letterboxd:filmTitle") || tag(b, "title") || "",
      year: tag(b, "letterboxd:filmYear") || "",
      rating: rating10 && rating10 >= 1 && rating10 <= 10 ? rating10 : null,
      watchedDate: tag(b, "letterboxd:watchedDate") || null, // "YYYY-MM-DD"
      poster,
    });
  }
  // Um filme pode ter varias entradas (rewatch); fica com a 1a (mais recente).
  const seen = new Set();
  return items.filter((i) => (seen.has(i.tmdbId) ? false : seen.add(i.tmdbId)));
}

function decodeEntities(s) {
  return String(s)
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&quot;/g, '"')
    .replace(/&hellip;/g, "...");
}

// Importa TODOS os filmes vistos do utilizador (paginas /films/), com a nota
// pessoal (estrelas -> 0-10). Resolve cada filme para um id do TMDB pela
// pesquisa do TMDB. Substitui o RSS, que so dava os ~50 mais recentes.
export async function importFilms(username, maxPages = 60) {
  const user = String(username || "").trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
  if (!user) throw httpError(400, "Nome de utilizador do Letterboxd invalido.");

  const films = [];
  const seenName = new Set();
  for (let page = 1; page <= maxPages; page++) {
    const url =
      page === 1
        ? `https://letterboxd.com/${user}/films/`
        : `https://letterboxd.com/${user}/films/page/${page}/`;
    const res = await fetch(url, { headers: { "user-agent": UA, accept: "text/html" } });
    if (!res.ok) break;
    const html = await res.text();
    let added = 0;
    // Cada <li> tem data-item-name="Titulo (Ano)" e, se avaliado, "rated-N" (N=0-10).
    for (const li of html.split("</li>")) {
      const raw = (li.match(/data-item-name="([^"]+)"/) || [])[1];
      if (!raw) continue;
      const name = decodeEntities(raw);
      if (seenName.has(name)) continue;
      seenName.add(name);
      const m = name.match(/^(.*?)\s*\((\d{4})\)\s*$/);
      const rated = (li.match(/rated-(\d+)/) || [])[1];
      films.push({
        title: m ? m[1] : name,
        year: m ? m[2] : "",
        rating: rated ? Number(rated) : null,
      });
      added++;
    }
    if (!added) break;
    if (!new RegExp(`/${user}/films/page/${page + 1}/`).test(html)) break; // sem proxima
    await sleep(200);
  }

  const out = [];
  const seen = new Set();
  let i = 0;
  async function worker() {
    while (i < films.length) {
      const f = films[i++];
      const hit = await findMovieByTitle(f.title, f.year);
      if (hit?.tmdbId && !seen.has(hit.tmdbId)) {
        seen.add(hit.tmdbId);
        out.push({ ...hit, rating: f.rating });
      }
    }
  }
  await Promise.all(Array.from({ length: 8 }, worker));
  return out;
}

// Importa a watchlist publica do utilizador. Sem RSS, por isso le as paginas
// HTML (titulo + ano de cada filme) e resolve o id do TMDB pela pesquisa do
// proprio TMDB (mais rapido e fiavel do que abrir cada pagina do Letterboxd).
export async function importWatchlist(username, maxPages = 30) {
  const user = String(username || "").trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
  if (!user) throw httpError(400, "Nome de utilizador do Letterboxd invalido.");

  // 1) Recolhe titulo+ano de cada filme nas paginas da watchlist.
  const films = [];
  const seenName = new Set();
  for (let page = 1; page <= maxPages; page++) {
    const res = await fetch(`https://letterboxd.com/${user}/watchlist/page/${page}/`, {
      headers: { "user-agent": UA, accept: "text/html" },
    });
    if (!res.ok) break;
    const html = await res.text();
    const names = [...html.matchAll(/data-item-name="([^"]+)"/g)].map((m) => m[1]);
    if (!names.length) break;
    for (const raw of names) {
      const name = raw.replace(/&amp;/g, "&").replace(/&#039;/g, "'").replace(/&quot;/g, '"');
      if (seenName.has(name)) continue;
      seenName.add(name);
      const m = name.match(/^(.*?)\s*\((\d{4})\)\s*$/);
      films.push({ title: m ? m[1] : name, year: m ? m[2] : "" });
    }
    if (!/class="next"/.test(html)) break; // ultima pagina
    await sleep(200);
  }

  // 2) Resolve cada filme para um id do TMDB (concorrencia limitada).
  const out = [];
  const seen = new Set();
  let i = 0;
  async function worker() {
    while (i < films.length) {
      const f = films[i++];
      const hit = await findMovieByTitle(f.title, f.year);
      if (hit?.tmdbId && !seen.has(hit.tmdbId)) {
        seen.add(hit.tmdbId);
        out.push(hit);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(8, films.length) }, worker));
  return out;
}

// Media da comunidade (0-10) de um filme, via pagina publica do Letterboxd.
// Best-effort (scraping): null se falhar. Cache em memoria por tmdbId.
const ratingCache = new Map();
export async function getRating(tmdbId) {
  const key = Number(tmdbId);
  if (!key) return null;
  if (ratingCache.has(key)) return ratingCache.get(key);
  let rating = null;
  try {
    // /tmdb/{id} redireciona para a pagina do filme.
    const res = await fetch(`https://letterboxd.com/tmdb/${key}/`, {
      headers: { "user-agent": UA, accept: "text/html" },
      redirect: "follow",
    });
    if (res.ok) {
      const html = await res.text();
      const m = html.match(/"aggregateRating":\s*\{[^}]*?"ratingValue":\s*([\d.]+)/);
      if (m) {
        // ratingValue do Letterboxd e 0-5; normaliza para 0-10.
        const v = Number(m[1]);
        if (v) rating = Math.round(v * 2 * 10) / 10;
      }
    }
  } catch {
    /* ignora */
  }
  ratingCache.set(key, rating);
  return rating;
}

// Media da comunidade para varios filmes, com concorrencia limitada (scraping).
export async function getRatings(tmdbIds, concurrency = 5) {
  const ids = [...new Set(tmdbIds.map(Number).filter(Boolean))];
  const out = new Map();
  let i = 0;
  async function worker() {
    while (i < ids.length) {
      const id = ids[i++];
      out.set(id, await getRating(id));
      await sleep(120); // gentil com o Letterboxd
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, ids.length) }, worker));
  return out;
}

function httpError(s, m) {
  const e = new Error(m);
  e.status = s;
  return e;
}
