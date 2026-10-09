// Histograma das notas, em SVG puro.
//
// Sem biblioteca pelo mesmo motivo do `GraficoMensal`: uma barra e' um <rect>`.
// Aqui sao 10 barras (uma por faixa de 10 pontos), nao 12 meses — mas a mecanica
// e' a mesma, e duplicar um ficheiro de 4 KB seria pior.
//
// Duas coisas que o histogram tem de acertar e o grafico de meses nao:
//
//   - **A escala e' fixa (0 ao maximo real), e nao um "numero bonito".** Num
//     grafico de meses um topo arredondado e' bonito; num histograma mentiria — as
//     faixas ficariam todas a parecer igualmente cheias. Aqui topo = maximo.
//   - **Uma faixa vazia continua visivel**, com 3 px como os meses. O zero e'
//     informacao: "ninguem te deu nota abaixo de 40" e' parte da leitura.
const L = 600;
const A = 200;
const M = { topo: 14, dir: 8, base: 30, esq: 26 };
const P = A - M.topo - M.base;
const U = L - M.esq - M.dir;

/**
 * @param barras [{de, a, n}] as 10 faixas, ja ordenadas
 */
export default function HistogramaNotas({ barras }) {
  const dados = Array.isArray(barras) ? barras : [];
  if (!dados.length) return null;

  const maximo = Math.max(...dados.map((b) => b.n), 1);
  const passoX = U / dados.length;
  const largura = Math.min(48, passoX * 0.66);
  const total = dados.reduce((a, b) => a + b.n, 0);
  // Com poucas notas o eixo X fica ilegivel (10 rotulos de "30-40" numa linha de
  // 50 px). A partir de 6 faixas mostram-se as duas pontas, o resto fica no
  // title do rato.
  const poucas = dados.length <= 6;

  return (
    <figure className="hs">
      <svg
        viewBox={`0 0 ${L} ${A}`}
        width="100%"
        height={A}
        role="img"
        aria-label={`Distribuicao de ${total} notas. ${dados
          .filter((b) => b.n)
          .map((b) => `${b.de} a ${b.a}: ${b.n}`)
          .join(", ")}.`}
      >
        {[0, 0.5, 1].map((f) => {
          const y = M.topo + P - f * P;
          return (
            <g key={f}>
              <line x1={M.esq} x2={L - M.dir} y1={y} y2={y} className="gm-guia" />
              <text x={M.esq - 6} y={y + 3.5} className="gm-num" textAnchor="end">
                {Math.round(maximo * f)}
              </text>
            </g>
          );
        })}

        {dados.map((b, i) => {
          const h = b.n === 0 ? 3 : Math.max(3, (b.n / maximo) * P);
          const x = M.esq + i * passoX + (passoX - largura) / 2;
          return (
            <rect
              key={b.de}
              x={x}
              y={M.topo + P - h}
              width={largura}
              height={h}
              rx={Math.min(5, largura / 2)}
              className={`gm-barra ${b.n === 0 ? "vazia" : ""}`}
            >
              <title>{`${b.de} a ${b.a}: ${b.n} ${b.n === 1 ? "título" : "títulos"}`}</title>
            </rect>
          );
        })}

        {dados.map((b, i) => {
          // Rotulos de duas em duas, ou so' as pontas. Dez rotulos de dois digitos nao
          // cabem num telefone e a leitura fica pior do que omitir.
          const mostrar = poucas || i % 2 === 0 || i === dados.length - 1;
          if (!mostrar) return null;
          return (
            <text
              key={`x${b.de}`}
              x={M.esq + i * passoX + passoX / 2}
              y={A - 11}
              className="gm-rot"
              textAnchor="middle"
            >
              {b.de}
            </text>
          );
        })}
      </svg>
      <figcaption className="gm-legenda">
        {total} título{total === 1 ? "" : "s"} com nota, por faixa de 10 pontos. Passa o
        rato sobre uma barra para o número exacto.
      </figcaption>
    </figure>
  );
}