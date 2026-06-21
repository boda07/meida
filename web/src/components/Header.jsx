import { useEffect, useRef, useState } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import ProfileMenu from "./ProfileMenu.jsx";
import WatchParty from "./WatchParty.jsx";

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function FilmIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="7" width="20" height="15" rx="2.18" ry="2.18" />
      <line x1="16" y1="2" x2="16" y2="22" />
      <line x1="8" y1="2" x2="8" y2="22" />
      <line x1="2" y1="12" x2="22" y2="12" />
    </svg>
  );
}

function TVIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="7" width="20" height="15" rx="2" ry="2" />
      <polyline points="17 2 12 7 7 2" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="12 2 15.09 10.26 24 10.27 17.77 16.88 20.84 25.12 12 19.77 3.16 25.12 6.23 16.88 0 10.27 8.91 10.26 12 2" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const onSearchPage = location.pathname === "/search";

  const [searchOpen, setSearchOpen] = useState(onSearchPage);
  const [query, setQuery] = useState("");
  const inputRef = useRef(null);

  // Foca o input assim que a pesquisa abre.
  useEffect(() => {
    if (searchOpen) inputRef.current?.focus();
  }, [searchOpen]);

  // Se chegamos a /search?q=... por URL/refresh, preenche o input.
  useEffect(() => {
    if (onSearchPage) {
      const q = new URLSearchParams(location.search).get("q") || "";
      setQuery(q);
      setSearchOpen(true);
    }
    // so na montagem inicial
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pesquisa instantanea (estilo Netflix): cada tecla atualiza os resultados.
  const onChange = (value) => {
    setQuery(value);
    const q = value.trim();
    if (q) {
      // replace: nao enche o historico a cada tecla.
      navigate(`/search?q=${encodeURIComponent(q)}`, { replace: true });
    } else if (onSearchPage) {
      navigate("/search", { replace: true });
    }
  };

  const submitSearch = (e) => {
    e.preventDefault();
    const q = query.trim();
    if (q) navigate(`/search?q=${encodeURIComponent(q)}`);
  };

  return (
    <header className="nav-bar">
      <div className="nav-left">
        <nav className="nav-links">
          <NavLink to="/" end title="Inicio">
            <HomeIcon />
            <span>Inicio</span>
          </NavLink>
          <NavLink to="/movies" title="Filmes">
            <FilmIcon />
            <span>Filmes</span>
          </NavLink>
          <NavLink to="/series" title="Series">
            <TVIcon />
            <span>Series</span>
          </NavLink>
          <NavLink to="/anime" title="Anime">
            <StarIcon />
            <span>Anime</span>
          </NavLink>
        </nav>
      </div>

      <div className="nav-right">
        <form className={`search ${searchOpen ? "open" : ""}`} onSubmit={submitSearch}>
          <button
            type="button"
            className="icon-btn"
            aria-label="Pesquisar"
            title="Pesquisar"
            onClick={() => {
              if (searchOpen) submitSearch({ preventDefault: () => {} });
              else setSearchOpen(true);
            }}
          >
            <SearchIcon />
          </button>
          <input
            ref={inputRef}
            type="text"
            placeholder="Titulos, pessoas, generos"
            value={query}
            onChange={(e) => onChange(e.target.value)}
            onBlur={() => { if (!query.trim() && !onSearchPage) setSearchOpen(false); }}
          />
        </form>
        <WatchParty />
        <ProfileMenu />
      </div>
    </header>
  );
}
