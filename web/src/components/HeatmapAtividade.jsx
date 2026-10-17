import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useT } from "../i18n/I18nContext.jsx";
import {
  DIAS_SEMANA,
  ROTULOS_DIA,
  ABREVIATURA_DIA,
  PERIODOS,
  PERIODO_OMISSAO,
  semanasAte,
  semanasDoMapa,
  maximo,
  nivel,
  textoDoDia,
  chaveDia,
} from "./heatmap.js";

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
// A altura da linha de meses (`.heatmap-topo`). Tem de bater certo com o CSS,
// senao os rotulos dos dias ficam uma linha ACIMA da linha que nomeiam — que e'
// pior do que nao ter rotulo nenhum, porque parece Correcto. `testar-heatmap.mjs`
// compara os dois.
const ALTURA_TOPO = 16;

export default function HeatmapAtividade({ dias = [], semanas = PERIODO_OMISSAO }) {
  const t = useT();
  // O periodo escolhido. `null` = o que o utilizador nao mexeu, que e' o
  // `semanas` que veio de cima. Guarda-se `null` e nao o numero para que a
  // escolha por omissao siga o que o resto da app pedir (e nao fique presa num
  // ano que ja nao e' o certo).
  const [escolhido, setEscolhido] = useState(null);
  // O dia que o texto esta a descrever. `preso` =veio de um toque, e fica ate
  // alguém tocar outra vez (num rato, basta sair e voltar a entrar).
  //
  // **Nao e' o `<title>` do SVG.** Esse e' um tooltip do browser: aparece com o
  // rato e NUNCA com o dedo — e a app usa-se muito ao toque. Alem disso nao da
  // para saber se apareceu: vive fora do DOM, por isso nenhum teste o alcanca.
  // Aqui o texto esta' no DOM e pode ser medido.
  const [destaque, setDestaque] = useState(null);
  // O texto no ecra. Fica junto da celula, e nao onde o rato esta': assim no
  // toque o tooltip aparece *sobre* o dia, e o dedo tapa o quadradinho e nao o
  // texto.
  //
  // A posicao vem das medidas REAIS do quadradinho (e nao de `x * PASSO`): a
  // grelha e' mais larga do que o mapa quando o mapa esta' a deslizar, e com
  // numeros do SVG o texto aparecia deslocado para a esquerda.
  const mostrar = (celula, preso = false, ev = null) => {
    if (!celula || celula.fora) return;
    const alvo = ev?.currentTarget;
    let x = 0;
    let y = 0;
    if (alvo) {
      const r = alvo.getBoundingClientRect();
      // Coordenadas DO ECRÃ, e o texto e' `position: fixed`. Prender-o a figura
      // parecia mais simples e era errado: as colunas da direita estao no mapa
      // que desliza, que vai para alem da figura, e a margem arrastava o texto
      // 120 px para dentro — o texto deixava de estar sobre o dia que descrevia.
      x = r.left + r.width / 2;
      y = r.top;
    }
    setDestaque({ ...celula, preso, x, y });
  };
  // O texto ja esta' no ecra; agora que se sabe QUANTO mede, puxa-se para dentro
  // das margens. Medir em vez de adivinhar uma margem fixa: "20 de outubro de
  // 2026 — 3 séries" tem 240 px e "3 séries" tem 60, e com um numero fixo o
  // texto saia do ecra num dos dois.
  const dica = useRef(null);
  useLayoutEffect(() => {
    const el = dica.current;
    if (!el || !destaque) return;
    const meia = el.offsetWidth / 2 + 8;
    const x = Math.max(meia, Math.min(destaque.x, window.innerWidth - meia));
    if (x !== destaque.x) setDestaque((d) => (d ? { ...d, x } : d));
  }, [destaque]);
  // Sair com o rato esconde, a nao ser que o texto tenha vindo de um toque (nesse
  // caso o dedo sai do ecra antes do rato entrar e o texto desaparecia).
  // Esconder so' quando se sai de OUTRO dia: com o dedo, o `mouseleave` dispara
  // sem que o dedo tenha saido do quadradinho, e o texto desaparecia ao toque.
  const soltar = (celula) => {
    setDestaque((d) => (d && d.preso && d.dia !== celula.dia ? d : null));
  };
  // Esc fecha o que ficou preso por um toque.
  useEffect(() => {
    if (!destaque || !destaque.preso) return;
    const aoTeclar = (e) => { if (e.key === "Escape") setDestaque(null); };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [destaque]);

  const { cols, max, totalDias } = useMemo(() => {
    const m = maximo(dias);
    return {
      cols: semanasDoMapa(dias, { semanas: escolhido || semanas, fim: chaveDia(new Date()) }),
      max: m,
      // "em quantos dias houve alguma coisa" — e' o numero que interessa numa
      // linha, e o que a racha tambem conta.
      totalDias: (dias || []).filter((d) => d && d.n > 0).length,
    };
  }, [dias, semanas, escolhido]);

  // O botao "tudo": as semanas necessarias para cobrir a historia toda, mais os
  // periodos fixos. Vao para o mesmo `escolhido`, que e' o que o mapa le.
  const periodos = useMemo(() => {
    const tudo = semanasAte(dias);
    const lista = PERIODOS.map((p) => ({ ...p, semanas: Math.min(p.semanas, tudo) }));
    // Sumi-lo se nada acrescentar: com meia semana de atividade, "3 anos" e
    // "tudo" eram o mesmo botao com nomes diferentes.
    const filtrados = lista.filter((p, i) => i === 0 || p.semanas < lista[i - 1].semanas);
    return [...filtrados, { semanas: tudo, chave: "{n} tudo", n: 0, tudo: true }];
  }, [dias]);

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

  // As medidas da figura sao posto por AQUI e nao escritas no CSS de novo: o mapa
  // tem 7 linhas de `PASSO` e uma de meses, e o rotulo do dia tem de cair na MESMA
  // linha que a celula que nomeia. Dois numeros separados (um no JSX, outro no
  // CSS) divergem no primeiro refactor e o "seg" alinha com o domingo sem ninguem
  // dar por isso — parece correcto, que e' o que o torna pior.
  return (
    <figure
      className="heatmap"
      style={{ "--passo": PASSO + "px", "--topo": ALTURA_TOPO + "px" }}
    >
      {/* Os rotulos ficam numa coluna propria, a NAO SCROLL: e' o que o GitHub
          faz. Dentro da grelha, o "seg" deslizava para fora do ecra assim que
          se mexe no mapa. Sao linhas de uma grelha CSS (e nao `absolute`) porque
          uma caixa cujos filhos sao `absolute` mede zero — e a coluna ficava com
          0 px de largura, com o "seg" por cima da primeira coluna do mapa. */}
      <div className="heatmap-lateral" aria-hidden="true">
        <i className="heatmap-lateral-vazio" />
        {ROTULOS_DIA.map((li) => (
          <span key={li} style={{ gridRow: li + 2 }}>
            {ABREVIATURA_DIA[li]}
          </span>
        ))}
      </div>

      {/* O que desliza: os meses e a grelha andam juntos, para o mes estar
          sempre por cima da coluna a que pertence. */}
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
                // As celulas de fora nao sao dias: nao levam `title` (para o rato
                // nao prometer um dia que nao existe) e nao sao contadas para a
                // leitura por teclado.
                if (celula.fora)
                  return <rect key={x + "-" + y} className={classe} x={x} y={y} width={TAM} height={TAM} rx={2} />;
                // Sem `preventDefault` no toque: um toque no quadradinho e' um toque, e o texto
                // e' a resposta. No toque o texto fica preso (ate tocar outra vez
                // ou carregar em Esc) porque o dedo sai do ecra antes de se entrar
                // em outro dia.
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

      {/* O periodo. GitHub tem o mesmo selector ao lado do mapa. */}
      <div className="heatmap-periodos" role="group" aria-label={t("Período mostrado")}>
        {periodos.map((p) => (
          <button
            key={p.semanas + "-" + p.n}
            type="button"
            className={"heatmap-periodo" + ((escolhido || semanas) === p.semanas ? " active" : "")}
            onClick={() => setEscolhido(p.semanas)}
            aria-pressed={(escolhido || semanas) === p.semanas}
          >
            {p.tudo ? t("tudo") : t(p.chave, { n: p.n })}
          </button>
        ))}
      </div>

      {/* O fundo: so' existe quando o texto veio de um toque, e so' para
          fechar o texto tocando fora dele. No rato nao ha fundo nenhum — senao
          ficava um painel invisivel por cima do mapa a comer os cliques. */}
      {destaque && destaque.preso && (
        <button type="button" className="heatmap-fundo" aria-label={t("Fechar")} onClick={() => setDestaque(null)} />
      )}

      {/* O texto. No DOM, e nao um `<title>`: e' por isso que funciona ao
          toque e que um teste o consegue ler. */}
      {destaque && (
        <div className="heatmap-dica" role="status" ref={dica} style={{ left: destaque.x + "px", top: destaque.y + "px" }}>
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

// Nomes curtos dos meses, para a linha de cima. Sao os mesmos em portugues e
// em ingles abreviados, por isso nao passam por `t()`.
const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];