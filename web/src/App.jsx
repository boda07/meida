import Onboarding from "./components/Onboarding.jsx";
import { lazy, Suspense, useEffect, useState } from "react";
import { Routes, Route } from "react-router-dom";
import Header from "./components/Header.jsx";
import NavBaixo from "./components/NavBaixo.jsx";
import AppFullscreen from "./components/AppFullscreen.jsx";
import BackButton from "./components/BackButton.jsx";
import Changelog from "./components/Changelog.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import LoadingStatus from "./components/LoadingStatus.jsx";
import { useT } from "./i18n/I18nContext.jsx";
import { useAuth } from "./auth/AuthContext.jsx";

const Home = lazy(() => import("./pages/Home.jsx"));
const Category = lazy(() => import("./pages/Category.jsx"));
const Search = lazy(() => import("./pages/Search.jsx"));
const Details = lazy(() => import("./pages/Details.jsx"));
const Library = lazy(() => import("./pages/Library.jsx"));
const Diary = lazy(() => import("./pages/Diary.jsx"));
const Achievements = lazy(() => import("./pages/Achievements.jsx"));
  const Stats = lazy(() => import("./pages/Stats.jsx"));
const Login = lazy(() => import("./pages/Login.jsx"));
const Settings = lazy(() => import("./pages/Settings.jsx"));
const PickForMe = lazy(() => import("./pages/PickForMe.jsx"));
const Compare = lazy(() => import("./pages/Compare.jsx"));
const Users = lazy(() => import("./pages/Users.jsx"));
const UserProfile = lazy(() => import("./pages/UserProfile.jsx"));

/**
 * Os generos que o onboarding deixou escolhidos.
 *
 * **E' esta funcao que da' sentido aos generos escolhidos.** Sem ela a escolha
 * ficava guardada no `localStorage` e nunca mais era lida — uma preferencia morta,
 * que e' exactamente o que o proprio `onboarding.js` avisa que nao se deve
 * fazer. O consumidor e' `/api/discover?genres=...`, e a escolha entra como a
 * **primeira linha** da Home, acima do catalogo.
 *
 * **So entra depois de o onboarding ter sido mesmo feito.** Uma pessoa que
 * dispensou o wizard nao ganha uma linha de generos que nao escolheu.
 */
function generosEscolhidos() {
  try {
    const v = JSON.parse(localStorage.getItem("meida_onboarding_v1") || "null");
    if (!v || v.jaDispensado !== true) return "";
    if (!Array.isArray(v.generos)) return "";
    /**
     * **Cada genero e' um `{ id, name }`**, nao uma string: o `/api/discover`
     * precisa do id e a pessoa precisa do nome. Fazer `join(",")` no array
     * inteiro mandava `{"id":80,"name":"Crime"},{"id":12,...}` para o TMDB, que
     * devolvia uma lista vazia **sem erro** — e a linha nunca aparecia.
     *
     * Fica o `generosParaDiscover()` do modulo puro a fazer a conversao; aqui
     * so' se passa o valor guardado, sem duplicar a regra.
     */
    return v.generos
      .filter(Boolean)
      .map((g) => (g && typeof g === "object" ? g.id : g))
      .filter((id) => Number.isFinite(Number(id)) && Number(id) > 0)
      .map((id) => String(Math.trunc(Number(id))))
      .join(",");
  } catch {
    return "";
  }
}

export default function App() {
  const t = useT();
  const { user } = useAuth();

  /*
   * O onboarding e' **montado sempre que ha sessao**, e quem decide se ele se
   * ve e' o proprio componente, via `deveMostrar()`.
   *
   * A primeira versao gateava a MONTAGEM em `ob &&`, o que e' o oposto e estava
   * errado pelo motivo mais basico que ha: quem decide precisa de estar montado
   * para decidir. Com o gate no `App`, a unica forma de `ob` ser `true` era
   * alguem o ligar, e nao havia quem o ligasse — o wizard nunca aparecia a
   * ninguem, e nenhuma verificacao o apanhava porque o `deveMostrar` estava
   * la dentro, e nao reached.
   *
   * `force` existe para o atalho "importar" das Definicoes: ai mostra-se mesmo
   * com titulos, porque foi a pessoa que pediu.
   */
  const [forcar, setForcar] = useState(false);

  // O atalho: `window` e' o unico sitio onde um link de outra pagina pode
  // chamar. E' desligado no fim, porque sem isso o pedido abria o onboarding
  // em todas as navegacoes seguintes.
  useEffect(() => {
    if (!user) return undefined;
    window.abrirOnboarding = () => setForcar(true);
    return () => {
      delete window.abrirOnboarding;
    };
  }, [user]);

  return (
    <div className="app">
      {/* O Header e o BackButton ficam FORA do boundary, e nao e' um detalhe de
          estilo: e' o que garante que uma pagina que rebenta NAO leva a
          navegacao com ela. Com o header dentro, o "ecra em branco" do teu
          amigo nao tinha botao de voltar nenhum (2026-10-11). A regra e' simples:
          o que permite SAIR do erro nunca fica dentro do que apanha o erro. */}
      <BackButton />
      <AppFullscreen />
      <Changelog />
      <Header />
      {/* A barra de baixo, pela mesma razao: e' navegacao, e uma pagina que
          rebenta nao pode levar a navegacao com ela. So se ve abaixo de
          `LIMITE` (720 px) — e' CSS, nao JavaScript, para nao haver um estado
          que possa estar errado enquanto o dedo arrasta o ecra. */}
      <NavBaixo />
      {/* O onboarding tambem fica FORA do boundary: quem acabou de criar a conta
          pode estar a ver um erro de rede, e um wizard que depende da pagina
          para aparecer e' um wizard que nunca aparece. Monta-se com sessao
          (`user`) e decide por si; `count === null` (ainda a carregar) esconde-o
          dentro, porque quem tem titulos nunca o pode ver. */}
      {user && (
        <Onboarding aberto={forcar} forcar={forcar} onFechar={() => setForcar(false)} />
      )}
      <ErrorBoundary>
        <main className="content">
          <Suspense fallback={<LoadingStatus>{t("A carregar")}</LoadingStatus>}>
            <Routes>
              <Route path="/" element={<Home generos={generosEscolhidos()} />} />
              <Route path="/movies" element={<Category key="movies" category="movies" title={t("Filmes")} />} />
              <Route path="/series" element={<Category key="tv" category="tv" title={t("Séries")} />} />
              <Route path="/anime" element={<Category key="anime" category="anime" title={t("Anime")} />} />
              <Route path="/search" element={<Search />} />
              <Route path="/details/:type/:id" element={<Details />} />
              <Route path="/library" element={<Library />} />
              <Route path="/diary" element={<Diary />} />
              <Route path="/achievements" element={<Achievements />} />
              <Route path="/stats" element={<Stats />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/pick" element={<PickForMe />} />
              <Route path="/compare" element={<Compare />} />
              <Route path="/users" element={<Users />} />
              <Route path="/u/:username" element={<UserProfile />} />
              <Route path="/login" element={<Login mode="login" />} />
              <Route path="/register" element={<Login mode="register" />} />
            </Routes>
          </Suspense>
        </main>
      </ErrorBoundary>
    </div>
  );
}