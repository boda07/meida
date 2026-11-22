// O estado do feed de atividade, num gancho so.
//
// Duas variantes usam a mesma forma:
//   * `username` vazio -> `/api/feed` (quem segues + tu);
//   * `username` -> `/api/users/:username/activity` (um perfil).
//
// A paginacao e' por offset (nao por "antes de X") porque as duas rotas
// devolvem a lista por ordem de `watched_at` e os ids sao estaveis. O
// `hasMore` vem do servidor (pede `limit + 1`), em vez de se adivinhar pelo
// tamanho da pagina.
import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client.js";
import { useSettings } from "../settings/SettingsContext.jsx";
import { useT } from "../i18n/I18nContext.jsx";
import { juntarPagina } from "./itensAtividade.js";

const POR_PAGINA = 20;

export function useAtividade({ username = null, enabled = true, limit = POR_PAGINA } = {}) {
  const { idioma } = useT();
  const { settings } = useSettings();
  const [items, setItems] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(false);

  // Os titulos vem localizados do servidor (o texto guardado e' o do momento em
  // que se viu). Mudar o idioma da interface ou a preferencia de titulos sem
  // voltar a pedir deixava o feed no idioma anterior, ao lado do resto da app
  // ja' traduzido. A chave resume tudo o que o pedido le' do `api/client.js`.
  const chaveIdioma = `${idioma}|${settings.titleLang}|${settings.animeTitleLang}|${settings.overviewLang}`;

  const buscar = useCallback(
    (offset) =>
      username
        ? api.userActivity(username, { limit, offset })
        : api.feed({ limit, offset }),
    [username, limit]
  );

  useEffect(() => {
    if (!enabled) return undefined;
    let vivo = true;
    setLoading(true);
    setError(null);
    setItems(null);
    setHasMore(false);
    buscar(0)
      .then((d) => {
        if (!vivo) return;
        setItems(Array.isArray(d?.items) ? d.items : []);
        setHasMore(Boolean(d?.hasMore));
      })
      .catch((e) => {
        if (vivo) setError(e.message);
      })
      .finally(() => {
        if (vivo) setLoading(false);
      });
    return () => {
      vivo = false;
    };
  }, [enabled, buscar, chaveIdioma]);

  const carregarMais = useCallback(async () => {
    if (loadingMore || !hasMore || items === null) return;
    setLoadingMore(true);
    setError(null);
    try {
      const d = await buscar(items.length);
      // A regra de juntar (sem repetir o que ja' esta' a vista) vive num modulo
      // puro: o gancho trata do pedido e do estado, nao da deduplicacao.
      setItems((antes) => juntarPagina(antes, d?.items));
      setHasMore(Boolean(d?.hasMore));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingMore(false);
    }
  }, [buscar, hasMore, items, loadingMore]);

  return { items, loading, loadingMore, error, hasMore, carregarMais };
}
