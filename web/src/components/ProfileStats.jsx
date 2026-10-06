// A aba "Estatisticas" do perfil.
//
// Os numeros vem todos de `detalheStats()`, que os calcula no cliente a partir
// da biblioteca que a API ja devolveu. Nao ha pedidos extra ao servidor.
//
// A forma e' uma coluna de barras com o rotulo a esquerda, a barra ao meio e o
// numero a direita. Escolhi barra e nao grafico circular por uma razao: sao
// cinco a oito categorias com contagens muito diferentes, e a barra deixa-as
// comparar de relance — num grafico circular seria preciso ler o angulo.
//
// A barra e' desenhada contra o MAIOR valor do bloco, nao contra o total. Sem
// isso a barra mais alta ocuparia sempre a largura toda e as outras sumiriam
// (o "Series 12" de um perfil com 412 animes virava um risco de 1px).
import { Link } from "react-router-dom";
import { imageUrl } from "../api/client.js";
import { detalheStats } from "./profileStats.js";

/** Uma linha: rotulo, barra, numero. A barra cresce contra o maior do bloco. */
function Linha({ nome, n, maior }) {
  const pct = maior > 0 ? Math.max(2, Math.round((n / maior) * 100)) : 0;
  return (
    <div className="st-row">
      <span className="st-name" title={nome}>
        {nome}
      </span>
      <span className="st-bar" aria-hidden="true">
        <span className="st-fill" style={{ width: `${pct}%` }} />
      </span>
      <span className="st-n">{n}</span>
    </div>
  );
}

/** Um bloco de barras com titulo: "Generos", "Tipos", "Notas". */
function Bloco({ titulo, nota, linhas, maior }) {
  return (
    <section className="st-bloco">
      <div className="st-bloco-topo">
        <h3 className="st-titulo">{titulo}</h3>
        {nota && <span className="st-nota">{nota}</span>}
      </div>
      <div className="st-linhas">
        {linhas.map((l) => (
          <Linha key={l.nome} nome={l.nome} n={l.n} maior={maior} />
        ))}
      </div>
    </section>
  );
}

/**
 * @param items  a biblioteca completa (`null` enquanto carrega)
 */
export default function ProfileStats({ items }) {
  if (items === null) return <p className="muted st-vazio">A carregar...</p>;
  if (!items.length) {
    return (
      <p className="muted st-vazio">
        Ainda nao ha titulos na biblioteca, por isso ainda nao ha nada para
        contar.
      </p>
    );
  }

  const s = detalheStats(items);

  // Os "top titulos" sao os cinco mais vistos, ou os cinco com nota mais alta
  // quando a pessoa ainda nao viu nada — para o bloco nunca ficar vazio num
  // perfil novo.
  const maisVistos = items
    .filter((it) => it.watched)
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, 5);
  const emAlta = items
    .filter((it) => !it.watched && it.watchlist)
    .slice(0, 5);
  const destaque = maisVistos.length ? maisVistos : emAlta;
  const rotuloDestaque = maisVistos.length ? "Mais vistos" : "Na lista";

  return (
    <div className="st">
      {/* As tres medidas que resumem a biblioteca, como numeros e nao como
          grafico — porque sao tres valores, e tres valores leem-se melhor
          escritos. */}
      <dl className="st-cabecalho">
        <div className="st-cifra">
          <dt>títulos</dt>
          <dd>{s.total}</dd>
        </div>
        <div className="st-cifra">
          <dt>com nota</dt>
          <dd>{s.comNota}</dd>
        </div>
        {s.media !== null && (
          <div className="st-cifra">
            <dt>média</dt>
            <dd>{s.media}</dd>
          </div>
        )}
        {s.mediana !== null && (
          <div className="st-cifra">
            <dt>mediana</dt>
            <dd>{s.mediana}</dd>
          </div>
        )}
      </dl>

      {/* Media E mediana juntas: quando as duas batem certo, as notas estao
          todas pelo mesmo lado; quando a media e' maior, ha poucos titulos com
          nota altissima a puxar a media. E' a leitura que uma barra sozinha nao
          dava. */}
      {s.comNota > 0 && (
        <p className="st-frase">
          Notas entre <strong>{s.maisBaixa}</strong> e <strong>{s.maisAlta}</strong>.{" "}
          {s.media === s.mediana
            ? "A média bate certo com a mediana, por isso as notas estão todas pela mesma banda."
            : s.media > s.mediana
              ? "A média está acima da mediana: poucos títulos com nota muito alta estão a puxar a média para cima."
              : "A média está abaixo da mediana: há muitos títulos bem avaliados a puxar a média para baixo."}
        </p>
      )}

      {s.generos.length > 0 && (
        <Bloco
          titulo="Géneros"
          nota={
            s.totalGeneros > s.generos.length
              ? `${s.generos.length} de ${s.totalGeneros}`
              : undefined
          }
          linhas={s.generos}
          maior={s.generos[0].n}
        />
      )}

      {s.tipos.length > 1 && (
        <Bloco titulo="Tipos" linhas={s.tipos} maior={s.tipos[0].n} />
      )}

      {s.faixas.some((f) => f.n > 0) && (
        <Bloco
          titulo="Notas"
          nota="0 a 100"
          linhas={s.faixas}
          maior={Math.max(...s.faixas.map((f) => f.n))}
        />
      )}

      {destaque.length > 0 && (
        <section className="st-bloco">
          <div className="st-bloco-topo">
            <h3 className="st-titulo">{rotuloDestaque}</h3>
          </div>
          <ol className="st-top">
            {destaque.map((it) => (
              <li key={`${it.type}-${it.tmdbId}`}>
                <Link to={`/details/${it.type}/${it.tmdbId}`} className="st-top-linha">
                  {imageUrl(it.poster, "w185") ? (
                    <img
                      src={imageUrl(it.poster, "w185")}
                      alt=""
                      className="st-top-img"
                      loading="lazy"
                    />
                  ) : (
                    <span className="st-top-img st-top-sem" aria-hidden="true" />
                  )}
                  <span className="st-top-nome">{it.title}</span>
                  {it.score ? (
                    <span className="st-top-nota">{it.score}</span>
                  ) : (
                    <span className="st-top-nota muted">sem nota</span>
                  )}
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
