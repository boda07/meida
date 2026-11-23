// Generos: os do TMDB (traduzidos pela propria API) e os do MyAnimeList, que o
// TMDB nao tem ou nomeia de outra maneira.
import { LANG_MAP, tmdbFetch } from "./base.js";

// Lista de generos (TMDB) por tipo e idioma, para o "Escolhe algo para mim".
// O TMDB devolve os nomes ja traduzidos no idioma pedido. Cache por tipo+idioma.
const genreCache = {};

export async function getGenres(type, lang) {
  if (type !== "movie" && type !== "tv") throw new Error("type invalido");
  const target = LANG_MAP[lang] || (String(lang || "").includes("-") ? lang : "en-US");
  const key = `${type}:${target}`;
  if (genreCache[key]) return genreCache[key];
  const data = await tmdbFetch(`/genre/${type}/list`, {}, target);
  const list = (data.genres || []).map((g) => ({ id: g.id, name: g.name }));
  genreCache[key] = list;
  return list;
}

// Generos/temas de anime (MAL/Jikan) que o TMDB nao tem (ou nomeia diferente).
// Traducao manual para PT; os generos normais sao traduzidos pelo TMDB.
const ANIME_GENRES_PT = {
  // Generos principais
  Action: "Ação",
  Adventure: "Aventura",
  Comedy: "Comédia",
  Drama: "Drama",
  Fantasy: "Fantasia",
  Horror: "Terror",
  Mystery: "Mistério",
  Romance: "Romance",
  "Sci-Fi": "Ficção científica",
  "Slice of Life": "Quotidiano",
  Supernatural: "Sobrenatural",
  Sports: "Desporto",
  Suspense: "Suspense",
  "Award Winning": "Premiado",
  "Avant Garde": "Vanguarda",
  Gourmet: "Gastronomia",
  "Boys Love": "Amor entre rapazes",
  "Girls Love": "Amor entre raparigas",
  Erotica: "Erótico",
  // Temas
  Ecchi: "Ecchi",
  "Martial Arts": "Artes marciais",
  Military: "Militar",
  Mythology: "Mitologia",
  Psychological: "Psicológico",
  School: "Escolar",
  Space: "Espaço",
  "Super Power": "Superpoderes",
  Survival: "Sobrevivência",
  "Time Travel": "Viagem no tempo",
  Vampire: "Vampiros",
  Historical: "Histórico",
  Harem: "Harém",
  "Reverse Harem": "Harém invertido",
  Mecha: "Mecha",
  Isekai: "Isekai",
  Parody: "Paródia",
  Samurai: "Samurai",
  Detective: "Detetive",
  Gore: "Gore",
  Reincarnation: "Reencarnação",
  Music: "Música",
  "Adult Cast": "Elenco adulto",
  Anthropomorphic: "Antropomórfico",
  Childcare: "Cuidar de crianças",
  "Combat Sports": "Desportos de combate",
  Crossdressing: "Travestismo",
  Delinquents: "Delinquentes",
  Educational: "Educativo",
  "Gag Humor": "Humor absurdo",
  "High Stakes Game": "Jogo de alto risco",
  "Idols (Female)": "Idols (femininas)",
  "Idols (Male)": "Idols (masculinos)",
  "Love Polygon": "Polígono amoroso",
  "Love Status Quo": "Status quo amoroso",
  "Romantic Subtext": "Subtexto romântico",
  "Magical Sex Shift": "Troca de sexo mágica",
  "Mahou Shoujo": "Rapariga mágica",
  Medical: "Medicina",
  "Organized Crime": "Crime organizado",
  "Otaku Culture": "Cultura otaku",
  "Performing Arts": "Artes do espetáculo",
  Pets: "Animais de estimação",
  Racing: "Corridas",
  Showbiz: "Mundo do espetáculo",
  "Strategy Game": "Jogo de estratégia",
  "Team Sports": "Desportos de equipa",
  "Video Game": "Videojogos",
  "Visual Arts": "Artes visuais",
  Workplace: "Trabalho",
  Kids: "Infantil",
};

// Lista completa de generos/temas/demografias do MyAnimeList (em ingles). Usada
// para validar os generos guardados (so estes + os do TMDB sao mostrados).
const MAL_GENRES = [
  "Action", "Adventure", "Avant Garde", "Award Winning", "Boys Love", "Comedy",
  "Drama", "Fantasy", "Girls Love", "Gourmet", "Horror", "Mystery", "Romance",
  "Sci-Fi", "Slice of Life", "Sports", "Supernatural", "Suspense", "Ecchi",
  "Erotica", "Hentai", "Adult Cast", "Anthropomorphic", "CGDCT", "Childcare",
  "Combat Sports", "Crossdressing", "Delinquents", "Detective", "Educational",
  "Gag Humor", "Gore", "Harem", "High Stakes Game", "Historical", "Idols (Female)",
  "Idols (Male)", "Isekai", "Iyashikei", "Love Polygon", "Love Status Quo",
  "Magical Sex Shift", "Mahou Shoujo", "Martial Arts", "Mecha", "Medical",
  "Military", "Music", "Mythology", "Organized Crime", "Otaku Culture", "Parody",
  "Performing Arts", "Pets", "Psychological", "Racing", "Reincarnation",
  "Reverse Harem", "Romantic Subtext", "Samurai", "School", "Showbiz", "Space",
  "Strategy Game", "Super Power", "Survival", "Team Sports", "Time Travel",
  "Vampire", "Video Game", "Visual Arts", "Workplace", "Josei", "Kids", "Seinen",
  "Shoujo", "Shounen",
];

// Cache do vocabulario de generos (lower(nome) -> nome canonico no idioma), por idioma.
const genreVocabCache = {};

/**
 * Vocabulario de generos validos no idioma pedido: Map(nome em minusculas ->
 * nome canonico para mostrar). Junta os generos do TMDB (filme+serie, EN+alvo)
 * com a lista do MAL. Serve para validar (descartar lixo guardado, ex.: titulos),
 * corrigir maiusculas e traduzir, tudo de uma vez.
 */
export async function getGenreVocab(lang) {
  const target = LANG_MAP[lang] || (String(lang || "").includes("-") ? lang : "en-US");
  if (genreVocabCache[target]) return genreVocabCache[target];
  try {
    const reqs = [
      tmdbFetch("/genre/movie/list", {}, "en-US"),
      tmdbFetch("/genre/tv/list", {}, "en-US"),
    ];
    if (target !== "en-US") {
      reqs.push(tmdbFetch("/genre/movie/list", {}, target), tmdbFetch("/genre/tv/list", {}, target));
    }
    const [me, mt, le, lt] = await Promise.all(reqs);
    const vocab = new Map();
    const add = (display, ...aliases) => {
      for (const a of [display, ...aliases]) if (a) vocab.set(a.toLowerCase(), display);
    };
    const pair = (enList, locList) => {
      const loc = locList ? new Map((locList.genres || []).map((g) => [g.id, g.name])) : null;
      for (const g of enList.genres || []) {
        const display = (loc && loc.get(g.id)) || g.name;
        add(display, g.name);
      }
    };
    pair(me, le);
    pair(mt, lt);
    const pt = target.startsWith("pt");
    for (const g of MAL_GENRES) add(pt && ANIME_GENRES_PT[g] ? ANIME_GENRES_PT[g] : g, g);
    genreVocabCache[target] = vocab;
    return vocab;
  } catch {
    return null;
  }
}

// Cache do mapa de traducao de generos (en -> idioma alvo), por idioma.
const genreMapCache = {};

/**
 * Devolve Map(nomeEN -> nome localizado) juntando os generos de filme e serie do
 * TMDB (+ traducao manual dos de anime). null se o idioma alvo for ingles.
 */
export async function getGenreMap(lang) {
  const target = LANG_MAP[lang] || (String(lang || "").includes("-") ? lang : null);
  if (!target || target === "en-US") return null;
  if (genreMapCache[target]) return genreMapCache[target];
  try {
    const [me, mt, le, lt] = await Promise.all([
      tmdbFetch("/genre/movie/list", {}, "en-US"),
      tmdbFetch("/genre/tv/list", {}, "en-US"),
      tmdbFetch("/genre/movie/list", {}, target),
      tmdbFetch("/genre/tv/list", {}, target),
    ]);
    const map = new Map();
    const pair = (enList, locList) => {
      const loc = new Map((locList.genres || []).map((g) => [g.id, g.name]));
      for (const g of enList.genres || []) {
        const l = loc.get(g.id);
        if (l) map.set(g.name, l);
      }
    };
    pair(me, le);
    pair(mt, lt);
    if (target.startsWith("pt")) for (const [en, pt] of Object.entries(ANIME_GENRES_PT)) map.set(en, pt);
    genreMapCache[target] = map;
    return map;
  } catch {
    return null;
  }
}

// Traduz uma lista de nomes de genero usando o mapa (mantem o original se faltar).
export function translateGenres(names, map) {
  if (!map || !Array.isArray(names)) return names || [];
  return names.map((n) => map.get(n) || n);
}

export { MAL_GENRES, ANIME_GENRES_PT };