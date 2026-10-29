import { useMemo, useRef, useState } from "react";
import { useT } from "../i18n/I18nContext.jsx";
import {
  DIAS_SEMANA,
  ROTULOS_DIA,
  ABREVIATURA_DIA,
  semanasDoMapa,
  maximo,
  nivel,
  textoDoDia,
  chaveDia,
} from "./heatmap.js";
import { useHeatmapDestaque } from "./useHeatmapDestaque.js";
import { useHeatmapPeriodo } from "./useHeatmapPeriodo.js";

/**
 * Mapa de calor de atividade por dia (o do GitHub).
 *
 * SEM BIBLIOTECA, por decisao do `IDEIAS.md` ("sem biblioteca, e nao por
 * principio"): um quadradinho e' um `<rect>`, e um mapa de um ano sao 371 —
 * menos de 4 KB de JS contra os +70 KB que traria uma libraria de graficos,
 * para um desenho que nao tem pan nem zoom.
 *
 * A matematica (chave do dia, alinhamento das semanas, nivel de cor) esta em
 * `heatmap.js`, sem React, e e' o que `scripts/testar-heatmap.mjs` testa.
 */
const TAM = 11;        // lado do quadradinho
const VAO = 3;         // espaco entre quadradinhos
const PASSO = TAM + VAO;
// A altura da linha de meses (`.heatmap-topo`). Tem de bater certo com o CSS.
const ALTURA_TOPO = 16;

// Nomes curtos dos meses, para a linha de cima. Sao os mesmos em portugues e
// em ingles abreviados, por isso nao passam por `t()`.
const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export default function HeatmapAtividade({ dias = [], semanas = undefined }) {
  const t = useT();

  // Destaque/tooltip (posicao medida, preso por toque, fechar com Esc).
  const { destaque, setDestaque, mostrar, soltar, dicaRef } = useHeatmapDestaque();

  // Periodos disponiveis e aquele que esta selecionado.
  const { periodos, escolhido, setEscolhido, semanasAtivas } = useHeatmapPeriodo({ dias, semanas });

  const { cols, max, totalDias } = useMemo(() => {
    const m = maximo(dias);
    return {
      cols: semanasDoMapa(dias, { semanas: escolhido || semanasAtivas, fim: chaveDia(new Date()) }),
      max: m,
      totalDias: (dias || []).filter((d) => d && d.n > 0).length,
    };
  }, [dias, escolhido, semanasAtivas]);

  const largura = Math.max(1, cols.length) * PASSO - VAO;
  const altura = DIAS_SEMANA * PASSO - VAO;

  // Meses no topo: quando a chave do dia da coluna muda de mes, escreve-se o nome.
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
    <figure
      className="heatmap"
      style={{ "--passo": PASSO + "px", "--topo": ALTURA_TOPO + "px" }}
    >
      {/* Os rotulos ficam numa coluna propria, a NAO SCROLL. */}
      <div className="heatmap-lateral" aria-hidden="true">
        <i className="heatmap-lateral-vazio" />
        {ROTULOS_DIA.map((li) => (
          <span key={li} style={{ gridRow: li + 2 }}>
            {ABREVIATURA_DIA[li]}
          </span>
        ))}
      </div>

      {/* O que desliza: os meses e a grelha andam juntos. */}
      <div className="heatmap-scroll">
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
                  "heatmap-celula" + (celula.fora ? " fora" : "") + (n ? " n" + n : "");
                if (celula.fora)
                  return <rect key={x + "-" + y} className={classe} x={x} y={y} width={TAM} height={TAM} rx={2} />;
                return (
                  <rect key={x + "-" + y} className={classe} x={x} y={y} width={TAM} height={TAM} rx={2}
                    onMouseEnter={(ev) => mostrar(celula, false, ev)}
                    onMouseLeave={() => soltar(celula)}
                    onFocus={(ev) => mostrar(celula, false, ev)}
                    onBlur={() => soltar(celula)}
                    onClick={(ev) => mostrar(celula, true, ev)}
                  >
                    {destaque && destaque.dia === celula.dia && !destaque.fora && (
                      <text className="heatmap-leitura" x={x} y={y}>
                        {celula.n}
                      </text>
                    )}
                  </rect>
                );
              })
            )}
          </svg>
        </div>
      </div>

      {/* O periodo. */}
      <div className="heatmap-periodos" role="group" aria-label={t("Periodo mostrado")}>
        {periodos.map((p) => (
          <button
            key={p.semanas + "-" + p.n}
            type="button"
            className={"heatmap-periodo" + (semanasAtivas === p.semanas ? " active" : "")}
            onClick={() => setEscolhido(p.semanas)}
            aria-pressed={semanasAtivas === p.semanas}
          >
            {p.tudo ? t("tudo") : t(p.chave, { n: p.n })}
          </button>
        ))}
      </div>

      {/* O fundo: so existe quando o texto veio de um toque. */}
      {destaque && destaque.preso && (
        <button type="button" className="heatmap-fundo" aria-label={t("Fechar")} onClick={() => setDestaque(null)} />
      )}

      {/* O texto no DOM, nao um <title>: funciona ao toque e um teste o consegue ler. */}
      {destaque && (
        <div className="heatmap-dica" role="status" ref={dicaRef} style={{ left: destaque.x + "px", top: destaque.y + "px" }}>
          {textoDoDia(destaque, t)}
        </div>
      )}

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
