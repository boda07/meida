// A pagina /stats: as seis figuras da biblioteca.
//
// O que vem de `/api/stats` ja vem contado no servidor (ver server/src/stats.js).
// Aqui so' se mostra — e o trabalho desta pagina e' sobretudo o que se mostra
// QUANDO o numero ainda nao existe.
//
// Esse e' o ponto que demorou mais a acertar. Cada figura tem tres estados
// possiveis e nenhum deles e' "0":
//
//   - tem valor      -> mostra o numero
//   - zero de verdade-> mostra 0, com o que ele significa
//   - ainda nao medido -> diz isso, e nao esconde nem inventa
//
// O terceiro e' o caso real do "tempo visto": a coluna `seconds_watched` nasceu a
// 2026-10-09, por isso tudo o que foi visto antes disso da 0 — e mostrar "0 horas"
// a quem viu 300 filmes seria mentira. Do mesmo modo, a "decada favorita" so'
// conta os titulos que tem ano, e a pagina diz quantos sao.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";
import { useAuth } from "../auth/AuthContext.jsx";
import HistogramaNotas from "../components/HistogramaNotas.jsx";
import LoadingStatus from "../components/LoadingStatus.jsx";
import { useT } from "../i18n/I18nContext.jsx";

/** 7320 -> "2 h 2 min". 45 -> "45 s". Zero -> null (o chamador trata). */
function duracao(segundos) {
  const s = Math.max(0, Math.floor(segundos || 0));
  if (!s) return null;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h && m) return `${h} h ${m} min`; // i18n: "h" e "min" sao iguais em portugues e em ingles
  if (h) return `${h} h`;
  return `${m || s} min`;
}

function decadaTexto(dec) {
  return `${dec.decada}s`;
}

export default function Stats() {
  const t = useT();
  const { user, ready } = useAuth();
  const [data, setData] = useState(null);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    if (!user) return;
    let vivo = true;
    api
      .stats()
      .then((d) => vivo && setData(d))
      .catch((e) => vivo && setErro(e.message));
    return () => {
      vivo = false;
    };
  }, [user]);

  if (ready && !user) {
    return (
      <p className="status muted">
        <Link to="/login">{t("Entra")}</Link> {t("para veres as tuas estatísticas. Só tu as vês.")}
      </p>
    );
  }
  if (erro) return <p className="auth-error">{erro}</p>;
  if (!data) return <LoadingStatus />;
  if (!data.titulos) {
    return (
      <div className="sub-page">
        <h1 className="page-title">{t("Estatísticas")}</h1>
        <p className="muted">
          {t("Ainda não há títulos na biblioteca, por isso ainda não há nada para contar.")}
        </p>
      </div>
    );
  }

  const tempo = duracao(data.tempoVisto);
  const semAno = data.titulos - (data.decadaFavorita?.comAno ?? 0);

  return (
    <div className="sub-page stats-page">
      <h1 className="page-title">{t("Estatísticas")}</h1>
      <p className="stats-sub">{t("Só tu vês isto. Os números saem da tua biblioteca.")}</p>

      {/* As três medidas que respondem "quanto". */}
      <dl className="st-cabecalho">
        <div className="st-cifra">
          <dt>títulos</dt>
          <dd>{data.titulos}</dd>
        </div>
        <div className="st-cifra">
          <dt>vistos</dt>
          <dd>{data.vistos}</dd>
        </div>
        <div className="st-cifra">
          <dt>{t("para ver")}</dt>
          <dd>{data.paraVer}</dd>
        </div>
      </dl>

      <section className="st-bloco">
        <div className="st-bloco-topo">
          <h2 className="st-titulo">{t("Como distribuis as notas")}</h2>
          {data.comNota > 0 && (
            <span className="st-nota">
              média {data.media} · mediana {data.mediana}
            </span>
          )}
        </div>
        {data.comNota > 0 ? (
          <>
            <HistogramaNotas barras={data.histogram.barras} />
            <p className="st-frase">
              {t("Notas entre {a} e {b}, em {n} títulos.", {
                a: data.notaMaisBaixa,
                b: data.notaMaisAlta,
                n: data.comNota,
              })}{" "}
              {data.media === data.mediana
                ? t("A média bate certo com a mediana, por isso as notas estão todas pela mesma banda.")
                : data.media > data.mediana
                  ? t("A média está acima da mediana: poucos títulos com nota muito alta estão a puxar a média para cima.")
                  : t("A média está abaixo da mediana: há muitos títulos bem avaliados a puxar a média para baixo.")}
            </p>
          </>
        ) : (
          <p className="muted">
            {t("Ainda não deste nota a nenhum título. Dá nota a um e o histograma aparece aqui.")}
          </p>
        )}
      </section>

      <section className="st-bloco">
        <div className="st-bloco-topo">
          <h2 className="st-titulo">{t("O resto")}</h2>
        </div>

        <dl className="st-cabecalho">
          {data.generoFavorito && (
            <div className="st-cifra">
              <dt>{t("género mais visto")}</dt>
              <dd>
                {data.generoFavorito.nome}
                <span className="st-cifra-de">{data.generoFavorito.n}</span>
              </dd>
            </div>
          )}
          {data.notaMaisAlta !== null && (
            <div className="st-cifra">
              <dt>{t("nota mais alta")}</dt>
              <dd>{data.notaMaisAlta}</dd>
            </div>
          )}
          {data.decadaFavorita && (
            <div className="st-cifra">
              <dt>{t("década favorita")}</dt>
              <dd>{decadaTexto(data.decadaFavorita)}</dd>
            </div>
          )}
          <div className="st-cifra">
            <dt>{t("tempo visto")}</dt>
            <dd>
              {tempo ?? "—"}
              {tempo && (
                <span className="st-cifra-de">{data.tempoVisto.toLocaleString("pt-PT")} s</span>
              )}
            </dd>
          </div>
        </dl>

        {/* As duas ressalvas que os numeros sozinhos nao dizem. */}
        {data.decadaFavorita && semAno > 0 && (
          <p className="stats-nota">
            A década conta {data.decadaFavorita.comAno} dos {data.titulos} títulos: os
            restantes ainda não têm ano guardado. Abre a ficha de alguns, ou corre o
            preenchimento, e este número fica mais firme.
          </p>
        )}
        {!tempo && (
          <p className="stats-nota">
            {t("O tempo visto só conta a partir de agora — a app nunca mediu tempo, e não há como saber quanto viste antes disto. Volta a ver alguma coisa e o número começa a aparecer.")}
          </p>
        )}
        {tempo && data.temposComMedida > 0 && (
          <p className="stats-nota">
            Medido em {data.temposComMedida}{" "}
            {data.temposComMedida === 1 ? "título" : "títulos"} até agora. Avançar no
            vídeo não conta; recuar para ver de novo também não.
          </p>
        )}
      </section>
    </div>
  );
}