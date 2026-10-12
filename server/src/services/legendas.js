// Move os tempos de um ficheiro WebVTT (o "atraso" das legendas).
//
// PORQUE ISTO E' AQUI E' NO CLIENTE: o `<track>` do browser nao deixa mexer nos
// tempos das faixas — nao ha' API para isso. Como o servidor JA vai buscar o
// `.vtt` (e' o `/api/proxy`, que contorna o CORS e o `Referer` do site), e' aqui
// que se desloca: o cliente so' acrescenta `&atraso=N` ao URL que ja tinha.
//
// A biblioteca e' a `subtitle` (npm), que trata do chato — deteta o formato,
// guarda o cabecalho, sabe formatar os timestamps. O `resync` dela e' um stream
// (nao da para usar aqui sem meter streams a um pedido HTTP), por isso o
// deslocamento sao tres linhas sobre os nos ja lidos.
import { parseSync, stringifySync } from "subtitle";

// O atraso vai em segundos e e' limitado. Mais do que +-60 s ja nao e' "as
// legendas aparecem tarde", e' um erro de sincronizacao na fonte.
export const ATRASO_MIN = -60;
export const ATRASO_MAX = 60;

/** Limita o atraso pedido ao intervalo. Devolve 0 para qualquer coisa invalida. */
export function limitarAtraso(segundos) {
  const n = Number(segundos);
  if (!Number.isFinite(n)) return 0;
  return Math.min(ATRASO_MAX, Math.max(ATRASO_MIN, n));
}

/**
 * Desloca todos os tempos de um WebVTT em `ms` milissegundos.
 *
 * `ms > 0` atrasa a legenda, `ms < 0` adianta.
 *
 * Regras:
 *   - Uma legenda que ficaria INTEIRA antes de 0 desaparece: nao ha' tempo em
 *     que possa ser mostrada. E' por isso que se filtra o no INTEIRO e nao se
 *     deixa um "0 --> 0" — que o browser aceita e mostra texto vazio.
 *   - Uma legenda que fica partly antes de 0 e' empurrada para 0 (o fim tambem,
 *     para nao ficar com o fim antes do inicio). Tempo negativo e' invalido no
 *     WebVTT.
 *   - Se nao houver NENHUMA linha de tempo (ou o texto nao for VTT), devolve a
 *     entrada original. Um `.vtt` meio estragado e' melhor do que sem legenda.
 *
 * NUNCA lanca: o proxy tem de servir o ficheiro na mesma, mesmo que o atraso
 * nao possa ser aplicado. Uma legenda no sitio errado ainda se le; sem legenda
 * nao se ve nada.
 */
export function deslocarVtt(texto, ms) {
  const entrada = String(texto || "");
  const desloca = Number(ms);
  if (!entrada.trim()) return entrada;
  if (!Number.isFinite(desloca) || desloca === 0) return entrada;

  let nos;
  try {
    nos = parseSync(entrada);
  } catch {
    return entrada;
  }
  if (!Array.isArray(nos) || !nos.length) return entrada;

  const fora = [];
  let mudou = 0;

  for (const no of nos) {
    if (!no || no.type !== "cue" || !no.data) {
      // O cabecalho passa intacto.
      if (no) fora.push(no);
      continue;
    }
    const inicio = Number(no.data.start);
    const fim = Number(no.data.end);
    if (!Number.isFinite(inicio) || !Number.isFinite(fim)) {
      fora.push(no);
      continue;
    }
    const novoInicio = inicio + desloca;
    const novoFim = fim + desloca;
    // Inteira antes de zero: nao tem quando aparecer, sai fora.
    if (novoFim <= 0) {
      mudou++;
      continue;
    }
    no.data.start = Math.max(0, novoInicio);
    no.data.end = novoFim;
    fora.push(no);
    mudou++;
  }

  // Nada mudou (por exemplo so havia cabecalho): nao vale a pena reescrever.
  if (!mudou) return entrada;

  try {
    const saida = stringifySync(fora, { format: "WebVTT" });
    return typeof saida === "string" && saida.trim() ? saida : entrada;
  } catch {
    return entrada;
  }
}
