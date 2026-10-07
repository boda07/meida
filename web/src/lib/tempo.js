// Datas em pt-PT, no formato que as pessoas usam: "ha 10 s", "ha 3 min".
//
// Nao e' so cosmetica. Uma data absoluta ("07 out") obriga a fazer as contas
// para saber se aquilo e' de hoje; um "ha 20 min" diz logo. E num sistema onde os
// comentarios aparecem logo a seguir a serem escritos, um "07 out" e' pior do que
// nao dizer nada.
//
// A regra: recentes em unidades ("ha 10 s"), antigos em data ("7 de outubro").
// O limite e' de uma semana, porque depois "ha 3 semanas" deixa de interessar
// e a data e' mais util.

const SEG = 1000;
const MIN = 60 * SEG;
const HORA = 60 * MIN;
const DIA = 24 * HORA;
const SEMANA = 7 * DIA;

// Divisor e rotulo vao separados: um `unidade === MIN ? "min" : unidade` dava
// "10 1000 atras" nos segundos e as horas.
function quanto(ms, divisor, rotulo) {
  return `${Math.floor(ms / divisor)} ${rotulo} atras`;
}

// Uma data absoluta em portugues tem sempre " de " ("29 de setembro"). E' o que
// distingue "10 seg atras" de uma data.
function pareceData(texto) {
  return texto.includes(" de ");
}

/**
 * Tempo desde `iso`, em portugues. Aceita Date, numero (ms) ou string ISO.
 * Devolve "" quando nao da para saber a data — nunca "Invalid Date" no ecra.
 *
 * @param {string|number|Date} iso
 * @param {number} agora  ms (parametro para os testes poderem fixar o "agora")
 */
export function haQuanto(iso, agora = Date.now()) {
  if (iso == null || iso === "") return "";
  const t = iso instanceof Date ? iso.getTime() : new Date(iso).getTime();
  if (Number.isNaN(t)) return "";

  const ms = agora - t;

  // Uma data no futuro (desvio de relogio, um servidor com fuso diferente) nao
  // pode dar "ha -3 min".
  if (ms < 0) return "agora mesmo";

  if (ms < 10 * SEG) return "agora mesmo";
  if (ms < MIN) return quanto(ms, SEG, "seg");
  if (ms < HORA) return quanto(ms, MIN, "min");
  if (ms < DIA) return quanto(ms, HORA, "h");
  if (ms < SEMANA) {
    const n = Math.floor(ms / DIA);
    return `${n} ${n === 1 ? "dia" : "dias"} atras`;
  }

  // Depois de uma semana, data absoluta. Com o ano quando nao e' este.
  const d = new Date(t);
  const mesmoAno = d.getFullYear() === new Date(agora).getFullYear();
  return d.toLocaleDateString("pt-PT", {
    day: "numeric",
    month: "long",
    ...(mesmoAno ? {} : { year: "numeric" }),
  });
}

/**
 * Data + tempo relativo, para tooltips: "ha 10 s atras (7 de outubro as 15:04)".
 * Se o relativo for a data (passou de uma semana), devolve so' a data com hora.
 */
export function quandoCompleto(iso, agora = Date.now()) {
  if (iso == null || iso === "") return "";
  const t = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(t.getTime())) return "";
  const exacto = t.toLocaleString("pt-PT", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
  const rel = haQuanto(iso, agora);
  return rel && !pareceData(rel) ? `${rel} (${exacto})` : exacto;
}

/** Minuto/segundo no video: 125 -> "2:05". Aceita string ou numero. */
export function paraTempo(s) {
  if (s == null || s === "") return "";
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return "";
  const h = Math.floor(n / 3600);
  const m = Math.floor((n % 3600) / 60);
  const seg = Math.floor(n % 60);
  const dois = (x) => String(x).padStart(2, "0");
  return h > 0 ? `${h}:${dois(m)}:${dois(seg)}` : `${m}:${dois(seg)}`;
}

/**
 * Inverso de paraTempo: "2:05" -> 125, "125" -> 125, "" -> null.
 * Aceita as duas escritas porque ninguem acerta sempre no formato — e e' melhor
 * interpretar do que recusar o comentario.
 */
export function paraSegundos(texto) {
  if (texto == null) return null;
  const t = String(texto).trim();
  if (!t) return null;
  if (/^\d+$/.test(t)) return Number(t);
  const m = /^(\d+):([0-5]?\d)(?::([0-5]?\d))?$/.exec(t);
  if (!m) return null;
  if (m[3] !== undefined) return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
  return Number(m[1]) * 60 + Number(m[2]);
}
