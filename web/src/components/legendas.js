// Legendas: as opcoes que o utilizador controla.
//
// O `delay` (atraso) NAO e' resolvido aqui. O `<track>` do browser nao deixa
// mexer nos tempos das faixas — nao ha' API para isso. Como o servidor ja vai
// buscar o `.vtt` (e' o `/api/proxy`, que resolve o CORS e o `Referer` do
// site), o atraso e' um `&atraso=N` no URL: `server/src/services/legendas.js`.
//
// O que fica aqui e' o que e' CSS `::cue` — que e' o mecanismo que o MDN
// documenta para dar estilo as legendas de um `<video>` (cor, fundo, fonte,
// tamanho, sombra). Nao ha' biblioteca para isso.
//
// Este modulo e' PURO (sem React, sem DOM) para se poder partir por mutacao.
import {
  OPACIDADE_MIN,
  OPACIDADE_MAX,
  OPACIDADE_DEF,
  DELAY_MIN,
  DELAY_MAX,
} from "./legendasOpcoes.js";

export { OPACIDADE_MIN, OPACIDADE_MAX, OPACIDADE_DEF, DELAY_MIN, DELAY_MAX };

// O tamanho e' um ESCALA do tamanho que o browser escolhe, nao pixels: o
// tamanho nativo das legendas depende do tamanho do video, e um valor fixo em
// pixels ficaria gigante num ecra grande e ilegivel num pequeno.
export const TAMANHOS = [
  { id: "pequeno", valor: 0.75 },
  { id: "normal", valor: 1 },
  { id: "grande", valor: 1.35 },
  { id: "muito grande", valor: 1.8 },
];

export const FONTES = [
  { id: "", pilha: "" },
  { id: "sistema", pilha: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' },
  { id: "serifada", pilha: 'Georgia, "Times New Roman", serif' },
  { id: "monoespacada", pilha: '"Consolas", "Courier New", monospace' },
];

// Os rotulos que o utilizador le. Sao SEPARADOS dos ids acima porque os ids
// sao internos (vao para o localStorage e para o `settings`) e nao se traduzem
// depois de escritos: um id diferente seria uma preferencia perdida.
export const ROTULO_TAMANHO = {
  pequeno: "Pequeno", // i18n: rotulo de tamanho de legenda
  normal: "Normal", // i18n: rotulo de tamanho de legenda
  grande: "Grande", // i18n: rotulo de tamanho de legenda
  "muito grande": "Muito grande", // i18n: rotulo de tamanho de legenda
};

export const ROTULO_FONTE = {
  "": "Do sistema", // i18n: rotulo de fonte de legenda
  sistema: "Sem serifa", // i18n: rotulo de fonte de legenda
  serifada: "Com serifa", // i18n: rotulo de fonte de legenda
  monoespacada: "Monoespaçada", // i18n: rotulo de fonte de legenda
};

// As cores do texto (`color` do `::cue`). Poucas e de alto contraste: um
// seletor de cores livre aqui dava texto escuro sobre caixa escura sem
// ninguem perceber porque.
export const CORES_TEXTO = [
  { id: "branco", cor: "#ffffff" },
  { id: "amarelo", cor: "#ffe680" },
  { id: "preto", cor: "#000000" },
];

// As cores da CAIXA (`background` do `::cue`). O `rgb` vai como texto para
// entrar numa `rgba(...)` montada em JS — ver `fundoRgba`.
export const CORES_FUNDO = [
  { id: "preto", rgb: "0, 0, 0" },
  { id: "cinza", rgb: "38, 38, 44" },
  { id: "branco", rgb: "255, 255, 255" },
  { id: "azul", rgb: "8, 32, 64" },
];

// O "contorno" das legendas de TV (Character Edge do ExoPlayer): o `::cue`
// aceita `text-shadow`, e e' com varias sombras deslocadas de 1 px que se faz
// um contorno. "Realcado" e' uma sombra dura para baixo (o Raised da
// screenshot), "sombra" e' a suave que ja existia.
export const CONTORNOS = [
  { id: "", sombra: "none" },
  { id: "sombra", sombra: "0 1px 3px rgba(0, 0, 0, 0.95)" },
  {
    id: "contorno",
    sombra:
      "1px 0 0 #000, -1px 0 0 #000, 0 1px 0 #000, 0 -1px 0 #000, 1px 1px 0 #000, -1px 1px 0 #000, 1px -1px 0 #000, -1px -1px 0 #000",
  },
  { id: "realcado", sombra: "0 2px 0 #000, 0 4px 8px rgba(0, 0, 0, 0.9)" },
];

export const ROTULO_COR_TEXTO = {
  branco: "Branco", // i18n: rotulo de cor de legenda
  amarelo: "Amarelo", // i18n: rotulo de cor de legenda
  preto: "Preto", // i18n: rotulo de cor de legenda
};

export const ROTULO_COR_FUNDO = {
  preto: "Preto", // i18n: rotulo de cor de legenda
  cinza: "Cinza", // i18n: rotulo de cor de legenda
  branco: "Branco", // i18n: rotulo de cor de legenda
  azul: "Azul", // i18n: rotulo de cor de legenda
};

export const ROTULO_CONTORNO = {
  "": "Nenhum", // i18n: rotulo de contorno de legenda
  sombra: "Sombra", // i18n: rotulo de contorno de legenda
  contorno: "Contorno", // i18n: rotulo de contorno de legenda
  realcado: "Realçado", // i18n: rotulo de contorno de legenda
};

/** Limita um numero ao intervalo [min, max]. Devolve `porOmissao` se nao for numero. */
export function limitar(valor, min, max, porOmissao) {
  const n = Number(valor);
  if (!Number.isFinite(n)) return porOmissao;
  return Math.min(max, Math.max(min, n));
}

/** O tamanho escolhido, em escala. Desconhecido -> 1. */
export function tamanhoEscala(valor) {
  const achado = TAMANHOS.find((t) => t.id === valor);
  return achado ? achado.valor : 1;
}

/** A pilha de fontes do `::cue`. Vazio = a do sistema. */
export function fontePilha(valor) {
  const achado = FONTES.find((f) => f.id === valor);
  return achado ? achado.pilha : "";
}

/** A cor do texto do `::cue`. Desconhecida -> branco. */
export function corTextoHex(valor) {
  const achado = CORES_TEXTO.find((c) => c.id === valor);
  return achado ? achado.cor : "#ffffff";
}

/**
 * A cor da caixa de fundo, ja' com a opacidade embutida (`rgba(...)`).
 *
 * E' uma string montada aqui, e nao `rgb(var(--x) / var(--y))` no CSS, porque
 * o `::cue` do Chromium e' o sitio onde uma sintaxe mais nova falha em
 * silencio: a legenda ficava sem caixa e ninguem sabia por que. Uma `rgba()`
 * com numeros montados em JS e' testavel sem browser.
 */
export function fundoRgba(valor, opacidade) {
  const achado = CORES_FUNDO.find((c) => c.id === valor);
  const rgb = achado ? achado.rgb : "0, 0, 0";
  const op = limitar(opacidade, OPACIDADE_MIN, OPACIDADE_MAX, OPACIDADE_DEF);
  // Duas casas bastam: o `::cue` nao distingue 0,333 de 0,33 e o slider da'
  // passos de 0,05 — assim o valor no CSS nao tem 17 digitos.
  return `rgba(${rgb}, ${Math.round(op * 100) / 100})`; // i18n: CSS, nao e' texto de interface
}

/** A sombra (contorno) do `::cue`. Desconhecido -> sem contorno. */
export function sombraContorno(valor) {
  const achado = CONTORNOS.find((c) => c.id === valor);
  return achado ? achado.sombra : "none";
}

/**
 * Acrescenta o atraso pedido ao URL de uma legenda.
 *
 * `atraso` em SEGUNDOS (fracionario aceite). Devolve o URL sem mexer quando o
 * atraso e' 0 ou invalido — assim o caso normal nao paga nada.
 *
 * O `atraso` vai como parametro do nosso proxy, nao como fragmento: e' o
 * servidor que desloca os tempos. Um `#` seria perdido no pedido HTTP.
 */
export function urlComAtraso(url, atraso) {
  const base = String(url || "");
  const s = Number(atraso);
  if (!base || !Number.isFinite(s) || Math.round(s * 1000) === 0) return base;
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}atraso=${encodeURIComponent(String(s))}`;
}

/**
 * Os valores de CSS para o `::cue`, a partir das preferencias.
 *
 * Devolve um objecto com `--sub-*`, que o CSS consome. Tudo dentro dos limites:
 * um valor estragado nas Definicoes (ou escrito a mao no localStorage) nao pode
 * tornar a legenda invisivel ou ocupar o ecra inteiro.
 */
export function cssLegendas({
  tamanho = "normal",
  opacidade = OPACIDADE_DEF,
  fonte = "",
  contorno = "sombra",
  corTexto = "branco",
  corFundo = "preto",
} = {}) {
  const escala = tamanhoEscala(tamanho);
  const pilha = fontePilha(fonte);
  return {
    // O `font-size` do `::cue` e' uma percentagem da ALTURA do video. O 5% e' o
    // valor por omissao do Chrome, para que "normal" seja o que era antes.
    "--sub-tamanho": String(escala),
    // O TEXTO e' sempre opaco: a opacidade agora e' a da caixa.
    "--sub-cor": corTextoHex(corTexto),
    "--sub-fundo": fundoRgba(corFundo, opacidade),
    "--sub-sombra": sombraContorno(contorno),
    ...(pilha ? { "--sub-fonte": pilha } : {}),
  };
}
