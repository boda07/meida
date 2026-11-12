import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { api } from "../api/client.js";
import { useSettings } from "../settings/SettingsContext.jsx";
import { useT } from "../i18n/I18nContext.jsx";
import MediaCard from "../components/MediaCard.jsx";
import Pagination from "../components/Pagination.jsx";
import LoadingStatus from "../components/LoadingStatus.jsx";

/**
 * A lista completa de uma row do catalogo — o destino do "Ver todos".
 *
 * O `rowId` e' o mesmo id que a row tem no servidor (ex.: "popular-movies").
 * Pedir a lista ao servidor, em vez de repetir aqui o criterio, garante que a
 * pagina mostra exactamente os titulos daquela row, so' que todos e paginados.
 */
export default function AllRow() {
  const { rowId } = useParams();
  const [params, setParams] = useSearchParams();
  const t = useT();
  const { settings } = useSettings();

  const page = Math.max(1, Number(params.get("page")) || 1);
  // Só a row dos géneros escolhidos no onboarding precisa deste filtro.
  const generos = params.get("genres") || "";
  // A Home manda o titulo ja' traduzido; o servidor manda um de recurso.
  const tituloPedido = params.get("title") || "";

  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(null);
  const [loading, setLoading] = useState(true);

  // Mudar de row (e nao de pagina) limpa a lista anterior: senao o titulo e os
  // cartoes da row antiga ficavam visiveis ate' a nova chegar, e parecia que o
  // "Ver todos" tinha aberto a lista errada.
  useEffect(() => {
    setDados(null);
  }, [rowId, generos]);

  useEffect(() => {
    let vivo = true;
    setLoading(true);
    setErro(null);
    api
      .catalogRow(rowId, { page, genres: generos })
      .then((d) => {
        if (!vivo) return;
        // Pagina fora do intervalo (URL escrito a mao): corrige para a ultima
        // que existe. Sem isto a grelha ficava vazia e a paginacao sem numero
        // ativo — um beco sem saida.
        if (d.totalPages && page > d.totalPages) {
          setParams(
            (prev) => {
              const proximos = new URLSearchParams(prev);
              proximos.set("page", String(d.totalPages));
              return proximos;
            },
            { replace: true }
          );
          return;
        }
        setDados(d);
      })
      .catch((e) => {
        if (vivo) setErro(e.message);
      })
      .finally(() => {
        if (vivo) setLoading(false);
      });
    return () => {
      vivo = false;
    };
  }, [
    rowId,
    page,
    generos,
    setParams,
    settings.titleLang,
    settings.overviewLang,
    settings.animeTitleLang,
    t.idioma,
  ]);

  const titulo = t(dados?.title || tituloPedido || "");
  const itens = dados?.items || [];

  const mudarPagina = (p) => {
    const proximos = new URLSearchParams(params);
    proximos.set("page", String(p));
    setParams(proximos);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="sub-page all-page">
      <div className="all-head">
        <h2 className="row-title">{titulo || t("A carregar")}</h2>
        {dados && dados.totalPages > 1 ? (
          <span className="muted all-page-num">
            {t("Página {p} de {n}", { p: dados.page, n: dados.totalPages })}
          </span>
        ) : null}
      </div>

      {erro ? (
        <div className="status error">
          <p>{t("Não consegui carregar esta lista.")}</p>
        </div>
      ) : loading && !itens.length ? (
        <LoadingStatus>{t("A carregar")}</LoadingStatus>
      ) : (
        <>
          {itens.length ? (
            <div className={`grid all-grid ${loading ? "is-loading" : ""}`} aria-busy={loading}>
              {itens.map((item) => (
                <MediaCard key={`${item.type}-${item.id}`} item={item} />
              ))}
            </div>
          ) : (
            <p className="muted">{t("Não há títulos nesta página.")}</p>
          )}
          <Pagination
            page={dados?.page || page}
            totalPages={dados?.totalPages || 1}
            onChange={mudarPagina}
          />
        </>
      )}
    </div>
  );
}
