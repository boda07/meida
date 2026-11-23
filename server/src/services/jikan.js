// Barrel do Jikan (API publica do MyAnimeList, sem chave).
//
// O anime e SEMPRE focado no MAL: catalogo, poster, sinopse, titulo e episodios
// vem todos do MAL. A reproducao usa os providers de anime por id do MAL
// (MegaPlay/VidLink/VidSrc.cc). O TMDB so serve para filmes e series — e para
// arranjar o IMDB id que os torrents precisam (match best-effort).
//
// O modulo foi dividido por responsabilidade (todos em `jikan/`):
//
//   fetch.js      — `jikanFetch` (Tenrai primario, Jikan backup), `sleep`
//   normalizar.js — `normalizeAnime`, `normalizeAnilistAnime`, `dedupe`
//   anilist.js    — AniList: catalogo/pesquisa de reserva, banners, id
//   generos.js    — `getAnimeGenres`
//   aleatorio.js  — `pickAnime` (com fallback AniList)
//   catalogo.js   — rows, grelha e paginas (`getAnimeCatalog`, `discoverAnime`)
//   detalhes.js   — `getAnimeDetails`
//   episodios.js  — `getAnimeEpisodes` e a sintese por numero
//   pesquisa.js   — `searchAnime`, `getAnimeRecommendations`
//
// As importacoes de fora continuam a vir do caminho antigo (`services/jikan.js`),
// que e' este ficheiro — mexer aqui e' mexer na fachada, nao na API.
export { sleep, jikanFetch } from "./jikan/fetch.js";
export { normalizeAnime } from "./jikan/normalizar.js";
export {
  getAnimeCatalog,
  getAnimeMovies,
  getAnimeListPage,
  discoverAnime,
} from "./jikan/catalogo.js";
export { getAnimeGenres } from "./jikan/generos.js";
export { pickAnime } from "./jikan/aleatorio.js";
export { getAnimeDetails } from "./jikan/detalhes.js";
export {
  groupEpisodesBySeason,
  normalizarEpisodios,
  episodiosPorNumero,
  getAnimeEpisodes,
} from "./jikan/episodios.js";
export {
  getAnimeRecommendations,
  searchAnime,
} from "./jikan/pesquisa.js";
export {
  getAnimeRatingsBatch,
  getAnilistMeta,
  getAnimeBannersBatch,
  malToAnilist,
} from "./jikan/anilist.js";