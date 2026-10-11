// Pular a abertura e o fim nos episodes de anime.
//
// Tudo aqui e' PURO de proposito: a logica decide quando aparece o botao e para
// onde salta, e ja esteve errada uma vez (o `outro` do MegaPlay vem como
// `{start: 0, end: 0}` quando o episodio NAO tem fim, o que — sem o filtro de
// baixo — mostraria o botao aos 0 segundos de qualquer episodio). Um modulo sem
// React importa-se num teste e parte-se por mutacao; dentro do componente isso
// nao era possivel.
//
// A forma que o MegaPlay devolve (medida em 2026-10-11, 3 episodios reais):
//   intro: {start: 140, end: 229}    ou  {start: 0, end: 0}  (ou null/undefined)
//   outro: {start: 1376, end: 1447}  ou  {start: 0, end: 0}  (ou null/undefined)

const MIN_SEGUNDOS = 1;

/**
 * Uma janela de pulo so vale se os dois lados forem numeros REAIS, o fim for
 * depois do inicio, e o intervalo nao for degenerado.
 *
 * O `start > 0` e' o filtro que importa: sem ele, `{start: 0, end: 0}` (o
 * "sem fim" do MegaPlay) contaria como janela e o botao apareceria aos 0 s de
 * qualquer episodio.
 */
export function janelaValida(w) {
  if (!w || typeof w !== "object") return false;
  const { start, end } = w;
  // `Number.isFinite` NAO converte (ao contrario de `isFinite`), por isso
  // rejeita de uma vez: "140" (texto), `undefined`, `null`, `NaN` e `Infinity`.
  // E' por isso que nao ha um `typeof` separado — seria redundante, e um filtro
  // redundante nao se consegue testar por mutacao (tira-lo nao muda nada).
  if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
  if (end - start < MIN_SEGUNDOS) return false;
  return start >= 0;
}

/**
 * Normaliza uma janela para segundos, ou `null` se nao for valida.
 * Devolve sempre um objectonovo — nunca o do servidor — para nao haver
 * mutacao partilhada entre o componente e o estado.
 */
export function normalizarJanela(w) {
  if (!janelaValida(w)) return null;
  return { start: w.start, end: w.end };
}

/**
 * Para onde saltar. `duracao` e' a do video, se ja a souber: uma janela que
 * passa do fim (o site pode ter tempos do OP slightly errados) salta para o
 * fim em vez de deixar o video parado a tentar ir para um ponto inexistente.
 *
 * Devolve `null` quando nao ha para onde saltar — o botao nao aparece e o
 * utilizador fica a ver a abertura como sempre.
 */
export function destinoPulo(w, duracao) {
  const j = normalizarJanela(w);
  if (!j) return null;
  let destino = j.end;
  const d = Number(duracao);
  if (Number.isFinite(d) && d > 0 && destino > d - 1) destino = Math.max(0, d - 1);
  if (destino <= 0) return null;
  return destino;
}

/**
 * Que botao mostrar agora, se algum.
 *
 * `jaSaltou` e' um conjunto de rotulos ja saltados: e' o que impede o botao de
 * reaparecer quando se salta, e o que impede o autoskip de entrar num ciclo
 * (salta -> reaparece -> salta).
 *
 * Devolve `null` fora de qualquer janela, e `{ tipo, destino }` dentro.
 * `tempo` e' em segundos. Uma margem de 1,5 s antes do inicio mostra o botao um
 * bocado mais cedo, que e' como qualquer leitor de video faz — da para_cancelar.
 */
export function pularVisivel({ intro, outro, tempo, jaSaltou, duracao, margem = 1.5 }) {
  const t = Number(tempo);
  if (!Number.isFinite(t) || t < 0) return null;
  const feitos = jaSaltou instanceof Set ? jaSaltou : new Set();

  for (const [tipo, w] of [["intro", intro], ["outro", outro]]) {
    if (feitos.has(tipo)) continue;
    const j = normalizarJanela(w);
    if (!j) continue;
    if (t < j.start - margem || t > j.end) continue;
    const destino = destinoPulo(w, duracao);
    if (destino == null) continue;
    return { tipo, destino };
  }
  return null;
}

/**
 * O autoskip: se a definicao esta ligada, salta sozinho uma vez ao entrar na
 * janela. Devolve o **destino em segundos**, ou `null` para nao fazer nada.
 *
 * E' separado de `pularVisivel` de proposito: com o autoskip ligado o botao nao
 * aparece (a Definicoes promete "tenta saltar a intro", nao "pergunta"), e e' o
 * utilizador que decide esse caso. Desligado, so aparece o botao.
 *
 * Devolve o numero, nao o `{tipo, destino}` de `pularVisivel`: aqui so interessa
 * para onde saltar (o `tipo` e' sempre "intro"). Devolver o objecto obrigava o
 * componente a lembrar-se de tirar o `.destino`, e foi exactamente o que o teste
 * apanhou na primeira versao.
 */
export function autoskipDestino({ intro, tempo, jaSaltou, duracao }) {
  const v = pularVisivel({ intro, outro: null, tempo, jaSaltou, duracao });
  return v ? v.destino : null;
}

/**
 * `229` -> `"3:49"`, `3725` -> `"1:02:05"`. Para o botao dizer para onde vai.
 *
 * Nao existe `formatarTempo` no projecto (a app mostra tempos em s e em
 * `h:mm` noutros sitios, cada um com o seu formato), por isso e' uma funcao
 * nova. PURE de proposito, como o resto do modulo.
 */
export function formatarTempo(seg) {
  const n = Math.max(0, Math.floor(Number(seg) || 0));
  const h = Math.floor(n / 3600);
  const m = Math.floor((n % 3600) / 60);
  const s = n % 60;
  const dois = (x) => String(x).padStart(2, "0");
  return h > 0 ? `${h}:${dois(m)}:${dois(s)}` : `${m}:${dois(s)}`;
}

/**
 * Rotulo de uma variante de qualidade, a partir do que o `hls.js` da.
 *
 * A altura e' o que interessa (`1080p`), e e' o unico campo que se pode
 * mostrar com seguranca: o bitrate real muda de site para site e um numero
 * grande no ecra assusta sem explicar nada. Quando a variante NAO tem altura
 * (alguns `master.m3u8` so' trazem bitrate), mostra-se o bitrate em Mbps em vez
 * de ficar um espaco vazio no menu.
 *
 * PURE como o resto do modulo — a escolha do rotulo e' logica, nao UI.
 */
export function rotuloNivel(l, indice = 0) {
  const altura = Number(l?.height);
  if (Number.isFinite(altura) && altura > 0) return `${altura}p`;

  const bits = Number(l?.bitrate);
  if (Number.isFinite(bits) && bits > 0) {
    const mbps = bits / 1_000_000;
    // Uma casa quando e' pequeno ("1.5"), zero quando e' grande ("8"): 1080p
    // nao se escreve "8.0" num menu.
    return `${mbps >= 10 ? Math.round(mbps) : Math.round(mbps * 10) / 10} Mbps`;
  }

  // Sem altura e sem bitrate: melhor um "Opcao N" honesto do que dois "Auto".
  return `Opção ${indice + 1}`;
}
