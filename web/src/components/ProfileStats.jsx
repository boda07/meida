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
import { detalheStats, rotuloGenero, serieMensal } from "./profileStats.js";
import GraficoMensal from "./GraficoMensal.jsx";

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
          // A chave e' o nome ORIGINAL (ingles): dois generos podem traduzir
          // para a mesma palavra ("Music" e "Música" existem os dois na BD),
          // e chaves repetidas fazem o React trocar linhas entre si.
          <Linha key={l.nome} nome={rotuloGenero(l.nome)} n={l.n} maior={maior} />
        ))}
      </div>
    </section>
  );
}

/**
 * @param items  a biblioteca completa (`null` enquanto carrega)
 */
// `aVerAgora` foi removido daqui: o "a ver agora" e' identidade, e identidade esta
// no header do perfil. Passar a prop era so' contexto morto.
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
  // A serie temporal sai da MESMA lista que o resto (o mesmo filtro de genero
  // que `detalheStats` ve), para o grafico nunca discordar dos numeros de cima.
  const serie = serieMensal(items);

  // Os "top titulos" sao os cinco mais vistos, ou os cinco com nota mais alta
  // quando a pessoa ainda nao viu nada — para o bloco nunca ficar vazio num
  // perfil novo.
  const maisVistos = items
    .filter((it) => it.watched && (it.score || 0) > 0)
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, 5);
  const emAlta = items
    .filter((it) => !it.watched && it.watchlist)
    .slice(0, 5);
  const destaque = maisVistos.length ? maisVistos : emAlta;
  // Ordena por NOTA, nao por vezes vistas — nao ha contagem de reproducoes
  // em lado nenhum, por isso o nome antigo era mentira.
  const rotuloDestaque = maisVistos.length ? "Melhores notas" : "Na lista";

  return (
    <div className="st">
      {/* Aqui so' o que o HEADER do perfil NAO mostra. "titulos / vistos / para
          ver / media" e' a identidade da biblioteca e ja esta no header, duas
          linhas acima — repetir os mesmos numeros a uns centimetros de distancia
          faz a pagina parecer mais longa sem acrescentar nada.

          Fica o que e' especifico das NOTAS, que e' o que esta aba analisa. */}
      <dl className="st-cabecalho">
        <div className="st-cifra">
          <dt>com nota</dt>
          <dd>{s.comNota}</dd>
        </div>
        {s.emPausa > 0 && (
          <div className="st-cifra">
            <dt>em pausa</dt>
            <dd>{s.emPausa}</dd>
          </div>
        )}
        {s.abandonados > 0 && (
          <div className="st-cifra">
            <dt>abandonados</dt>
            <dd>{s.abandonados}</dd>
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

      {/* A serie temporal. Vai logo a seguir aos numeros grandes porque e' a
          unica coisa que responde a "como estou a ir", e os numeros de cima so' dao
          o estado. O componente esconde-se sozinho se a serie for curta demais
          para valer alguma coisa (menos de 3 meses). */}
      {serie.length >= 3 && (
        <section className="st-bloco">
          <div className="st-bloco-topo">
            <h3 className="st-titulo">Ao longo do ano</h3>
          </div>
          <GraficoMensal serie={serie} />
        </section>
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

      {/* As notas: um espectro, nao barras.
          As barras de 20 em 20 (1 / 3 / 30 / 167 / 104) nao diziam nada: numa
          escala 0-100 quase toda a gente nota entre 60 e 100, por isso tres
          quartos da biblioteca cabia em duas barras. O espectro diz em uma linha
          onde estao o teu piso, o meio e o teu tecto — que e' a informacao
          util sobre como costumas a notar. A barra e' a mesma linguagem do
          "Comparar com a comunidade" que ja existe na ficha. */}
      {s.maisBaixa !== null && (
        <section className="st-bloco">
          <div className="st-bloco-topo">
            <h3 className="st-titulo">As tuas notas</h3>
            <span className="st-nota">{s.comNota} com nota</span>
          </div>
          <div className="st-espectro">
            <div className="st-espectro-linha">
              <span className="st-espectro-marco min" style={{ left: `${s.maisBaixa}%` }} />
              <span className="st-espectro-mediana" style={{ left: `${s.mediana}%` }} />
              <span className="st-espectro-marco max" style={{ left: `${s.maisAlta}%` }} />
            </div>
            <div className="st-espectro-legendas">
              <span>
                <strong>{s.maisBaixa}</strong> a mais baixa
              </span>
              <span>
                <strong>{s.mediana}</strong> a mediana
              </span>
              <span>
                <strong>{s.maisAlta}</strong> a mais alta
              </span>
            </div>
          </div>
        </section>
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
