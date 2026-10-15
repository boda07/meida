// As metas e os desafios, no fim da pagina /achievements.
//
// Duas coisas separadas: a META (o anel, com o alvo que a pessoa escolhe) e o
// DESAFIO das decadas. Nao estao no mesmo componente porque nao separam nada em
// comum: o anel e' um numero com um alvo, o desafio e' uma lista.
//
// ---------------------------------------------------------------------------------
// A PALAVRA "MARCASTE", E NAO "VISTE"
// ---------------------------------------------------------------------------------
// Todos os textos daqui dizem **marcaste como visto**, e e' deliberado. A
// biblioteca guarda `updated_at` (a ultima vez que tocaste), e nao a data em que
// viste — ver `server/src/metas.js`, onde a limitacao esta' escrita com o
// porquê. Um "viste 32 filmes este ano" seria falso para quem mexeu na lista
// ontem, e quem fosse vera isso nao tem como.
//
// O que se conta: `watched = 1` E `updated_at` neste ano. Filmes que puseste na
// watchlist hoje nao contam, porque `watched` e' 0. E' isso que impede a meta de
// ser um numero generoso.
import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { useT } from "../i18n/I18nContext.jsx";
import AnelMeta from "./AnelMeta.jsx";
import { anoDaMeta } from "./metas.js";

export default function MetasDesafios() {
  const t = useT();
  const { user } = useAuth();
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [aGravar, setAGravar] = useState(false);

  useEffect(() => {
    if (!user) return;
    let vivo = true;
    api
      .goals()
      .then((d) => {
        if (vivo) setDados(d);
      })
      .catch(() => {
        if (vivo) setErro(t("As metas não carregaram."));
      });
    // `vivo` evita o aviso clássico de "setState numa pagina que ja saiu": a
    // resposta chega depois de o utilizador mudar de pagina.
    return () => {
      vivo = false;
    };
  }, [user, t]);

  if (!user) return null;
  if (erro) return <p className="status muted">{erro}</p>;
  if (!dados) return null;

  // O ano e' do relogio de quem ve. O servidor pode estar em UTC, e as 00:30 de
  // 1 de Janeiro o servidor ainda acha que e' ano novo-1 (ver server/src/metas.js).
  const ano = new Date().getFullYear();
  const marcados = anoDaMeta(dados.filmesPorAno, ano);
  const alvo = dados.alvo || 50;
  const percent = Math.min(1, marcados / Math.max(1, alvo));
  const falta = Math.max(0, alvo - marcados);

  const dec = dados.decadas || { cobertas: [], vazias: [], semAno: 0, total: 0 };
  const cobertas = dec.cobertas || [];
  const vazias = dec.vazias || [];

  const gravar = async (novo) => {
    if (novo === alvo || aGravar) return;
    setAGravar(true);
    setErro("");
    try {
      const r = await api.setGoal(novo);
      setDados((d) => (d ? { ...d, alvo: r.alvo } : d));
    } catch {
      setErro(t("Não consegui guardar a meta."));
    } finally {
      setAGravar(false);
    }
  };

  return (
    <section className="metas">
      <h3 className="row-title">{t("Metas")}</h3>

      <div className="metas-alvo">
        <AnelMeta percent={percent} atingidos={marcados} alvo={alvo} />
        <div className="metas-alvo-texto">
          <p className="metas-alvo-titulo">
            {t("Marcaste {n} de {a} filmes como vistos em {ano}.", {
              n: marcados,
              a: alvo,
              ano,
            })}
          </p>
          <p className="metas-alvo-nota muted">
            {falta > 0
              ? t("Faltam {n}.", { n: falta })
              : t("Cumpreste. Já marcaste mais do que a meta.")}
          </p>
          <p className="metas-alvo-nota muted">
            {t("Conta a última vez que tocaste em cada filme, e só os que marcaste como vistos — o que puseste na lista não conta.")}
          </p>
        </div>
      </div>

      {/* O alvo e' escolha da pessoa. Os botoes sao a lista que o servidor
          aceitou — `dados.alvos` — e nao uma lista escrita aqui, para nao
          aparecer um numero que o servidor vai recusar. */}
      <div className="metas-escolha" role="group" aria-label={t("A tua meta")}>
        {t("A tua meta:")}
        {(dados.alvos || []).map((n) => (
          <button
            key={n}
            type="button"
            className={`metas-escolha-btn ${n === alvo ? "on" : ""}`}
            aria-pressed={n === alvo}
            disabled={aGravar}
            onClick={() => gravar(n)}
          >
            {n}
          </button>
        ))}
      </div>

      <h3 className="row-title metas-desafio-titulo">{t("Desafios")}</h3>

      <div className="desafio">
        <p className="desafio-regra">
          {t("Um filme de cada década, desde {a}.", { a: 1930 })}
        </p>
        <p className="desafio-progresso">
          {t("{c} de {d} décadas com pelo menos um filme visto.", {
            c: cobertas.length,
            d: dec.total,
          })}
        </p>
        <ul className="desafio-decadas">
          {cobertas.map((d) => (
            <li key={d.decada} className="decada feita">
              <span className="decada-anos">{d.decada}</span>
              <span className="decada-n">{d.n}</span>
            </li>
          ))}
          {vazias.map((d) => (
            <li key={d} className="decada falta">
              <span className="decada-anos">{d}</span>
              <span className="decada-n">—</span>
            </li>
          ))}
        </ul>
        {dec.semAno > 0 && (
          <p className="desafio-nota muted">
            {t("{n} dos teus filmes vistos não têm ano guardado, por isso não contam para nenhuma década.", {
              n: dec.semAno,
            })}
          </p>
        )}
      </div>
    </section>
  );
}