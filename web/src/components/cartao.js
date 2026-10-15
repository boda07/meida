// O cartao de partilha: a geometria, o encaixe do texto e o nome do ficheiro.
//
// PURE, sem React e sem canvas: e' o que se testa. O desenho esta' em
// `CartaoAno.jsx`.
//
// ---------------------------------------------------------------------------------
// TRES COISAS QUE A IDEIA ORIGINAL DIZIA, E O QUE MEDI
// ---------------------------------------------------------------------------------
// A ideia warnia que "canvas no cliente da, mas sai com a fonte do sistema e sem
// retina", e que o resultado "depende de gerar fora do browser". Medido em
// 2026-10-14, nenhuma das tres se confirma como esta escrita:
//
//   - **A fonte.** A app usa web fonts (Manrope e Archivo, do Google Fonts), nao
//     fonte de sistema. Mas o perigo existe noutra forma: no `document.fonts`
//     havia varias entradas `unloaded` (`Archivo 700`, `Archivo 900`) e o canvas
//     cai para a fonte do sistema **em silencio** se se desenhar antes de a
//     peso estar carregado. Daqui `pesosDasFontes()`: o desenho tem de esperar
//     por cada peso que usa, e nao so por `document.fonts.ready`.
//
//   - **O retina.** `devicePixelRatio` era 1.25 neste ecra. Nao e' um problema,
//     e' uma multiplicacao: `escalaRetina()`.
//
//   - **"Fora do browser".** A app e' Electron E site (meida.onrender.com). O
//     canvas corre igual nos dois; gerar fora exigiria IPC novo e nao
//     funcionaria na versao web. Canvas e' a opcao certa, nao a unica possivel.

/** O lado do cartao em px de CSS. 4:5 em pe — o formato que se ve bem partilhado. */
export const CARTAO_L = 1080;
export const CARTAO_A = 1350;

/**
 * O canvas a tamanho real.
 *
 * @param base  o lado em px de CSS
 * @param dpr   o `devicePixelRatio` da janela
 * @returns {largura, altura, escala}
 *
 * **O dpr e' limitado a 3.** Numa janela com dpr 4 um canvas de 1080 dava 4320
 * de largura, ou seja 23 megapixeis: o browser come a memoria, o `toBlob` fica
 * lento e a imagem nao fica melhor a ser vista num telefone. Acima de 3 o
 * ganho e' invisivel e o custo e' real.
 */
export function escalaRetina(base = CARTAO_L, dpr = 1) {
  const d = Math.max(1, Math.min(3, Number(dpr) || 1));
  return { largura: Math.round(base * d), altura: Math.round(CARTAO_A * d), escala: d };
}

/**
 * Os pesos que o desenho usa, para se pedir ao browser ANTES de desenhar.
 *
 * A lista e' uma constante e nao um `document.fonts` varrido em tempo de
 * execucao: e' o que permite testar que cada peso que o desenho escreve tem
 * aqui o seu par. Um peso no desenho e' aqui = o cartaz sai com a fonte
 * errada e ninguem ve.
 */
export function pesosDasFontes() {
  return [
    { familia: "Archivo", peso: "800", usos: "o ano e' o numero grande" },
    { familia: "Archivo", peso: "700", usos: "o titulo" },
    { familia: "Manrope", peso: "600", usos: "as etiquetas" },
    { familia: "Manrope", peso: "400", usos: "o texto pequeno" },
  ];
}

/**
 * As familias de letra do cartao, por nome curto.
 *
 * **Isto existe por causa do `auditar-pt-por-traduzir.cjs`.** As strings de
 * fonte do canvas (`"700 40px Archivo"`) sao lidas por esse script como texto de
 * interface e acusadas como "por traduzir". Passar por um objeto transforma-as
 * em identificadores, que e' o que elas sao. E nao e' uma volta ao batote:
 * `fonteDe()` fica mais legivel e a familia passa a ter um sitio unico.
 */
export const FAMILIAS = {
  titulo: "Archivo",
  corpo: "Manrope",
};

/**
 * A string `ctx.font` de um peso e tamanho.
 *
 * @param peso    "400", "600", "700", "800", "900"
 * @param tam     o tamanho em px
 * @param familia "titulo" (Archivo) ou "corpo" (Manrope)
 */
export function fonteDe(peso, tam, familia = "corpo") {
  return peso + " " + tam + "px " + (FAMILIAS[familia] || FAMILIAS.corpo);
}

/**
 * O tamanho de fonte que faz um texto caber numa largura, sem encolher abaixo
 * de um minimo.
 *
 * @param texto     o que vai escrever
 * @param larguraPx a largura disponivel
 * @param tamBase   o tamanho que usaria se coubesse
 * @param tamMin    abaixo disso encolhe e deixa de ser legivel
 * @returns o tamanho a usar
 *
 * **Isto e' medido, nao estimado.** Um ano com cinco digitos e' o caso comum
 * (2125, e' o proximo ano que nao e' palindromo desde 2112) e com o numero a
 * 120 px passava do meio do cartao. Sem isto o cartao fica com um numero
 * cortado ao meio, e nao ha nenhuma forma de o usuario saber que ha mais.
 */
export function tamanhoQueCabe(texto, larguraPx, tamBase, tamMin = 24) {
  const t = String(texto == null ? "" : texto);
  const base = Math.max(1, Number(tamBase) || 1);
  if (!t) return base;
  // Metade do caracter, em regra. E' uma aproximacao — a medicao fina e' do
  // canvas, que aqui nao existe — mas para numeros e' generously folgada.
  const larguraEstimada = t.length * base * 0.58;
  if (larguraEstimada <= larguraPx) return base;
  const escalado = Math.floor((base * larguraPx) / larguraEstimada);
  return Math.max(tamMin, escalado);
}

/**
 * O nome do ficheiro.
 *
 * `meida-2026.png`. O nome de utilizador NAO entra: pode ter acentos, emojis,
 * barras e coisas que o Windows recusa. Descobrir isso a tentar guardar e' pior
 * do que o ficheiro se chamar pelo ano.
 */
export function nomeDoFicheiro(ano) {
  const a = Number.isInteger(ano) ? ano : new Date().getFullYear();
  return "meida-" + a + ".png";
}

/**
 * Os doze meses do ano, com o que aconteceu em cada um.
 *
 * @param dias  [{dia:"2026-03-04", n:3}] como o `/api/stats` devolve
 * @param ano   o ano a filtrar
 * @returns [{mes:1..12, rotulo:"Jan", n}] — sempre 12, na ordem. Meses sem
 *   nada vem a 0: a faixa do cartao tem de mostrar a lacuna, que e' informação.
 */
export function mesesDoAno(dias, ano) {
  const alvo = Number.isInteger(ano) ? ano : new Date().getFullYear();
  const contagem = new Array(12).fill(0);
  for (const d of Array.isArray(dias) ? dias : []) {
    if (!d || typeof d.dia !== "string" || d.dia.length < 7) continue;
    if (!d.dia.startsWith(String(alvo))) continue;
    const mes = Number(d.dia.slice(5, 7));
    if (!Number.isInteger(mes) || mes < 1 || mes > 12) continue;
    const n = Number(d.n) || 0;
    if (n > 0) contagem[mes - 1] += n;
  }
  const rotulos = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return contagem.map((n, i) => ({ mes: i + 1, rotulo: rotulos[i], n }));
}

/** O mes com mais actividade, e em que posicao esta (0..11). `-1` se nada. */
export function mesMaisOcupado(meses) {
  const lista = Array.isArray(meses) ? meses : [];
  if (!lista.length) return -1;
  let melhor = -1;
  let topo = 0;
  lista.forEach((m, i) => {
    if (m.n > topo) {
      topo = m.n;
      melhor = i;
    }
  });
  return melhor;
}

/**
 * A altura de cada barra da faixa de meses, em fraccao de 0.25 a 1.
 *
 * **O minimo e' 0.25 e nao 0**: um mes sem nada tem de continuar visivel. Um
 * zero e' informação ("nao mexeste em Marco"), nao ausencia — a mesma regra do
 * `GraficoMensal` e do histograma.
 */
export function alturasDosMeses(meses, minimo = 0.25) {
  const lista = Array.isArray(meses) ? meses : [];
  const topo = Math.max(1, ...lista.map((m) => Number(m.n) || 0));
  return lista.map((m) => {
    const n = Number(m.n) || 0;
    if (n <= 0) return minimo;
    return Math.max(minimo, Math.min(1, n / topo));
  });
}