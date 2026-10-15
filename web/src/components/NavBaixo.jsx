// A barra de baixo do telefone: cinco separadores, e uma folha com o resto.
//
// Aparece **so por CSS** (`.nav-baixo` esta' `display: none` acima de
// `LIMITE`), e nao por um `useState` com `window.innerWidth`. A diferenca
// importa: um listener de resize refaz o desenho a cada pixel e o separador
// "acende" e "apaga" enquanto o dedo arrasta; o CSS e' uma condicao avaliada
// pelo browser, sem nunca ter estado errado.
//
// A pílula de cima **perde os links de categoria** abaixo do limite (o CSS faz
// isso tambem) porque senao ficariam os dois menus na tela ao mesmo tempo, com
// "Início" duas vezes.
import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useT } from "../i18n/I18nContext.jsx";
import { useAuth } from "../auth/AuthContext.jsx";
import { noBrowser, URL_RELEASE } from "../lib/web.js";
import { ITENS, activoDe, perfilDe, itensDoMais } from "./navBaixo.js";

function HomeIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
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

function LibraryIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
      <rect x="3" y="4" width="5" height="16" rx="1" />
      <rect x="10" y="4" width="4" height="16" rx="1" />
      <path d="M16.5 5.5l4 15" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" />
    </svg>
  );
}

function DotsIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

const ICONES = { inicio: HomeIcon, pesquisa: SearchIcon, biblioteca: LibraryIcon, perfil: UserIcon, mais: DotsIcon };

export default function NavBaixo() {
  const t = useT();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [maisAberto, setMaisAberto] = useState(false);
  const folhaRef = useRef(null);

  const username = user?.username || "";
  const activo = activoDe(location.pathname, username);
  const itens = itensDoMais({ ehSite: noBrowser() });

  /*
   * Os rotulos sao interface, e por isso vivem **aqui** e nao em `navBaixo.js`:
   * o auditor de traducao so reconhece texto dentro de `t("...")`, e da primeira
   * vez que os rotulos estavam no ficheiro puro acusou seis linhas. (O ficheiro
   * puro ficou com os `id` e os `para`, que e' o que a logica decide mesmo.)
   *
   * `scripts/testar-nav-baixo.mjs` confere que **cada `id` que a logica produz
   * tem aqui o seu `t("...")`** — o que apanha tambem um `id` escrito errado.
   */
  const rotulo = {
    inicio: t("Início"),
    pesquisa: t("Pesquisa"),
    biblioteca: t("Biblioteca"),
    perfil: t("Perfil"),
    mais: t("Mais"),
    filmes: t("Filmes"),
    series: t("Séries"),
    anime: t("Anime"),
    diario: t("Diário"),
    conquistas: t("Conquistas"),
    estatisticas: t("Estatísticas"),
    pick: t("Escolhe algo para mim"),
    comparar: t("Comparar notas"),
    pessoas: t("Pessoas"),
    descarregar: t("Descarregar a app"),
    definicoes: t("Definições"),
    fechar: t("Fechar"),
    navegacao: t("Navegação"),
  };

  // Navegar fecha a folha. Sem isto, abrir "Diário" pelo "mais" deixava a folha
  // aberta em cima do diário, e a pessoa tinha de adivinhar como a fechava.
  useEffect(() => {
    setMaisAberto(false);
  }, [location.pathname]);

  // Fecha com o Escape. `keydown` na `window` e nao no div: o foco pode estar
  // num link dentro da folha e o evento nao sobe se nao houver um agrupador com
  // `tabIndex` — e nao ha, para nao meter um foco invisivel na ordem da tabulacao.
  useEffect(() => {
    if (!maisAberto) return undefined;
    const aoTeclar = (e) => {
      if (e.key === "Escape") setMaisAberto(false);
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [maisAberto]);

  // Tocar fora fecha. E' o que fecha a folha depois de se escolher um destino.
  const aoTocarFora = (e) => {
    if (folhaRef.current && !folhaRef.current.contains(e.target)) setMaisAberto(false);
  };

  const separador = (item) => {
    const Icone = ICONES[item.id];
    // O "perfil" e' o unico sem `para`: depende da sessao.
    const destino = item.id === "perfil" ? perfilDe(username) : item.para;
    const aceso = item.id === "mais" ? maisAberto : activo === item.id;

    /*
     * A classe calcula-se AQUI e nao em `{...}` dentro do JSX. Escrita no
     * atributo, `"nav-baixo-item" + (aceso ? " on" : "")` deixa o resto da
     * linha (`+ (aceso ?`) a ser lido pelo auditor de traducao como texto em
     * portugues — duas falsos-positivas por linha, nas duas ocorrencias.
     */
    const classe = aceso ? "nav-baixo-item on" : "nav-baixo-item";

    const conteudo = (
      <>
        <Icone />
        <span className="nav-baixo-rot">{rotulo[item.id]}</span>
      </>
    );

    if (item.id === "mais") {
      return (
        <button key={item.id} type="button" className={classe} aria-expanded={maisAberto} onClick={() => setMaisAberto((v) => !v)}>
          {conteudo}
        </button>
      );
    }

    return (
      <NavLink key={item.id} to={destino} className={classe}>
        {conteudo}
      </NavLink>
    );
  };

  return (
    <>
      <nav className="nav-baixo" aria-label={rotulo.navegacao}>
        {ITENS.map(separador)}
      </nav>

      {/*
        A folha e' uma `dialog` de verdade e nao um `div` com `position: fixed`:
        e' o unico elemento que o browser **move o foco para dentro** ao abrir e
        devolve a quem abriu ao fechar, e le `aria-modal` sem ter de o dizer a mao.
        `showModal` da' o `Esc` de graca — o `keydown` acima e' a rede de
        seguranca para o caso de o browser nao implementir.
      */}
      {maisAberto && (
        <div className="nav-mais-fundo" onClick={aoTocarFora}>
          <div
            className="nav-mais"
            ref={folhaRef}
            role="dialog"
            aria-modal="true"
            aria-label={t("Mais")}
          >
            <div className="nav-mais-cabeca">
              <strong>{rotulo.mais}</strong>
              <button type="button" className="icon-btn" aria-label={rotulo.fechar} onClick={() => setMaisAberto(false)}>
                <CloseIcon />
              </button>
            </div>
            <ul className="nav-mais-lista">
              {itens.map((it) => (
                <li key={it.id}>
                  {it.externo ? (
                    <a href={URL_RELEASE} target="_blank" rel="noopener noreferrer">
                      {rotulo[it.id]}
                    </a>
                  ) : (
                    <button type="button" onClick={() => navigate(it.para)}>
                      {rotulo[it.id]}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}