// Os limites das opcoes das legendas.
//
// Vem num ficheiro proprio porque `legendas.js` (a logica) e os componentes
// precisam dos MISMOS numeros: se cada um tivesse o seu `Math.min`, um dia um
// aceitava 0..100 e o outro so 0..10, e o slider e o servidor discordavam.
// Os mesmos valores que o servidor usa em `server/src/services/legendas.js`.
export const OPACIDADE_MIN = 0;
export const OPACIDADE_MAX = 1;
export const OPACIDADE_DEF = 1;

export const DELAY_MIN = -10;
export const DELAY_MAX = 10;
export const DELAY_DEF = 0;
