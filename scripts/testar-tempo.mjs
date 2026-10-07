// Testes de web/src/lib/tempo.js: o texto das datas e a conversao de tempos.
//
// Funcao pura, corre em Node sem browser. Nao se usa `assert` do node: e' cada
// caso que diz o que esperava, para se ler a falha sem ir ver a linha.
const { haQuanto, quandoCompleto, paraTempo, paraSegundos } = await import(
  "file:///C:/Users/white/Documents/Meida/web/src/lib/tempo.js"
);

const AGORA = new Date("2026-10-07T15:00:00Z").getTime();
const SEG = 1000, MIN = 60 * SEG, HORA = 60 * MIN, DIA = 24 * HORA;

let n = 0, mau = 0;
function ok(rotulo, valor, esperado) {
  if (valor === esperado) {
    n++;
    console.log(`  OK    ${rotulo} -> ${JSON.stringify(valor)}`);
  } else {
    mau++;
    console.log(`  FALHA ${rotulo} -> veio ${JSON.stringify(valor)}, esperado ${JSON.stringify(esperado)}`);
  }
}
function ha(ms) {
  return haQuanto(new Date(AGORA - ms).toISOString(), AGORA);
}

console.log("  --- datas relativas ---");
ok("mesmo agora", ha(0), "agora mesmo");
ok("5 segundos", ha(5 * SEG), "agora mesmo");
ok("10 segundos", ha(10 * SEG), "10 seg atras");
ok("59 segundos", ha(59 * SEG), "59 seg atras");
ok("1 minuto", ha(MIN), "1 min atras");
ok("10 minutos", ha(10 * MIN), "10 min atras");
ok("1 hora", ha(HORA), "1 h atras");
ok("5 horas", ha(5 * HORA), "5 h atras");
ok("1 dia", ha(DIA), "1 dia atras");
ok("3 dias", ha(3 * DIA), "3 dias atras");
ok("6 dias", ha(6 * DIA), "6 dias atras");

console.log("  --- depois de uma semana e' data ---");
// 7 de outubro menos 8 dias e' 29 de setembro (o meu erro: escrevi 30).
ok("8 dias -> data com mes", haQuanto(new Date(AGORA - 8 * DIA).toISOString(), AGORA), "29 de setembro");
ok("2 anos -> data com ano", haQuanto("2024-03-04T10:00:00Z", AGORA), "4 de março de 2024");

console.log("  --- entradas a tolerate ---");
ok("null", haQuanto(null, AGORA), "");
ok("string vazia", haQuanto("", AGORA), "");
ok("lixo", haQuanto("isto nao e' uma data", AGORA), "");
ok("data no futuro nao da negativos", haQuanto(new Date(AGORA + 3 * MIN).toISOString(), AGORA), "agora mesmo");
ok("aceita numero (ms)", haQuanto(AGORA - 10 * SEG, AGORA), "10 seg atras");
ok("aceita Date", haQuando(new Date(AGORA - 2 * HORA), AGORA), "2 h atras");
function haQuando(d, a) {
  return haQuanto(d, a);
}

console.log("  --- tooltip com a data exacta ---");
ok("relativo + exacto", quandoCompleto(new Date(AGORA - 10 * SEG).toISOString(), AGORA).startsWith("10 seg atras ("), true);

console.log("  --- tempos de video ---");
ok("125 -> 2:05", paraTempo(125), "2:05");
ok("5 -> 0:05", paraTempo(5), "0:05");
ok("3725 -> 1:02:05", paraTempo(3725), "1:02:05");
ok("vazio", paraTempo(""), "");
ok("negativo", paraTempo(-1), "");
ok("texto", paraTempo("abc"), "");

console.log("  --- inverso: escrever o tempo ---");
ok("'2:05' -> 125", paraSegundos("2:05"), 125);
ok("'125' -> 125", paraSegundos("125"), 125);
ok("'1:02:05' -> 3725", paraSegundos("1:02:05"), 3725);
ok("'0:05' -> 5", paraSegundos("0:05"), 5);
ok("' 3:00 ' com espacos -> 180", paraSegundos(" 3:00 "), 180);
ok("'' -> null", paraSegundos(""), null);
ok("null -> null", paraSegundos(null), null);
ok("lixo -> null (nao aceita)", paraSegundos("abc"), null);
ok("'2:75' -> null (segundos invalidos)", paraSegundos("2:75"), null);

console.log("  --- ida e volta sem perder nada ---");
for (const s of [0, 5, 59, 60, 125, 3599, 3600, 3725, 86399]) {
  const t = paraTempo(s);
  const volta = paraSegundos(t);
  ok(`ida e volta de ${s} (${t})`, volta, s);
}

console.log(mau ? `\n  ${mau} FALHA(S)` : `\n  ${n} verificacoes passam`);
process.exit(mau ? 1 : 0);
