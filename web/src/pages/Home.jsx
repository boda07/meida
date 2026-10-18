import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import { useSettings } from "../settings/SettingsContext.jsx";
import MediaRow from "../components/MediaRow.jsx";
import ContinueWatching from "../components/ContinueWatching.jsx";
import Hero from "../components/Hero.jsx";
import LoadingStatus from "../components/LoadingStatus.jsx";
import { useT } from "../i18n/I18nContext.jsx";

// Escolhe varios destaques (com imagem de fundo) para o slideshow do banner.
function pickHeroes(rows, n = 6) {
  const seen = new Set();
  const pool = rows
    .flatMap((r) => r.items)
    .filter((i) => i.backdrop && (seen.has(i.id) ? false : seen.add(i.id)));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, n);
}

/**
 * @param {object} p
 * @param {string} [p.generos]  os generos escolhidos no onboarding, separados
 *   por virgulas, ja em pronto para o `/api/discover`. Vem do `App.jsx`.
 *
 * A linha dos generos e' a **primeira**, antes do catalogo: e' o que a pessoa
 * disse que lhe interessa, e o catalogo generico e' o que ela ja viu. Sem este
 * parametro, os generos do onboarding seriam uma preferencia morta.
 */
export default function Home({ generos = "" }) {
  const t = useT();
  const { settings } = useSettings();
  const [rows, setRows] = useState([]);
  const [heroes, setHeroes] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [porGenero, setPorGenero] = useState(null);

  useEffect(() => {
    setLoading(true);
    api
      .catalog()
      .then((d) => {
        setRows(d.rows);
        setHeroes(pickHeroes(d.rows));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [settings.titleLang, settings.overviewLang, t.idioma]);

  // A linha dos generos. **Falha em silencio**: se o `/api/discover` nao
  // responder, a Home mostra o catalogo de sempre — o que e' o caso normal, e
  // nao um erro. Um erro de rede no primeiro ecra depois de criar a conta era
  // a pior coisa para happen e nao devia mostrar a pagina como partida.
  useEffect(() => {
    if (!generos) {
      setPorGenero(null);
      return undefined;
    }
    let vivo = true;
    // O titulo sai do `t()` **fora** do efeito: depende dentro ficaria a
    // re-disparar o pedido sempre que o idioma mudasse, para nao mudar nada.
    const titulo = t("Porque escolheste estes");
    api
      // `discover(opts)` — um objecto, **nao** argumentos posicionais. E o parametro
      // chama-se `genres` (o que a rota le) enquanto a propriedade e' `generos`
      // (portugues, como o resto do ficheiro) — a troca e' explicita aqui para
      // ninguem "simplificar" para `genres: genres` e ficar com `undefined`.
      // Sem `type` a rota devolve 400, e o erro apareceria como "nenhum genero
      // escolhido" em vez de "a imagem nao carregou".
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

  if (loading) return <LoadingStatus>{t("A carregar")}</LoadingStatus>;
  if (error)
    return (
      <div className="status error">
        <p>{t("Não consegui carregar o catálogo: {erro}", { erro: error })}</p>
        <p className="muted">
          {t("Verifica que criaste {ficheiro} com a tua chave do TMDB.", {
            ficheiro: <code>server/.env</code>,
          })}
        </p>
      </div>
    );

  return (
    <div className="catalog-page home">
      <Hero items={heroes} />
      <div className="rows">
        <ContinueWatching />
        {porGenero ? <MediaRow key={porGenero.id} title={porGenero.title} items={porGenero.items} /> : null}
        {rows.map((row) => (
          <MediaRow key={row.id} title={row.title} items={row.items} />
        ))}
      </div>
    </div>
  );
}
