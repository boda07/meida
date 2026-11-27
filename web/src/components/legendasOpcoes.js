// Os limites das opcoes das legendas.
//
// Vem num ficheiro proprio porque `legendas.js` (a logica) e os componentes
// precisam dos MISMOS numeros: se cada um tivesse o seu `Math.min`, um dia um
// aceitava 0..100 e o outro so 0..10, e o slider e o servidor discordavam.
// Os mesmos valores que o servidor usa em `server/src/services/legendas.js`.
// A opacidade e' a da CAIXA DE FUNDO, nao a do texto: a 50% o texto continua
// branco e opaco e o que fica translucido e' a caixa atras dele. Antes era o
// contrario (as duas coisas juntas), e a meia opacidade tornava a legenda
// dificil de ler em vez de a aliviar.
//
// 0,6 e' o valor por omissao porque e' o que o CSS antigo dava na pratica
// (`0.6 * opacidade` com a opacidade a 1), ou seja, quem nunca mexeu ve a mesma
// coisa de antes.
export const OPACIDADE_MIN = 0;
export const OPACIDADE_MAX = 1;
export const OPACIDADE_DEF = 0.6;

export const DELAY_MIN = -10;
export const DELAY_MAX = 10;
export const DELAY_DEF = 0;
