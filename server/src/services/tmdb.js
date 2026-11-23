// Barrel do TMDB.
//
// O modulo foi dividido por responsabilidade (todos em `tmdb/`):
//
//   base.js        — `tmdbFetch`, idiomas (`langsFrom`)
//   normalizar.js  — `normalizeMedia`, `applyMeta`, `pickPoster`
//   titulos.js     — `bestTitle`, `resolveTitleMeta`
//   generos.js     — generos do TMDB e do MAL (+ vocabulario e traducao)
//   catalogo.js    — `tmdbList`, linhas da Home/Categoria
//   pesquisa.js    — pesquisa e resolucao de id por titulo/ano
//   grelha.js      — `discover`, `getListPage`, `pickRandom`
//   detalhes.js    — `getDetails`, `getSeason`, `getSimilar`
//   localizacao.js — titulos/cartazes localizados dos itens guardados
//   meta.js        — `getMeta`, `getRating`, `getExternalImdb`
//
// As importacoes de fora continuam a vir do caminho antigo (`services/tmdb.js`),
// que e' este ficheiro — mexer aqui e' mexer na fachada, nao na API.
export { normalizeMedia } from "./tmdb/normalizar.js";
export { getCatalog, getCategory } from "./tmdb/catalogo.js";
export { search, findTmdbMatch, findMovieByTitle } from "./tmdb/pesquisa.js";
export { discover, getListPage, pickRandom } from "./tmdb/grelha.js";
export { getDetails, getSeason, getSimilar } from "./tmdb/detalhes.js";
export {
  getLocalizedMetaCached,
  localizarTitulos,
  preencherTitulosLocalizados,
  getLocalizedMeta,
} from "./tmdb/localizacao.js";
export { getMeta, getRating, getExternalImdb } from "./tmdb/meta.js";
export {
  getGenres,
  getGenreVocab,
  getGenreMap,
  translateGenres,
} from "./tmdb/generos.js";