import { useMemo } from "react";
import { useT } from "../i18n/I18nContext.jsx";
import { DIAS_SEMANA, semanasDoMapa, maximo, nivel, dataLonga, chaveDia } from "./heatmap.js";

/**
 * Mapa de calor de atividade por dia (o do GitHub).
 *
 * SEM BIBLIOTECA, por decisao do `IDEIAS.md` ("sem biblioteca, e nao por
 * principio"): um quadradinho e' um `<rect>`, e um mapa de um ano sao 371 —
 * menos de 4 KB de JS contra os +70 KB que traria uma libraria de graficos,
 * para um desenho que nao tem pan nem zoom.
 *
 * A matematica (chave do dia, alinhamento das semanas, nivel de cor) esta em
 * `heatmap.js`, sem React, e e' o que `scripts/testar-heatmap.mjs` testa —
 * porque o que da bug aqui e' a data errada numa coluna, que nos ecrans nao se
 * ve.
 *
 * O que o servidor conta e' o MESMO que a racha (`library.updated_at` e as tres
 * datas do `progress`), para os dois numeros concordarem. Entao isto mede
 * "dias em que mexi em alguma coisa", nao "dias em que vi um filme inteiro".
 */
const TAM = 11;        // lado do quadradinho
const VAO = 3;         // espaço entre quadradinhos
const PASSO = TAM + VAO;

export default function HeatmapAtividade({ dias = [], semanas = 53 }) {
  const t = useT();

  const { cols, max, totalDias } = useMemo(() => {
    const m = maximo(dias);
    return {
      cols: semanasDoMapa(dias, { semanas, fim: chaveDia(new Date()) }),
      max: m,
      // "em quantos dias houve alguma coisa" — e' o numero que interessa numa
      // linha, e o que a racha tambem conta.
      totalDias: (dias || []).filter((d) => d && d.n > 0).length,
    };
  }, [dias, semanas]);

  const largura = Math.max(1, cols.length) * PASSO - VAO;
  const altura = DIAS_SEMANA * PASSO - VAO;

  // Meses no topo. Calculados das proprias celulas: quando a chave do dia da
  // coluna muda de mes, escreve-se o nome. Nao ha' uma lista de meses escrita a
  // mao que fique errada quando o mapa muda de tamanho.
  const meses = [];
  let mesAtual = "";
  cols.forEach((col, ci) => {
    const d = col[0]?.dia;
    if (!d) return;
    const mes = d.slice(0, 7);
    if (mes !== mesAtual) {
      meses.push({ i: ci, mes });
      mesAtual = mes;
    }
  });

  if (!totalDias) {
    return (
      <p className="muted heatmap-vazio">
        {t("Sem atividade registada ainda. Assim que marcares ou deres nota a alguma coisa, o mapa enche.")}
      </p>
    );
  }

  return (
    <figure className="heatmap">
      <div className="heatmap-topo" aria-hidden="true">
        {meses.map((m) => (
          <span key={m.mes} style={{ left: m.i * PASSO }}>
            {MESES_CURTOS[Number(m.mes.slice(5, 7)) - 1] || ""}
          </span>
        ))}
      </div>

      <div className="heatmap-corpo">
        <svg
          width={largura}
          height={altura}
          viewBox={`0 0 ${largura} ${altura}`}
          role="img"
          aria-label={t("Atividade por dia")}
        >
          {cols.map((col, ci) =>
            col.map((celula, li) => {
              const x = ci * PASSO;
              const y = li * PASSO;
              const n = nivel(celula.n, max);
              const classe =
                "heatmap-celula" +
                (celula.fora ? " fora" : "") +
                (n ? " n" + n : "");
              // As celulas de fora nao sao dias: nao levam `title` (para o rato
              // nao prometer um dia que nao existe) e nao sao contadas para a
              // leitura por teclado.
              if (celula.fora) return <rect key={x + "-" + y} className={classe} x={x} y={y} width={TAM} height={TAM} rx={2} />;
              return (
                <rect key={x + "-" + y} className={classe} x={x} y={y} width={TAM} height={TAM} rx={2}>
                  <title>
                    {celula.n
                      ? `${dataLonga(celula.dia, t)} — ${t("{n} no dia", { n: celula.n })}`
                      : `${dataLonga(celula.dia, t)} — ${t("sem atividade")}`}
                  </title>
                </rect>
              );
            })
          )}
        </svg>
      </div>

      <figcaption className="heatmap-legenda">
        <span>{t("{n} dias com atividade", { n: totalDias })}</span>
        <span className="heatmap-escala" aria-hidden="true">
          <span>{t("menos")}</span>
          {[0, 1, 2, 3, 4].map((n) => (
            <i key={n} className={"heatmap-celula" + (n ? " n" + n : "")} />
          ))}
          <span>{t("mais")}</span>
        </span>
      </figcaption>
    </figure>
  );
}

// Nomes curtos dos meses, para a linha de cima. Sao os mesmos em portugues e
// em ingles abreviados, por isso nao passam por `t()`.
const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];