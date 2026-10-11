import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import Header from "./components/Header.jsx";
import AppFullscreen from "./components/AppFullscreen.jsx";
import BackButton from "./components/BackButton.jsx";
import Changelog from "./components/Changelog.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import LoadingStatus from "./components/LoadingStatus.jsx";
import { useT } from "./i18n/I18nContext.jsx";

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

export default function App() {
  const t = useT();
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
      <ErrorBoundary>
        <main className="content">
          <Suspense fallback={<LoadingStatus>{t("A carregar")}</LoadingStatus>}>
            <Routes>
              <Route path="/" element={<Home />} />
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