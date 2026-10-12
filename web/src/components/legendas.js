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
import { OPACIDADE_MIN, OPACIDADE_MAX, DELAY_MIN, DELAY_MAX } from "./legendasOpcoes.js";

export { OPACIDADE_MIN, OPACIDADE_MAX, DELAY_MIN, DELAY_MAX };

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
export function cssLegendas({ tamanho = "normal", opacidade = 1, fonte = "" } = {}) {
  const escala = tamanhoEscala(tamanho);
  const op = limitar(opacidade, OPACIDADE_MIN, OPACIDADE_MAX, 1);
  const pilha = fontePilha(fonte);
  return {
    // O `font-size` do `::cue` e' uma percentagem da ALTURA do video. O 5% e' o
    // valor por omissao do Chrome, para que "normal" seja o que era antes.
    "--sub-tamanho": String(escala),
    "--sub-opacidade": String(op),
    ...(pilha ? { "--sub-fonte": pilha } : {}),
  };
}
