import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import Header from "./components/Header.jsx";
import AppFullscreen from "./components/AppFullscreen.jsx";
import BackButton from "./components/BackButton.jsx";
import Changelog from "./components/Changelog.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import LoadingStatus from "./components/LoadingStatus.jsx";

const Home = lazy(() => import("./pages/Home.jsx"));
const Category = lazy(() => import("./pages/Category.jsx"));
const Search = lazy(() => import("./pages/Search.jsx"));
const Details = lazy(() => import("./pages/Details.jsx"));
const Library = lazy(() => import("./pages/Library.jsx"));
const Diary = lazy(() => import("./pages/Diary.jsx"));
const Achievements = lazy(() => import("./pages/Achievements.jsx"));
const Login = lazy(() => import("./pages/Login.jsx"));
const Settings = lazy(() => import("./pages/Settings.jsx"));
const PickForMe = lazy(() => import("./pages/PickForMe.jsx"));
const Compare = lazy(() => import("./pages/Compare.jsx"));

export default function App() {
  return (
    <div className="app">
      <ErrorBoundary>
        <BackButton />
        <AppFullscreen />
        <Changelog />
        <Header />
        <main className="content">
          <Suspense fallback={<LoadingStatus>A carregar</LoadingStatus>}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/movies" element={<Category key="movies" category="movies" title="Filmes" />} />
              <Route path="/series" element={<Category key="tv" category="tv" title="Séries" />} />
              <Route path="/anime" element={<Category key="anime" category="anime" title="Anime" />} />
              <Route path="/search" element={<Search />} />
              <Route path="/details/:type/:id" element={<Details />} />
              <Route path="/library" element={<Library />} />
              <Route path="/diary" element={<Diary />} />
              <Route path="/achievements" element={<Achievements />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/pick" element={<PickForMe />} />
              <Route path="/compare" element={<Compare />} />
              <Route path="/login" element={<Login mode="login" />} />
              <Route path="/register" element={<Login mode="register" />} />
            </Routes>
          </Suspense>
        </main>
      </ErrorBoundary>
    </div>
  );
}