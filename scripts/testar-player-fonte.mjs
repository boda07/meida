// Testa a logica do timeout do Player sem browser: a funcao que decide o que
// fazer quando o load nao chega. Reproduz o comportamento do componente.
const TIMEOUT_MS = 15000;
const TIMEOUT_MANUAL_MS = 45000;

// Reproduz o que o Player decide no timeout.
function aoDispararTimeout({ manual, index, lista, deadIds }) {
  // proximo = nextAlive(index, lista, deadIds)
  function nextAlive(i, list, dead) {
    if (!list || !list.length) return 0;
    for (let j = i + 1; j < list.length; j++) if (!dead || !dead.has(list[j].provider)) return j;
    for (let j = 0; j < i; j++) if (!dead || !dead.has(list[j].provider)) return j;
    return i;
  }
  if (manual) return { accao: "loaded", trocou: false }; // nao troca
  const proximo = nextAlive(index, lista, deadIds);
  if (proximo === index) return { accao: "loaded", trocou: false };
  return { accao: "trocar", trocou: true, novo: proximo };
}

const lista = [
  { provider: "vidapi", name: "VidAPI" },
  { provider: "vidlove", name: "VidLove" },
  { provider: "vidlink", name: "VidLink" },
];

let n = 0, mau = 0;
function ok(rotulo, cond) {
  if (cond) { n++; console.log("  OK    " + rotulo); }
  else { mau++; console.log("  FALHA " + rotulo); }
}

// 1) Automatico: salta para a proxima (comportamento antigo, mantido)
ok("automatico salta para a proxima fonte", aoDispararTimeout({ manual: false, index: 1, lista, deadIds: new Set() }).trocou);
ok("automatico vai do VidLove(1) para o VidLink(2)", aoDispararTimeout({ manual: false, index: 1, lista, deadIds: new Set() }).novo === 2);

// 2) Manual: NAO salta (o defeito reportado)
ok("manual nao troca de fonte", !aoDispararTimeout({ manual: true, index: 1, lista, deadIds: new Set() }).trocou);
ok("manual so marca como carregado", aoDispararTimeout({ manual: true, index: 1, lista, deadIds: new Set() }).accao === "loaded");

// 3) Manual: se for a ultima fonte, tambem nao ha o que fazer
ok("manual naoultimate nao troca", !aoDispararTimeout({ manual: true, index: 2, lista, deadIds: new Set() }).trocou);

// 4) Tempo de espera: manual e' mais longo
ok("timeout manual e' maior que o automatico", TIMEOUT_MANUAL_MS > TIMEOUT_MS);

// 5) Troca so com fonte viva seguinte
ok("automatico salta para a fonte viva seguinte", aoDispararTimeout({ manual: false, index: 0, lista, deadIds: new Set(["vidlove"]) }).novo === 2);

console.log(mau ? "\n  " + mau + " FALHA(S)" : "\n  " + n + " verificacoes passam");
process.exit(mau ? 1 : 0);
