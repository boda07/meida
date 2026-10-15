// O anel de progresso da meta, em SVG puro.
//
// Sem biblioteca pelo mesmo motivo do `GraficoMensal` e do heatmap: um anel e'
// um `<circle>` com `stroke-dasharray` e `stroke-dashoffset`, e a matematica
// esta' em `metas.js` (testada). O ficheiro todo tem menos de 3 KB.
//
// TRÊS COISAS QUE O ANEL TEM DE ACERTAR:
//
//   - **Roda -90 graus.** Um `stroke-dasharray` comeca as 3 horas. Sem o
//     `rotate(-90 …)` a meta "enche" a partir da direita, e toda a gente
//     espera que encha a partir de cima.
//
//   - **`width`/`height` no `<svg>`, alem do `viewBox`.** Sem os dois o SVG
//     fica com 0x0 e o anel desaparece. O `testar-svg.mjs` existe por causa de
//     um icone que ficou assim durante varias versoes.
//
//   - **`role="img"` e um `aria-label` que diz o numero.** O leitor de ecra nao
//     le um `stroke-dashoffset`; sem o rotulo a meta e' um desenho vazio. E o
//     rotulo tem de conter a PROGRESSO por extenso, nao so "anel".
import { anel } from "./metas.js";
import { useT } from "../i18n/I18nContext.jsx";

/**
 * @param percent   0 a 1 (ja vem limitado por `anel()`)
 * @param atingidos o numero real, para o centro do anel
 * @param alvo      o alvo escolhido
 * @param tam       o lado do SVG em px
 */
export default function AnelMeta({ percent, atingidos, alvo, tam = 96 }) {
  const t = useT();
  const espessura = Math.max(6, Math.round(tam / 12));
  // O raio tem de deixar sitio para a espessura E para o numero dentro: e' o
  // `espessura / 2` que impede o traço de sair da caixa.
  const raio = (tam - espessura) / 2 - 2;
  const cx = tam / 2;
  const cy = tam / 2;
  const geo = anel(percent, raio);
  const n = Math.max(0, Number(atingidos) || 0);
  const a = Math.max(1, Number(alvo) || 0);
  const cumprida = n >= a;

  const descricao = cumprida
    ? t("Meta cumprida: {n} de {a}.", { n, a })
    : t("{n} de {a}. Faltam {f}.", { n, a, f: a - n });

  return (
    <svg
      viewBox={`0 0 ${tam} ${tam}`}
      width={tam}
      height={tam}
      className={`anel-meta ${cumprida ? "cumprida" : ""}`}
      role="img"
      aria-label={descricao}
    >
      {/* A pista: o circulo de fundo, sempre completo. */}
      <circle
        cx={cx}
        cy={cy}
        r={raio}
        fill="none"
        stroke="#2a2a31"
        strokeWidth={espessura}
        className="anel-meta-pista"
      />
      {/* O arco. `stroke-linecap="round"` faz a ponta redonda — mas o traço
          ENCURTA com a ponta, o que a 0% ainda deixa um bocado visivel. Por
          isso so' se desenha o arco acima de 0.

          O `stroke` aponta para a COR e nao usa `currentColor`: o acento
          escuro nao passa o contraste da WCAG em TEXTO, e um traço nao e'
          texto. O acento inteiro e' o que se quer aqui, por isso escreve-se o
          `stroke` direto — e nao se contorna a regra com `--accent-text`, que
          daria um anel mais claro sem ser para isso. */}
      {geo.traco > 0 && (
        <circle
          cx={cx}
          cy={cy}
          r={raio}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={espessura}
          strokeLinecap="round"
          strokeDasharray={geo.d}
          strokeDashoffset={geo.folga}
          className="anel-meta-arco"
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      )}
      {/* O numero no meio. `dominant-baseline="central"` e' o que o centra sem
          andar a adivinhar valores de `y` conforme a fonte do sistema. */}
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        className="anel-meta-num"
      >
        {n}
      </text>
    </svg>
  );
}