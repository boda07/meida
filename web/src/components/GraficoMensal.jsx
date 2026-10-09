// Grafico de barras verticais em SVG puro, para as estatisticas do perfil.
//
// Porquê SVG escrito à mão e não uma biblioteca: uma coluna e' um <rect> com
// `height` em %, o que na MEIDA é literalmente o `.pa-chart` do projecto antigo
// (RAI PAP / ProdSound) sem CSS. O que a biblioteca traz — pan, zoom, legendas
// interactivas, animações de entrada — nao é usado aqui, e custaria +70 a +200 KB
// num bundle que hoje tem 1434 KB. Este ficheiro inteiro tem menos de 4 KB.
//
// DECISÕES que não são óbvias:
//
// - **A escala cresce contra o MAIOR mes, não contra o total.** Sem isto a barra
//   mais alta ocupa sempre o topo e as outras somem — o mesmo motivo que a
//   `ProfileStats` já documenta para as barras horizontais. Aqui duplica porque
//   o contraste e' mais duro: 12 meses contra um so' eixo.
//
// - **`yMin = 4px` em vez de 0.** Um mes sem actividade tem de continuar visivel.
//   Um zero e' informacao ("nao mexeste"), nao ausencia. O mesmo que o
//   `min-height:4px` do outro projecto.
//
// - **Sem `<title>` dentro do SVG e sem tooltips de biblioteca.** A informação
//   esta' no DOM e no `aria-label`, que e' o que o leitor de ecra le. Um tooltip
//   que so aparece com o rato e' invisivel para quem navega pelo teclado, e um
//   grafico de barras com 12 colunas le-se melhor sem essa ajuda.
//
// - **A coluna e' um `<g>` com `role="img"` e um `aria-label` descritivo**, e o
//   rect dentro. Assim o leitor de ecra diz "Mar: 4 titulos" em vez de contar
//   rectangulos.
//
// - **`viewBox` com largura 100 e altura 100, e o desenho escalado por
//   `preserveAspectRatio="none"`.** Nao: distorceria os cantos arredondados. O
//   desenho e' em unidades reais (a largura vem de uma constante) e o SVG e'
//   responsivo por CSS (`width:100%`), o que mantem o `rx` proporcional.
import { useId, useState } from "react";
import { rotuloEixo } from "./profileStats.js";

// Altura total em unidades de desenho. A largura e' 100%; o `viewBox` usa a
// largura real porque os cantos arredondados nao podem distorcer.
const L = 600;
const A = 190; // altura da area do grafico
const M = { topo: 14, dir: 8, base: 26, esq: 26 };

const P = A - M.topo - M.base; // altura util
const U = L - M.esq - M.dir; // largura util

/**
 * @param serie  o que `serieMensal()` devolve: [{chave, rotulo, n, mes, ano}]
 */
export default function GraficoMensal({ serie }) {
  // O `useId` serve para o `clipPath` — dois graficos na mesma pagina nao podem
  // partilhar o mesmo id, senao o um recorta o outro.
  const id = useId();
  const [foco, setFoco] = useState(null);

  const dados = Array.isArray(serie) ? serie : [];
  // Sem dados suficientes nao ha grafico: uma linha so' e' ruido, e dois pontos
  // nao fazem uma serie. Abaixo disso a UI diz o que quiser em vez de desenhar.
  if (dados.length < 3) return null;

  const maximo = Math.max(...dados.map((d) => d.n), 1);
  // Escala "bonita": arredonda o topo para um numero que dê um número inteiro de
  // passos. Sem isto o eixo pode dizer 7 e a barra mais alta ficar a 7/7 — ou o
  // utilizador ver um eixo com 3,3333 casas.
  const passo = escalaBonita(maximo);
  const topo = Math.max(passo, Math.ceil(maximo / passo) * passo);

  const passoX = U / dados.length;
  const larguraBarra = Math.min(38, passoX * 0.62);
  const total = dados.reduce((a, d) => a + d.n, 0);

  // Anos diferentes no eixo? Se sim, o primeiro mes de cada ano leva o ano.
  const mudaAno = new Set(dados.map((d) => d.ano)).size > 1;

  return (
    <figure className="gm">
      <svg
        viewBox={`0 0 ${L} ${A}`}
        width="100%"
        height={A}
        role="img"
        aria-label={`Titulos com actividade por mes. ${dados
          .filter((d) => d.n > 0)
          .map((d) => `${rotuloEixo(d, mudaAno)}: ${d.n}`)
          .join(", ")}.`}
        onMouseLeave={() => setFoco(null)}
      >
        <defs>
          <clipPath id={id}>
            <rect x={0} y={0} width={L} height={M.topo + P} />
          </clipPath>
        </defs>

        {/* Linhas de guiao + os numeros do eixo Y. Três linhas chega: mais que
            isso enche o grafico de ruido. */}
        {[0, 0.5, 1].map((f) => {
          const y = M.topo + P - f * P;
          const valor = Math.round(topo * f);
          return (
            <g key={f}>
              <line x1={M.esq} x2={L - M.dir} y1={y} y2={y} className="gm-guia" />
              <text x={M.esq - 6} y={y + 3.5} className="gm-num" textAnchor="end">
                {valor}
              </text>
            </g>
          );
        })}

        <g clipPath={`url(#${id})`}>
          {dados.map((d, i) => {
            // A altura e' contra o TOPO da escala, nao contra o maximo real: assim
            // as barras sao comparaveis entre si mesmo que o topo "bonito" tenha
            // folga.
            const h = d.n === 0 ? 3 : Math.max(3, (d.n / topo) * P);
            const x = M.esq + i * passoX + (passoX - larguraBarra) / 2;
            const y = M.topo + P - h;
            const activo = foco === i;
            // O className junta-se com filtro em vez de por interpolacao: a
            // interpolacao deixava "gm-barra  vazia" com dois espacos quando nao
            // havia "on", e um seletor `.gm-barra.vazia` ainda pegava mas um
            // teste por texto exato nao.
            const classe = ["gm-barra", activo ? "on" : "", d.n === 0 ? "vazia" : ""]
              .filter(Boolean)
              .join(" ");
            return (
              <rect
                key={d.chave}
                x={x}
                y={y}
                width={larguraBarra}
                height={h}
                rx={Math.min(5, larguraBarra / 2)}
                className={classe}
                onMouseEnter={() => setFoco(i)}
              />
            );
          })}
        </g>

        {/* O valor aparece em cima da coluna que esta' sob o rato. So' esse: um
            numero em todas as 12 colunas seria ilegivel e a barra ja' diz o
            resto. */}
        {foco !== null && dados[foco].n > 0 && (
          <text
            x={M.esq + foco * passoX + passoX / 2}
            y={M.topo + P - (dados[foco].n / topo) * P - 6}
            className="gm-valor"
            textAnchor="middle"
          >
            {dados[foco].n}
          </text>
        )}

        {/* Eixo X: um rotulo de dois em dois, e sempre o ano quando muda. Sem
            isso, 12 rotulos de 3 letras nao cabem no telefone. */}
        {dados.map((d, i) => {
          const mudancaDeAno = mudaAno && i > 0 && dados[i - 1].ano !== d.ano;
          const mostrar = i === 0 || mudancaDeAno || i % 2 === 1;
          if (!mostrar) return null;
          return (
            <text
              key={`x-${d.chave}`}
              x={M.esq + i * passoX + passoX / 2}
              y={A - 9}
              className={`gm-rot ${mudancaDeAno ? "gm-ano" : ""}`}
              textAnchor="middle"
            >
              {rotuloEixo(d, mudaAno)}
            </text>
          );
        })}
      </svg>

      <figcaption className="gm-legenda">
        {total} título{total === 1 ? "" : "s"} com actividade nos últimos{" "}
        {dados.length} meses. O que conta é a última vez que mexeste em cada um — a
        nota que deste, o momento em que o puseste na lista.
      </figcaption>
    </figure>
  );
}

/**
 * Um "passo" de escala com valor redondo: 1, 2, 5, 10, 20, 50, 100…
 *
 * @returns {number} o passo (nao o topo — o topo e' multiplo disto)
 */
/**
 * O passo do eixo Y: 1, 2, 5, 10, 20, 50, 100, 200, 500…
 *
 * Escolhe-se procurando, e NAO pela mantissa do maximo. A diferenca viu-se no
 * grafico real do perfil: com o mes mais cheio em 527, a escolha pela mantissa
 * dava passo 1000 (porque 5,27 e' "acima de 5") e o topo ficava 1000 — o eixo
 * dizia 0/500/1000 com a barra mais alta a 53% da altura, metade do grafico
 * vazia. Procurando o passo que da entre 2 e 6 degraus e o topo mais apertado,
 * o passo 100 dá topo 600 e a barra fica a 88%: o grafico aproveita-se.
 *
 * @returns {number} o passo (nao o topo — o topo e' multiplo disto)
 */
export function escalaBonita(maximo) {
  // Guarda antes de tudo: sem isto, `Infinity` chegava ao `Math.log10` e
  // `escalaDeRecurso` devolvia NaN — e uma escala NaN deixa o grafico em branco.
  if (!Number.isFinite(maximo) || maximo <= 0) return 1;
  let melhor = null;
  for (let expoente = 0; expoente <= 6; expoente++) {
    const potencia = Math.pow(10, expoente);
    for (const m of [1, 2, 5, 10]) {
      const passo = m * potencia;
      if (passo > maximo * 10) continue; // absurdo de grande
      const degraus = Math.ceil(maximo / passo);
      // Menos de 2 degraus e' um eixo sem meio termo; mais de 6 enche o grafico
      // de linhas que nao ajudam a ler.
      if (degraus < 2 || degraus > 6) continue;
      const topo = degraus * passo;
      // O que se minimiza e' o TOPO (a barra mais alta ocupa o maximo de altura
      // possivel), nao o numero de degraus. Minimizar os degraus dava o
      // contrario: com maximo 527 escolhia passo 500 (topo 1000, barra a 53%)
      // em vez de passo 100 ou 200 (topo 600, barra a 88%). Empate no topo
      // desempata-se nos degraus, para o eixo ter menos linhas.
      if (
        melhor === null ||
        topo < melhor.topo ||
        (topo === melhor.topo && degraus < melhor.degraus)
      ) {
        melhor = { passo, topo, degraus };
      }
    }
  }
  return melhor ? melhor.passo : escalaDeRecurso(maximo);
}

/** Ultimo recurso: se nenhum passo "redondo" servir (maximo enorme ou 1), o
 *  proprio maximo arredondado para cima. */
function escalaDeRecurso(maximo) {
  if (!Number.isFinite(maximo) || maximo <= 0) return 1;
  if (maximo <= 2) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(maximo)) - 1);
  return Math.ceil(maximo / mag) * mag;
}