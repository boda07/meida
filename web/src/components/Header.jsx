import { useEffect, useRef, useState } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import NotificationBell from "./NotificationBell.jsx";
import ProfileMenu from "./ProfileMenu.jsx";
import WatchParty from "./WatchParty.jsx";
import { useT } from "../i18n/I18nContext.jsx";
import { ehVersaoWeb, URL_RELEASE } from "../lib/web.js";

function HomeIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function FilmIcon() {
  // Camera de cinema: dois carreteis em cima, corpo e lente.
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
      <circle cx="8" cy="6" r="2.2" />
      <circle cx="13" cy="6" r="2.2" />
      <rect x="2" y="8" width="13" height="10" rx="2" />
      <path d="M15 12 L21 9.5 L21 16.5 L15 14 Z" />
    </svg>
  );
}

function TVIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="7" width="20" height="15" rx="2" ry="2" />
      <polyline points="17 2 12 7 7 2" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="12 2 15.09 10.26 24 10.27 17.77 16.88 20.84 25.12 12 19.77 3.16 25.12 6.23 16.88 0 10.27 8.91 10.26 12 2" />
    </svg>
  );
}

function DiceIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="8.5" cy="8.5" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="15.5" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="8.5" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="8.5" cy="15.5" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  );
}

// Seta para baixo a entrar numa linha: o "descarregar" de sempre.
function DownloadIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v11" />
      <polyline points="7.5 10.5 12 15 16.5 10.5" />
      <path d="M4 19h16" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const t = useT();
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
    // só na montagem inicial
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pesquisa instantanea (estilo Netflix): cada tecla atualiza os resultados.
  const onChange = (value) => {
    setQuery(value);
    const q = value.trim();
    if (q) {
      // replace: não enche o histórico a cada tecla.
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
    <header className={`nav-bar ${searchOpen ? "pesquisa-aberta" : ""}`}>
      <div className="nav-left">
        <nav className="nav-links">
          <NavLink to="/" end title={t("Início")}>
            <HomeIcon />
            <span>{t("Início")}</span>
          </NavLink>
          <NavLink to="/movies" title={t("Filmes")}>
            <FilmIcon />
            <span>{t("Filmes")}</span>
          </NavLink>
          <NavLink to="/series" title={t("Séries")}>
            <TVIcon />
            <span>{t("Séries")}</span>
          </NavLink>
          <NavLink to="/anime" title={t("Anime")}>
            <StarIcon />
            <span>{t("Anime")}</span>
          </NavLink>
          <NavLink to="/pick" title={t("Escolhe algo para mim")} className="nav-dice" aria-label={t("Escolhe algo para mim")}>
            <DiceIcon />
          </NavLink>

          {/* Só no site. Na app de desktop e' absurdo oferecer "descarregar a
              app" — a pessoa ja a tem. A regra esta' em `lib/web.js`; ve o
              ficheiro para o porque de nao vir do runtime-config.

              `ehVersaoWeb()` e' CHAMADA, nao usada como valor: uma funcao e'
              sempre verdadeira, e `{funcao && ...}` mostraria o botao sempre. */}
          {ehVersaoWeb() && (
            <a
              className="nav-descarregar"
              href={URL_RELEASE}
              target="_blank"
              rel="noopener noreferrer"
              title={t("Descarregar a app para o computador")}
            >
              <DownloadIcon />
              <span>{t("Descarregar a app")}</span>
            </a>
          )}
        </nav>
      </div>

      <div className="nav-right">
        <form className={`search ${searchOpen ? "open" : ""}`} onSubmit={submitSearch}>
          <button
            type="button"
            className="icon-btn"
            aria-label={t("Pesquisar")}
            title={t("Pesquisar")}
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
            placeholder={t("Títulos, pessoas, géneros")}
            value={query}
            onChange={(e) => onChange(e.target.value)}
            onBlur={() => { if (!query.trim() && !onSearchPage) setSearchOpen(false); }}
          />
        </form>
        <WatchParty />
        {/* O sino fica antes do perfil: e' sobre a pessoa, nao sobre a app. */}
        <NotificationBell />
        <ProfileMenu />
      </div>
    </header>
  );
}
