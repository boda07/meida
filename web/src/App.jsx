import { Routes, Route } from "react-router-dom";
import Header from "./components/Header.jsx";
import AppFullscreen from "./components/AppFullscreen.jsx";
import BackButton from "./components/BackButton.jsx";
import Home from "./pages/Home.jsx";
import Category from "./pages/Category.jsx";
import Search from "./pages/Search.jsx";
import Details from "./pages/Details.jsx";
import Library from "./pages/Library.jsx";
import Login from "./pages/Login.jsx";
import Settings from "./pages/Settings.jsx";

export default function App() {
  return (
    <div className="app">
      <BackButton />
      <AppFullscreen />
      <Header />
      <main className="content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/movies" element={<Category category="movies" title="Filmes" />} />
          <Route path="/series" element={<Category category="tv" title="Series" />} />
          <Route path="/anime" element={<Category category="anime" title="Anime" />} />
          <Route path="/search" element={<Search />} />
          <Route path="/details/:type/:id" element={<Details />} />
          <Route path="/library" element={<Library />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/login" element={<Login mode="login" />} />
          <Route path="/register" element={<Login mode="register" />} />
        </Routes>
      </main>
    </div>
  );
}
