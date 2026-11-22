import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import { useSettings } from "../settings/SettingsContext.jsx";
import { useT } from "../i18n/I18nContext.jsx";

/**
 * O catálogo da Home: as rows do TMDB/MAL e a linha dos géneros escolhidos no
 * onboarding.
 *
 * Fica num gancho para a Home desenhar e nada mais. São duas
 * responsabilidades com sítio próprio: pedir o catálogo (com `loading`/`error`,
 * porque um erro do TMDB tem de aparecer na página) e pedir a linha dos géneros
 * (que **falha em silêncio** — se o `/api/discover` não responder, a Home
 * mostra o catálogo de sempre, que é o caso normal e não uma página partida).
 *
 * @param {string} generos  os géneros escolhidos no onboarding, separados por
 *   vírgulas, já em pronto para o `/api/discover`.
 * @returns {{rows: object[], porGenero: object|null, error: string|null, loading: boolean}}
 */
export function useCatalogo(generos = "") {
  const t = useT();
  const { settings } = useSettings();
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [porGenero, setPorGenero] = useState(null);

  useEffect(() => {
    setLoading(true);
    api
      .catalog()
      .then((d) => {
        setRows(d.rows);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [settings.titleLang, settings.overviewLang, t.idioma]);

  useEffect(() => {
    if (!generos) {
      setPorGenero(null);
      return undefined;
    }
    let vivo = true;
    // O título sai do `t()` **fora** do efeito: depende dentro ficaria a
    // re-disparar o pedido sempre que o idioma mudasse, para não mudar nada.
    const titulo = t("Porque escolheste estes");
    api
      // `discover(opts)` — um objecto, **não** argumentos posicionais. E o parâmetro
      // chama-se `genres` (o que a rota lê) enquanto a propriedade é `generos`
      // (português, como o resto do ficheiro) — a troca é explícita aqui para
      // ninguém "simplificar" para `genres: genres` e ficar com `undefined`.
      // Sem `type` a rota devolve 400, e o erro apareceria como "nenhum género
      // escolhido" em vez de "a imagem não carregou".
      .discover({ type: "movie", genres: generos })
      .then((d) => {
        if (!vivo) return;
        const itens = (d && d.items) || [];
        if (itens.length) setPorGenero({ id: "ob-generos", title: titulo, items: itens });
      })
      .catch(() => { /* a Home fica como estava */ });
    return () => {
      vivo = false;
    };
  }, [generos, t]);

  return { rows, porGenero, error, loading };
}