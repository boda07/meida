// A vista timeline da biblioteca: linhas cronologicas, do mais recente para o
// mais antigo, agrupadas por mes.
//
// A DATA E' DUAS COISAS E A TIMELINE DIZ QUAL — ver o topo de `timeline.js`.
// Resumido: `watchedAt` e' exacta; quando falta (tudo o que ja estava visto
// antes da migracao 9) vai para um grupo "sem data" no fim, e **nao** se
// substitui pelo `updatedAt`. Mostrar a data do ultimo toque como se fosse a do
// visionamento e' a mentira pequena e comum que esta vista nao conta.
//
// A ordenacao NAO usa a do `Library` (`sort`/`dir`): uma timeline que aceitasse
// "ordenar por titulo" deixava de ser cronologica. Os filtros e a pesquisa
// continuam a aplicar-se — e' a mesma lista, vista de outra maneira.
import { Link } from "react-router-dom";
import { useT } from "../i18n/I18nContext.jsx";
import { gruposDaTimeline, quantosSemData } from "./timeline.js";

/** Um poster (ou o que o lugar dele ocupa enquanto nao ha imagem). */
function Capa({ it, alt }) {
  return (
    <span className="tl-capa">
      {it.poster ? (
        <img src={it.poster} alt="" loading="lazy" />
      ) : (
        <span className="tl-capa-vazia" aria-hidden="true" />
      )}
      <span className="sr-only">{alt}</span>
    </span>
  );
}

export default function Timeline({ itens, tituloDe }) {
  const t = useT();
  const grupos = gruposDaTimeline(itens);
  const semData = quantosSemData(itens);
  const comData = itens.length - semData;

  if (!grupos.length) return null;

  return (
    <div className="tl">
      {/*
        A nota do "sem data" e' o que impede que isto pareca completo. Um
        "março de 2026" com 12 titulos e um "sem data" com 300 e' a mesma coisa
        mostrada de forma diferente; sem este texto, quem chega aqui conclui que
        viu 12 filmes em Marco.
      */}
      {semData > 0 && (
        <p className="tl-nota">
          {t("{n} dos teus títulos vistos não têm data de visionamento: foram marcados antes de a app a guardar. Ficam no fim, sem mês.", {
            n: semData,
          })}
        </p>
      )}
      {comData > 0 && (
        <p className="tl-nota tl-nota-fraca">
          {t("{n} com a data em que os marcaste como vistos.", { n: comData })}
        </p>
      )}

      <ol className="tl-lista">
        {grupos.map((g) => (
          <li key={g.chave} className={`tl-grupo ${g.comData ? "" : "tl-grupo-sem-data"}`}>
            <h3 className="tl-mes">
              {g.comData ? g.rotulo : t("Sem data de visionamento")}
              <span className="tl-mes-n">{g.itens.length}</span>
            </h3>
            <ul className="tl-itens">
              {g.itens.map((it) => (
                <li key={it.type + "-" + it.tmdbId} className="tl-item">
                  {/* A linha vertical do cronologico esta' no `::before` do CSS,
                      aqui dentro do `li` para nao precisar de um elemento a
                      mais so' para a linha. */}
                  <Capa it={it} alt={tituloDe(it)} />
                  <span className="tl-texto">
                    <Link className="tl-titulo" to={`/details/${it.type}/${it.tmdbId}`}>
                      {tituloDe(it)}
                    </Link>
                    {it.year ? <span className="tl-ano">{it.year}</span> : null}
                    {it.score != null ? (
                      <span className="tl-nota-num">{it.score}</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}