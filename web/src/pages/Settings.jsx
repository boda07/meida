import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useSettings } from "../settings/SettingsContext.jsx";
import { useAuth } from "../auth/AuthContext.jsx";
import { useT } from "../i18n/I18nContext.jsx";
import { NOMES_IDIOMA } from "../i18n/traducoes.js";
import { api, openExternal } from "../api/client.js";
import Avatar, { AVATAR_EMOJIS } from "../components/Avatar.jsx";
import { clearPresence, presenceSupported } from "../discord.js";

// Seccao de ligacao ao MyAnimeList.
function MalSection({ user }) {
  const t = useT();
  const [enabled, setEnabled] = useState(false);
  const [linked, setLinked] = useState(false);
  const [username, setUsername] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  function refresh() {
    api.malStatus().then((d) => {
      setLinked(d.linked);
      setUsername(d.username);
    }).catch(() => {});
  }

  useEffect(() => {
    if (!user) return;
    api.malEnabled().then((d) => setEnabled(d.enabled)).catch(() => {});
    refresh();
  }, [user]);

  // Ao voltar a janela (depois do OAuth no browser), reverifica a ligacao.
  useEffect(() => {
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  async function link() {
    setMsg(null);
    try {
      const { authUrl } = await api.malLogin();
      openExternal(authUrl);
      setMsg(t("Autoriza no browser e volta a esta janela."));
    } catch (e) {
      setMsg(e.message);
    }
  }

  async function importList() {
    setBusy(true);
    setMsg(null);
    try {
      const d = await api.malImport();
      setMsg(t("Importados {n} animes para a tua lista.", { n: d.imported }));
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function unlink() {
    await api.malUnlink().catch(() => {});
    refresh();
    setMsg(null);
  }

  if (!user) {
    return (
      <p className="muted">
        <Link to="/login">{t("Entra")}</Link> {t("para ligares o MyAnimeList.")}
      </p>
    );
  }
  if (!enabled) {
    return (
      <p className="muted">
        {t("O servidor não tem o MyAnimeList configurado (falta MAL_CLIENT_ID).")}
      </p>
    );
  }

  return (
    <div>
      {linked ? (
        <>
          <p className="muted">
            {t("Ligado como {u}. Os episódios de anime que vires são marcados no teu MAL automaticamente.", { u: <b>{username || "?"}</b> })}
          </p>
          <div className="set-row">
            <button className="set-choice active" onClick={importList} disabled={busy}>
              {busy ? t("A importar...") : t("Importar lista do MAL")}
            </button>
            <button className="set-clear" onClick={unlink}>{t("Desligar conta")}</button>
          </div>
        </>
      ) : (
        <>
          <p className="muted">
            {t("Liga a tua conta para importar a tua lista e marcar episódios vistos.")}
          </p>
          <button className="set-choice active" onClick={link}>
            {t("Ligar MyAnimeList")}
          </button>
        </>
      )}
      {msg && <p className="muted" style={{ marginTop: 10 }}>{msg}</p>}
    </div>
  );
}

// Seccao de ligacao ao AniList (anime). Fonte de verdade da lista quando o MAL
// nao esta ligado: importa estado/nota/progresso e marca episodios vistos.
function AniListSection({ user }) {
  const t = useT();
  const [enabled, setEnabled] = useState(false);
  const [linked, setLinked] = useState(false);
  const [username, setUsername] = useState(null);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [malLinked, setMalLinked] = useState(false);
  const [msg, setMsg] = useState(null);

  function refresh() {
    api
      .anilistStatus()
      .then((d) => {
        setLinked(d.linked);
        setUsername(d.username);
      })
      .catch(() => {});
    // Verifica tambem se o MAL esta ligado: o cross-sync so faz sentido se sim.
    api
      .malStatus()
      .then((d) => setMalLinked(d.linked))
      .catch(() => {});
  }

  useEffect(() => {
    if (!user) return;
    api
      .anilistEnabled()
      .then((d) => setEnabled(d.enabled))
      .catch(() => {});
    refresh();
  }, [user]);

  useEffect(() => {
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  async function link() {
    setMsg(null);
    try {
      const { authUrl } = await api.anilistLogin();
      openExternal(authUrl);
      setMsg(t("Autoriza no browser e volta a esta janela."));
    } catch (e) {
      setMsg(e.message);
    }
  }

  async function importList() {
    setBusy(true);
    setMsg(null);
    try {
      const d = await api.anilistImport();
      setMsg(t("Importados {n} animes para a tua lista.", { n: d.imported }));
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function unlink() {
    await api.anilistUnlink().catch(() => {});
    refresh();
    setMsg(null);
  }

  async function syncCross() {
    setSyncing(true);
    setMsg(null);
    try {
      const d = await api.anilistSync();
      setMsg(t("Cross-sync concluído: +{m} no MAL, +{a} no AniList.", { m: d.malUpdated, a: d.aniUpdated }));
    } catch (e) {
      setMsg(e.message || t("Falha na sincronização."));
    } finally {
      setSyncing(false);
    }
  }

  if (!user) {
    return (
      <p className="muted">
        <Link to="/login">{t("Entra")}</Link> {t("para ligares o AniList.")}
      </p>
    );
  }
  if (!enabled) {
    return (
      <p className="muted">
        {t("O servidor não tem o AniList configurado (falta ANILIST_CLIENT_ID).")}
      </p>
    );
  }

  return (
    <div>
      {linked ? (
        <>
            <p className="muted">
              {t("Ligado como {u}. Quando não tens o MyAnimeList", { u: <b>{username || "?"}</b> })}
              ligado, os episódios de anime que vires são marcados no teu AniList
              automaticamente. Se tens o MAL também ligado, podes fazer cross-sync
              manual (Sincronizar com MAL) ou ela corre automaticamente ao abrir a
              Library.
            </p>
          <div className="set-row">
            <button className="set-choice active" onClick={importList} disabled={busy}>
              {busy ? t("A importar...") : t("Importar lista do AniList")}
            </button>
            {malLinked && (
              <button className="set-choice" onClick={syncCross} disabled={syncing}>
                {syncing ? t("A sincronizar...") : t("Sincronizar com MAL")}
              </button>
            )}
            <button className="set-clear" onClick={unlink}>{t("Desligar conta")}</button>
          </div>
        </>
      ) : (
        <>
          <p className="muted">
            {t("Liga a tua conta para importar a tua lista e marcar episódios vistos.")}
          </p>
          <button className="set-choice active" onClick={link}>
            {t("Ligar AniList")}
          </button>
        </>
      )}
      {msg && <p className="muted" style={{ marginTop: 10 }}>{msg}</p>}
    </div>
  );
}

// Seccao de ligacao ao Letterboxd (filmes).
function LetterboxdSection({ user }) {
  const t = useT();
  const [username, setUsername] = useState(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  function refresh() {
    api
      .letterboxdStatus()
      .then((d) => setUsername(d.username))
      .catch(() => {});
  }

  useEffect(() => {
    if (user) refresh();
  }, [user]);

  async function link() {
    setBusy(true);
    setMsg(null);
    try {
      const d = await api.letterboxdLink(input.trim());
      setUsername(d.username);
      setInput("");
      setMsg(t("Conta ligada. Carrega em Importar para trazer os teus filmes."));
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function importList(what) {
    setBusy(true);
    setMsg(null);
    try {
      const d = await api.letterboxdImport(what);
      if (what === "films") setMsg(t("Importados {n} filmes vistos.", { n: d.imported }));
      else if (what === "watchlist") setMsg(t("Importados {n} da watchlist.", { n: d.watchlist }));
      else setMsg(t("Importados {n} vistos + {w} da watchlist.", { n: d.imported, w: d.watchlist }));
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function unlink() {
    await api.letterboxdUnlink().catch(() => {});
    setUsername(null);
    setMsg(null);
  }

  if (!user) {
    return (
      <p className="muted">
        <Link to="/login">{t("Entra")}</Link> {t("para ligares o Letterboxd.")}
      </p>
    );
  }

  return (
    <div>
      {username ? (
        <>
          <p className="muted">
            {t("Ligado como {u}. A nota da comunidade dos teus filmes", { u: <b>{username}</b> })}
            (na tua lista) passa a vir do Letterboxd.
          </p>
          <div className="set-row">
            <button className="set-choice active" onClick={() => importList("films")} disabled={busy}>
              {busy ? t("A importar...") : t("Importar vistos")}
            </button>
            <button className="set-choice active" onClick={() => importList("watchlist")} disabled={busy}>
              {busy ? t("A importar...") : t("Importar watchlist")}
            </button>
            <button className="set-choice" onClick={() => importList("all")} disabled={busy}>
              {busy ? t("A importar...") : t("Importar tudo")}
            </button>
          </div>
          <div className="set-row" style={{ marginTop: 8 }}>
            <button className="set-clear" onClick={unlink}>
              {t("Desligar conta")}
            </button>
          </div>
          <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
            {t("Importa todos os filmes vistos (com as tuas notas) e/ou a watchlist completa. Em listas grandes pode demorar alguns segundos. Em cada filme tens um botao para o abrir no Letterboxd.")}
          </p>
        </>
      ) : (
        <>
          <p className="muted">
            {t("Indica o teu username do Letterboxd para importar a tua watchlist e os filmes vistos (com as tuas notas), e usar a nota da comunidade do Letterboxd.")}
          </p>
          <div className="set-img-url">
            <input
              type="text"
              placeholder={t("username do Letterboxd")}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && input.trim() && link()}
            />
            <button
              className="lib-watched"
              onClick={link}
              disabled={busy || !input.trim()}
            >
              {busy ? t("A ligar...") : "Ligar"}
            </button>
          </div>
        </>
      )}
      {msg && <p className="muted" style={{ marginTop: 10 }}>{msg}</p>}
    </div>
  );
}

// Seccao de ligacao ao Real-Debrid (streaming de torrents instantaneo).
function DebridSection({ user }) {
  const t = useT();
  const [status, setStatus] = useState(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  function refresh() {
    api
      .debridStatus()
      .then((d) => setStatus(d))
      .catch(() => {});
  }

  useEffect(() => {
    if (user) refresh();
  }, [user]);

  async function link() {
    setBusy(true);
    setMsg(null);
    try {
      const d = await api.debridLink(input.trim());
      setStatus({ linked: true, account: d.account });
      setInput("");
      setMsg(t("Real-Debrid ligado. Os torrents em cache no DeBrid reproduzem logo."));
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function unlink() {
    await api.debridUnlink().catch(() => {});
    setStatus({ linked: false, account: null });
    setMsg(null);
  }

  if (!user) {
    return (
      <p className="muted">
        <Link to="/login">{t("Entra")}</Link> {t("para ligares o Real-Debrid.")}
      </p>
    );
  }

  return (
    <div>
      {status?.linked ? (
        <>
          <p className="muted">
            {t("Ligado como {u}. Nos torrents, os que estiverem em cache no Real-Debrid reproduzem {logo} (sem esperar por peers).", {
              u: <b>{status.account}</b>,
              logo: <b>logo</b>,
            })}
          </p>
          <div className="set-row" style={{ marginTop: 8 }}>
            <button className="set-clear" onClick={unlink}>
              {t("Desligar")}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="muted">
            {t("Cola o teu token do Real-Debrid (obtém-no em {ligacao}){fim}", {
              ligacao: (
                <a
                  href="https://real-debrid.com/apitoken"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  real-debrid.com/apitoken
                </a>
              ),
              fim: t("). É um serviço pago (mas barato) que guarda os torrents em cache — por isso o stream começa imediatamente, como no Stremio."),
            })}
          </p>
          <div className="set-img-url">
            <input
              type="password"
              placeholder={t("token do Real-Debrid")}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && input.trim() && link()}
            />
            <button
              className="lib-watched"
              onClick={link}
              disabled={busy || !input.trim()}
            >
              {busy ? t("A ligar...") : "Ligar"}
            </button>
          </div>
        </>
      )}
      {msg && <p className="muted" style={{ marginTop: 10 }}>{msg}</p>}
    </div>
  );
}

// Le uma imagem do disco e devolve um data URL ja reduzido (cabe no localStorage,
// que e onde as definicoes ficam guardadas). Reduz a largura maxima e exporta em
// JPEG para nao ocupar megabytes.
function imageFileToDataUrl(file, maxW = 1920) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// Cores de destaque predefinidas.
const ACCENT_PRESETS = [
  "#c90303", // vermelho (default)
  "#e50914", // netflix
  "#1db954", // verde
  "#2563eb", // azul
  "#8b5cf6", // roxo
  "#ec4899", // rosa
  "#f59e0b", // laranja
  "#06b6d4", // ciano
];

// Cores de fundo predefinidas (escuras, para o texto branco continuar legível).
const BG_PRESETS = [
  "#070708", // preto (default)
  "#0a1226", // navy (combina com o logo azul/dourado)
  "#0d1117", // github
  "#0a0e14", // azul-noite
  "#12101a", // roxo escuro
  "#0a0f0d", // verde escuro
  "#15100f", // castanho escuro
];

// Junta uma cor ao topo da lista de recentes (sem duplicar, max 6).
function addRecent(list, color) {
  const c = (color || "").toLowerCase();
  if (!c) return list || [];
  return [c, ...(list || []).filter((x) => x.toLowerCase() !== c)].slice(0, 6);
}

// Seletor de cor: presets + últimas escolhidas (recentes) + picker livre.
function ColorField({ presets, value, recent, onPick, onCommit, fallback }) {
  const norm = (value || "").toLowerCase();
  const presetSet = new Set(presets.map((c) => c.toLowerCase()));
  const recentExtra = (recent || []).filter((c) => !presetSet.has(c.toLowerCase()));
  return (
    <div className="set-row color-row">
      {presets.map((c) => (
        <button
          key={c}
          className={`color-swatch ${norm === c.toLowerCase() ? "active" : ""}`}
          style={{ background: c }}
          onClick={() => onPick(c)}
          aria-label={c}
        />
      ))}
      {recentExtra.map((c) => (
        <button
          key={c}
          className={`color-swatch recent ${norm === c.toLowerCase() ? "active" : ""}`}
          style={{ background: c }}
          onClick={() => onPick(c)}
          title={`Recente: ${c}`}
          aria-label={`Recente ${c}`}
        />
      ))}
      <label className="color-custom" style={{ background: value }}>
        <input
          type="color"
          value={value || fallback}
          onChange={(e) => onPick(e.target.value)}
          onBlur={(e) => onCommit(e.target.value)}
        />
        <span>+</span>
      </label>
    </div>
  );
}

// Botoes de escolha unica (estilo pilula).
function Choice({ value, current, onPick, children }) {
  return (
    <button
      className={`set-choice ${current === value ? "active" : ""}`}
      onClick={() => onPick(value)}
    >
      {children}
    </button>
  );
}

// ============================================================================
// Abas das Definições
// ============================================================================
// Eram 21 secções num scroll só. Agora cada <section className="set-section">
// diz a que aba pertence (`data-tab="..."`) e o CSS esconde as das outras abas
// (ver `.settings-page[data-active-tab]` em styles.css) — assim não foi preciso
// mexer no envelope nem na ordem dos blocos. O `id` de cada aba é o mesmo
// string nos dois lados, por isso convém não os escrever à mão.
// O `label` e' o TEXTO EM PORTUGUES, nao um rotulo ja' traduzido. Assim o `t()`
// consegue traduzi-lo no render (esta' const fora do componente, por isso nao
// pode chamar o `useT()` aqui).
const TABS = [
  { id: "perfil", label: "Perfil" },
  { id: "aparencia", label: "Aparência" },
  { id: "reproducao", label: "Reprodução" },
  { id: "conteudo", label: "Conteúdo" },
  { id: "contas", label: "Contas" },
  { id: "dados", label: "Dados" },
  { id: "avancado", label: "Avançado" },
];
const TAB_KEY = "meida:settings-tab";

export default function Settings() {
  const { settings, update, erroGuardar, avisoAcento } = useSettings();
  const t = useT();
  const { user, updateAvatar, updateProfile } = useAuth();
  const [imgUrl, setImgUrl] = useState("");
  const [bio, setBio] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState(null);
  // Aba activa. Guardada no browser para não voltar ao "Perfil" a cada visita
  // (e para não perder o scroll de quem só anda a ver as contas linked).
  const [tab, setTab] = useState(() => {
    try {
      const saved = localStorage.getItem(TAB_KEY);
      return TABS.some((t) => t.id === saved) ? saved : "perfil";
    } catch {
      return "perfil";
    }
  });
  // Servidor (so no desktop Electron): local vs remoto.
  const desktop = typeof window !== "undefined" ? window.electronAPI : null;
  // Procurar actualizacao. Fica aqui, e nao so no menu da conta, porque esse
  // menu so aparece com sessao iniciada - e quem ainda nao fez login e
  // precisamente quem mais precisa de actualizar a app.
  const [updMsg, setUpdMsg] = useState(null);
  const [updBusy, setUpdBusy] = useState(false);
  async function checkUpdate() {
    if (updBusy) return;
    setUpdBusy(true);
    setUpdMsg(t("A procurar..."));
    try {
      const r = await window.electronAPI.checkForUpdates();
      if (r?.status === "available")
        setUpdMsg(t("Nova versão {v} — a descarregar...", { v: r.version }));
      else if (r?.status === "latest") setUpdMsg(t("Já tens a versão mais recente. ✓"));
      else if (r?.status === "dev") setUpdMsg(t("Indisponível em desenvolvimento."));
      else setUpdMsg(t("Não foi possível verificar agora."));
    } catch {
      setUpdMsg(t("Não foi possível verificar agora."));
    } finally {
      setUpdBusy(false);
    }
  }
  const [srv, setSrv] = useState(null);
  const [srvMode, setSrvMode] = useState("local");
  const [srvUrl, setSrvUrl] = useState("");
  const [srvBusy, setSrvBusy] = useState(false);
  const [srvMsg, setSrvMsg] = useState(null);
  const [srvErr, setSrvErr] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [provHealth, setProvHealth] = useState(null);
  const [exporting, setExporting] = useState(null); // "json" | "csv" | null
  const [exportMsg, setExportMsg] = useState(null);
  const [importFile, setImportFile] = useState(null); // File ou null
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState(null);
  const [importError, setImportError] = useState(false);

  // Estado (vivo/morto) dos providers: carregado ao início (refresh manual no botão).
  useEffect(() => {
    api.providersHealth().then(setProvHealth).catch(() => {});
  }, []);

  // Persiste a aba activa.
  useEffect(() => {
    try {
      localStorage.setItem(TAB_KEY, tab);
    } catch {
      /* modo privado sem localStorage: só não fica guardado */
    }
  }, [tab]);

  async function pickAvatar(value) {
    setError(null);
    setSaving(true);
    try {
      await updateAvatar(value);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  // Bio/privacidade locais, sincronizadas com o utilizador (ex.: após login).
  useEffect(() => {
    setBio(user?.bio || "");
    setIsPublic(user?.isPublic !== false);
  }, [user]);

  async function saveProfile() {
    setProfileSaving(true);
    setProfileMsg(null);
    try {
      await updateProfile({ bio, isPublic });
      setProfileMsg(t("Perfil atualizado. ✓"));
    } catch (e) {
      setProfileMsg(e.message);
    } finally {
      setProfileSaving(false);
    }
  }

  // Servidor: ler a configuracao atual (so no desktop Electron).
  useEffect(() => {
    if (!desktop?.getServerConfig) return;
    desktop
      .getServerConfig()
      .then((c) => {
        setSrv(c);
        setSrvMode(c?.mode === "remote" ? "remote" : "local");
        setSrvUrl(c?.url || "");
      })
      .catch(() => {});
  }, [desktop]);

  async function saveServer() {
    if (!desktop?.setServerConfig) return;
    setSrvMsg(null);
    setSrvErr(false);
    setSrvBusy(true);
    let r;
    try {
      r = await desktop.setServerConfig({ mode: srvMode, url: srvUrl });
    } catch {
      r = null;
    }
    if (!r || r.ok === false) {
      setSrvErr(true);
      setSrvMsg(r?.error || t("Não foi possível guardar."));
      setSrvBusy(false);
      return;
    }
    setSrv(r.config);
    setSrvMsg(t("Guardado. A reiniciar..."));
    // Deixa a mensagem aparecer antes de reiniciar.
    setTimeout(() => desktop.restartApp?.(), 600);
  }

  // Mudar as sinopses nao deve arrastar os generos: se estes estao a seguir as
  // sinopses (genreLang vazio), fixa-os no idioma antigo ao trocar as sinopses.
  function pickOverview(value) {
    const patch = { overviewLang: value };
    if (value !== settings.overviewLang && !settings.genreLang) {
      patch.genreLang = settings.overviewLang;
    }
    update(patch);
  }

  // Descarrega a biblioteca + diário em JSON ou CSV. O CSV é gerado aqui no
  // browser a partir do JSON da API (sem dependências extra no servidor).
  async function exportData(format) {
    setExportMsg(null);
    setExporting(format);
    try {
      const { library, diary, exportedAt } = await api.exportData();
      const stamp = (exportedAt || new Date().toISOString()).slice(0, 10);
      let blob;
      let filename;
      if (format === "csv") {
        const cell = (v) => {
          if (v == null) return "";
          const s = String(v);
          return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        };
        const csv = (header, rows) =>
          [header.join(","), ...rows.map((r) => r.map(cell).join(","))].join("\r\n");
        const libCsv = csv(
          ["type", "tmdbId", "title", "titleEn", "titleRomaji", "generos", "nota", "media_comunidade", "visto", "watchlist", "atualizado_em", "visto_em"],
          library.map((i) => [
            i.type,
            i.tmdbId,
            i.title,
            i.titleEn,
            i.titleRomaji,
            (i.genres || []).join(" | "),
            i.score,
            i.rating,
            i.watched ? "sim" : "",
            i.watchlist ? "sim" : "",
            i.updatedAt,
            // Vazio = "nao se sabe quando foi visto". **Nunca** se escreve
            // aqui o `updatedAt`: a data do ultimo toque nao e' a data em que a
            // pessoa o viu, e um export/import que as trocasse punha meses e anos
            // errados na timeline do outro PC sem ninguem ter como saber.
            i.watchedAt || "",
          ])
        );
        const diaryCsv = csv(
          ["type", "tmdbId", "title", "temporada", "episodio", "estado", "comecou", "acabou", "atualizado_em"],
          diary.map((d) => [
            d.type,
            d.tmdbId,
            d.title,
            d.season,
            d.episode,
            d.status,
            d.startedAt,
            d.finishedAt,
            d.updatedAt,
          ])
        );
        blob = new Blob(
          [`# biblioteca\r\n${libCsv}\r\n# diario\r\n${diaryCsv}`],
          { type: "text/csv;charset=utf-8" }
        );
        filename = `meida-export-${stamp}.csv`; // i18n: nome de ficheiro, igual nos dois idiomas
      } else {
        blob = new Blob([JSON.stringify({ exportedAt, library, diary }, null, 2)], {
          type: "application/json;charset=utf-8",
        });
        filename = `meida-export-${stamp}.json`; // i18n: nome de ficheiro, igual nos dois idiomas
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setExportMsg(t("Ficheiro descarregado. Vai à pasta de downloads do teu sistema."));
    } catch (e) {
      setExportMsg(e.message || t("Não foi possível exportar."));
    } finally {
      setExporting(null);
    }
  }

  // Lê o ficheiro escolhido (JSON ou CSV) como texto para enviar ao backend.
  function onImportPick(e) {
    setImportMsg(null);
    const f = e.target.files?.[0] || null;
    setImportFile(f);
    e.target.value = "";
  }

  // Envia o ficheiro para o backend fazer o merge da library + diário.
  async function runImport() {
    if (!importFile) return;
    setImporting(true);
    setImportMsg(null);
    setImportError(false);
    try {
      const text = await importFile.text();
      let payload;
      const isCsv = importFile.name.toLowerCase().endsWith(".csv") || text.includes("# biblioteca");
      if (isCsv) {
        payload = { format: "csv", text };
      } else {
        const parsed = JSON.parse(text);
        payload = { format: "json", library: parsed.library || [], diary: parsed.diary || [] };
      }
      const d = await api.importData(payload);
      setImportMsg(
      t("Importados {n} títulos e {d} entradas do diário.", {
        n: d.imported.library,
        d: d.imported.diary,
      })
    );
      setImportFile(null);
    } catch (e) {
      setImportMsg(e.message || t("Não foi possível importar."));
      setImportError(true);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="sub-page settings-page" data-active-tab={tab}>
      <h2 className="row-title">{t("Definições")}</h2>

      {/* Abas: uma secção de cada vez, para não teres de rolar a página toda. */}
      <nav className="mode-tabs settings-tabs" role="tablist" aria-label={t("Secções das definições")}>
        {/* A variavel chama-se `tabDef` e nao `t`: `t` ja e' a funcao de traducao
            (do `useT()`), e um `t` dentro do map a tapava. */}
        {TABS.map((tabDef) => (
          <button
            key={tabDef.id}
            type="button"
            role="tab"
            aria-selected={tab === tabDef.id}
            className={tab === tabDef.id ? "active" : ""}
            onClick={() => setTab(tabDef.id)}
          >
            {t(tabDef.label)}
          </button>
        ))}
      </nav>

      {/* ===== Servidor (so no desktop Electron) ===== */}
      {desktop?.getServerConfig && (
        <section className="set-section" data-tab="dados">
          <h3>{t("Servidor")}</h3>
          <p className="muted">
            {t("Onde ficam os teus dados. {a} guarda tudo localmente.", {
              a: <strong>{t("Este computador")}</strong>,
            })}{" "}
            {t("{a} liga a app a um MEIDA alojado noutro sítio, para partilhares conta, biblioteca, seguidores e comentários entre dispositivos.", {
              a: <strong>{t("Servidor remoto")}</strong>,
            })}
          </p>
          {srv && !srv.packaged && (
            <p className="muted">
              {t("Estás em desenvolvimento — esta opção só se aplica à app instalada.")}
            </p>
          )}
          <div className="set-row set-server-row">
            <button
              className={`set-server-choice ${srvMode === "local" ? "active" : ""}`}
              onClick={() => setSrvMode("local")}
            >
              {t("Este computador")}
            </button>
            <button
              className={`set-server-choice ${srvMode === "remote" ? "active" : ""}`}
              onClick={() => setSrvMode("remote")}
            >
              {t("Servidor remoto")}
            </button>
          </div>
          {srvMode === "remote" && (
            <label className="set-field">
              <span>{t("Endereço do servidor")}</span>
              <input
                className="set-text"
                type="url"
                inputMode="url"
                placeholder="https://meida.exemplo.com"
                value={srvUrl}
                onChange={(e) => setSrvUrl(e.target.value)}
                spellCheck={false}
                autoCapitalize="none"
                autoCorrect="off"
              />
            </label>
          )}
          <button className="lib-watched" onClick={saveServer} disabled={srvBusy}>
            {srvBusy ? t("A guardar...") : t("Guardar e reiniciar")}
          </button>
          {srv && (
            <p className="muted">
              {t("A ligar a: {destino}", {
                destino: (
                  <strong>
                    {srv.mode === "remote" && srv.url
                      ? srv.url
                      : t("servidor local deste computador")}
                  </strong>
                ),
              })}
            </p>
          )}
          {srvMsg && <p className={srvErr ? "status error" : "muted"}>{srvMsg}</p>}
          <p className="muted">
            {t("O servidor remoto tem de correr o MEIDA com a web incluída (ex.: {cmd}).", { cmd: "npm run start:pwa" })}
          </p>
        </section>
      )}

      {/* ===== Idiomas ===== */}
      {/* O idioma da INTERFACE, que e' uma coisa diferente do idioma dos
          titulos (o de baixo). Este e' o que traduz os botoes e os menus; aquele
          so' muda "Inception" -> "A Origem" no catalogo.
          Fica em primeiro porque e' o que torna a app legivel para quem nao
          fala portugues. */}
      <section className="set-section" data-tab="conteudo">
        <h3>{t("Idioma da interface")}</h3>
        <p className="muted">{t("A lingua dos botoes, menus e textos da app.")}</p>
        <div className="set-row">
          {t.linguas.map((l) => (
            <Choice key={l} value={l} current={t.idioma} onPick={t.mudarIdioma}>
              {NOMES_IDIOMA[l]}
            </Choice>
          ))}
        </div>
      </section>

      <section className="set-section" data-tab="conteudo">
        <h3>{t("Títulos")}</h3>
        <p className="muted">{t("Idioma dos nomes de filmes, séries e anime.")}</p>
        <div className="set-row">
          <Choice value="pt" current={settings.titleLang} onPick={(v) => update({ titleLang: v })}>
            Português
          </Choice>
          <Choice value="en" current={settings.titleLang} onPick={(v) => update({ titleLang: v })}>
            Inglês
          </Choice>
        </div>
      </section>

      <section className="set-section" data-tab="conteudo">
        <h3>{t("Sinopses")}</h3>
        <p className="muted">{t("Idioma das descrições/sinopses.")}</p>
        <div className="set-row">
          <Choice value="pt" current={settings.overviewLang} onPick={pickOverview}>
            Português
          </Choice>
          <Choice value="en" current={settings.overviewLang} onPick={pickOverview}>
            Inglês
          </Choice>
        </div>
      </section>

      <section className="set-section" data-tab="conteudo">
        <h3>{t("Géneros")}</h3>
        <p className="muted">{t("Idioma dos géneros e temas (na tua lista, filtros e detalhes).")}</p>
        <div className="set-row">
          <Choice
            value="pt"
            current={settings.genreLang || settings.overviewLang}
            onPick={(v) => update({ genreLang: v })}
          >
            Português
          </Choice>
          <Choice
            value="en"
            current={settings.genreLang || settings.overviewLang}
            onPick={(v) => update({ genreLang: v })}
          >
            Inglês
          </Choice>
        </div>
      </section>

      <section className="set-section" data-tab="reproducao">
        <h3>{t("Legendas")}</h3>
        <p className="muted">
          {t("Legenda preferida (ativada automaticamente nos players sem anúncios e de torrents).")}
        </p>
        <div className="set-row">
          <Choice value="pt" current={settings.subtitleLang} onPick={(v) => update({ subtitleLang: v })}>
            Português
          </Choice>
          <Choice value="en" current={settings.subtitleLang} onPick={(v) => update({ subtitleLang: v })}>
            Inglês
          </Choice>
          <Choice value="off" current={settings.subtitleLang} onPick={(v) => update({ subtitleLang: v })}>
            Desligadas
          </Choice>
        </div>
      </section>

      <section className="set-section" data-tab="reproducao">
        <h3>{t("Anime: áudio")}</h3>
        <p className="muted">
          {t("Legendado (sub) ou dobrado (dub). Aplica-se às fontes dedicadas de anime (MegaPlay/VidLink/VidSrc.cc por MyAnimeList).")}
        </p>
        <div className="set-row">
          <Choice value="sub" current={settings.animeAudio} onPick={(v) => update({ animeAudio: v })}>
            Sub (legendado)
          </Choice>
          <Choice value="dub" current={settings.animeAudio} onPick={(v) => update({ animeAudio: v })}>
            Dub (dobrado)
          </Choice>
        </div>
      </section>

      <section className="set-section" data-tab="conteudo">
        <h3>{t("Anime: títulos")}</h3>
        <p className="muted">
          {t("Como mostrar os nomes dos animes (catálogo, pesquisa e a tua lista).")}
        </p>
        <div className="set-row">
          <Choice value="en" current={settings.animeTitleLang} onPick={(v) => update({ animeTitleLang: v })}>
            Inglês
          </Choice>
          <Choice value="romaji" current={settings.animeTitleLang} onPick={(v) => update({ animeTitleLang: v })}>
            Romaji
          </Choice>
        </div>
      </section>

      <section className="set-section" data-tab="conteudo">
        <h3>{t("Conteúdo adulto (anime)")}</h3>
        <p className="muted">
          {t('Mostrar anime adulto (NSFW/hentai) na pesquisa, nos filtros de género e no "Escolhe algo para mim". Desligado por defeito.')}
        </p>
        <div className="set-row">
          <Choice value={false} current={settings.showAdult} onPick={(v) => update({ showAdult: v })}>
            Esconder
          </Choice>
          <Choice value={true} current={settings.showAdult} onPick={(v) => update({ showAdult: v })}>
            Mostrar
          </Choice>
        </div>
      </section>

      <section className="set-section" data-tab="reproducao">
        <h3>{t("Separador inicial")}</h3>
        <p className="muted">{t("Onde abrir por defeito ao ver um título.")}</p>
        <div className="set-row">
          <Choice value="providers" current={settings.defaultTab} onPick={(v) => update({ defaultTab: v })}>
            Providers
          </Choice>
          <Choice value="extract" current={settings.defaultTab} onPick={(v) => update({ defaultTab: v })}>
            {t("Sem anúncios")}
          </Choice>
          <Choice value="torrents" current={settings.defaultTab} onPick={(v) => update({ defaultTab: v })}>
            Torrents
          </Choice>
        </div>
      </section>

      {/* ===== Reprodução ===== */}
      <section className="set-section" data-tab="reproducao">
        <h3>{t("Reprodução")}</h3>
        <p className="muted">
          {t("Autoplay liga/desliga o arranque automático. Autoskip tenta saltar a intro/genéricos (funciona nos nossos players; nos providers externos depende do site).")}
        </p>
        <div className="set-row">
          <Choice value={true} current={settings.autoplay} onPick={(v) => update({ autoplay: v })}>
            {t("Autoplay ligado")}
          </Choice>
          <Choice value={false} current={settings.autoplay} onPick={(v) => update({ autoplay: v })}>
            {t("Autoplay desligado")}
          </Choice>
        </div>
        <div className="set-row" style={{ marginTop: 8 }}>
          <Choice value={true} current={settings.autoskip} onPick={(v) => update({ autoskip: v })}>
            {t("Autoskip ligado")}
          </Choice>
          <Choice value={false} current={settings.autoskip} onPick={(v) => update({ autoskip: v })}>
            {t("Autoskip desligado")}
          </Choice>
        </div>
      </section>

      {/* ===== Tamanho dos cartazes ===== */}
      <section className="set-section" data-tab="aparencia">
        <h3>{t("Tamanho dos cartazes")}</h3>
        <p className="muted">
          {t("Ajusta a largura e a altura dos posters (útil em ecrãs pequenos).")}
        </p>
        <div className="set-slider">
          <label>
            <span>{t("Largura")}</span>
            <b>{settings.cardW || 184}px</b>
          </label>
          <input
            type="range"
            min="110"
            max="280"
            step="2"
            value={settings.cardW || 184}
            onChange={(e) => update({ cardW: Number(e.target.value) })}
          />
        </div>
        <div className="set-slider">
          <label>
            <span>{t("Altura")}</span>
            <b>{settings.cardH || 272}px</b>
          </label>
          <input
            type="range"
            min="150"
            max="420"
            step="2"
            value={settings.cardH || 272}
            onChange={(e) => update({ cardH: Number(e.target.value) })}
          />
        </div>
        <button
          className="set-clear"
          onClick={() => update({ cardW: 184, cardH: 272 })}
        >
          {t("Repor tamanho")}
        </button>
      </section>

      {/* ===== Cor da UI ===== */}
      <section className="set-section" data-tab="aparencia">
        <h3>{t("Cor de destaque")}</h3>
        <p className="muted">
          {t("Cor dos botões e realces. Predefinidas, as tuas últimas escolhas, ou o picker.")}
        </p>
        <ColorField
          presets={ACCENT_PRESETS}
          value={settings.accent}
          recent={settings.recentAccent}
          fallback="#c90303"
          onPick={(v) => update({ accent: v })}
          onCommit={(v) => update({ recentAccent: addRecent(settings.recentAccent, v) })}
        />
        {avisoAcento && (
          <p className="vhint vhint-erro" role="alert">
            {t("A cor de destaque escolhida tem pouco contraste sobre o fundo ({ratio}:1). O texto em destaque pode ser dificil de ler — escolha uma cor mais clara.", {
              ratio: avisoAcento.ratio,
            })}
          </p>
        )}
      </section>

      {/* ===== Cor de fundo ===== */}
      <section className="set-section" data-tab="aparencia">
        <h3>{t("Cor de fundo")}</h3>
        <p className="muted">
          {t("Fundo da app. Predefinidas (escuras, texto legível), as tuas últimas escolhas, ou o picker.")}
        </p>
        <ColorField
          presets={BG_PRESETS}
          value={settings.bgColor}
          recent={settings.recentBg}
          fallback="#070708"
          onPick={(v) => update({ bgColor: v })}
          onCommit={(v) => update({ recentBg: addRecent(settings.recentBg, v) })}
        />
      </section>

      {/* ===== Estilo de fundo ===== */}
      <section className="set-section" data-tab="aparencia">
        <h3>{t("Estilo de fundo")}</h3>
        <p className="muted">
          {t("Simples (só a cor), um padrão por cima, ou uma imagem tua (como o fundo do WhatsApp). O padrão usa a tua cor de destaque.")}
        </p>
        <div className="set-row">
          {[
            { id: "none", label: "Simples" },
            { id: "glow", label: "Brilho" },
            { id: "aurora", label: "Aurora" },
            { id: "mesh", label: "Malha" },
            { id: "dots", label: "Pontos" },
            { id: "grid", label: "Grelha" },
            { id: "image", label: "Imagem" },
          ].map((o) => (
            <Choice
              key={o.id}
              value={o.id}
              current={settings.bgStyle || "none"}
              onPick={(v) => update({ bgStyle: v })}
            >
              {t(o.label)}
            </Choice>
          ))}
        </div>
        {erroGuardar && (
          <p
            style={{
              margin: "12px 0 0",
              fontSize: 12,
              color: "#ffb4a2",
              borderLeft: "3px solid #ff6a3d",
              paddingLeft: 8,
            }}
          >
            {erroGuardar}
          </p>
        )}
        {settings.bgStyle === "image" && (
          <div style={{ marginTop: 12 }}>
            {!settings.bgImage && (
              <p className="muted" style={{ margin: "0 0 10px", fontSize: 12 }}>
                {t(
                  "Escolhe uma imagem para o fundo. Sem imagem, o fundo fica so com a cor escura e parece que a app esta preta."
                )}
              </p>
            )}
            <div className="set-img-url">
              <input
                className="set-input"
                type="text"
                placeholder={t("Cola o URL de uma imagem (https://...)")}
                value={settings.bgImage?.startsWith("data:") ? "" : settings.bgImage || ""}
                onChange={(e) => update({ bgImage: e.target.value.trim() })}
              />
              <label className="lib-watched" style={{ cursor: "pointer" }}>
                {t("Escolher do PC")}
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      try {
                        update({ bgImage: await imageFileToDataUrl(f) });
                      } catch {
                        /* imagem invalida -> ignora */
                      }
                    }
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
            {settings.bgImage && (
              <div className="set-bg-preview-row">
                <div
                  className="set-bg-preview"
                  style={{ backgroundImage: `url("${settings.bgImage}")` }}
                />
                <span className="muted" style={{ fontSize: 12 }}>
                  {settings.bgImage.startsWith("data:")
                    ? t("Imagem do computador")
                    : t("Imagem por URL")}
                </span>
                <button className="set-clear" onClick={() => update({ bgImage: "" })}>
                  {t("Remover imagem")}
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ===== MyAnimeList ===== */}
      <section className="set-section" data-tab="contas">
        <h3>{t("MyAnimeList")}</h3>
        <MalSection user={user} />
      </section>

      {/* ===== AniList ===== */}
      <section className="set-section" data-tab="contas">
        <h3>{t("AniList")}</h3>
        <AniListSection user={user} />
      </section>

      {/* ===== Os teus dados ===== */}
      <section className="set-section" data-tab="dados">
        <h3>{t("Os teus dados")}</h3>
        <p className="muted">
          {t("Descarrega a tua biblioteca e diário. Em JSON (para fazer backup ou voltar a usar depois) ou CSV (para abrir no Excel/Sheets).")}
        </p>
        <div className="set-row">
          <button
            className="set-choice"
            onClick={() => exportData("json")}
            disabled={exporting !== null}
          >
            {exporting === "json" ? t("A exportar...") : "Exportar JSON"}
          </button>
          <button
            className="set-choice"
            onClick={() => exportData("csv")}
            disabled={exporting !== null}
          >
            {exporting === "csv" ? t("A exportar...") : "Exportar CSV"}
          </button>
        </div>
        {exportMsg && <span className="muted" style={{ display: "block", marginTop: 8 }}>{exportMsg}</span>}
      </section>

      {/* ===== Discord ===== */}
      <section className="set-section" data-tab="dados">
        <h3>{t("Discord")}</h3>
        <p className="muted">
          {t("Aparece ao lado do teu nome no Discord o que estás a ver, como no Stremio. Só funciona com a app do Discord aberta neste computador, e nada é enviado para a internet — a MEIDA escreve directamente no Discord do teu PC.")}
        </p>
        {presenceSupported() ? (
          <label className="set-toggle">
            <input
              type="checkbox"
              checked={settings.discordPresence !== false}
              onChange={(e) => {
                update({ discordPresence: e.target.checked });
                // Desligar deve esconder o que já estava a aparecer.
                if (!e.target.checked) clearPresence();
              }}
            />
            <span>{t("Mostrar no Discord o que estou a ver")}</span>
          </label>
        ) : (
          <p className="muted">
            {t("Isto só funciona na app de computador (Electron), não na versão web.")}
          </p>
        )}
      </section>

      {/* ===== Importar dados ===== */}
      <section className="set-section" data-tab="dados">
        <h3>{t("Importar dados")}</h3>
        <p className="muted">
          {t("Carrega um ficheiro JSON ou CSV exportado da MEIDA para voltar a carregar a tua biblioteca e diário. É um merge: não apaga notas nem visto que o ficheiro não traga.")}
        </p>
        <div className="set-row">
          <label className="lib-watched" style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <svg
              aria-hidden="true"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6" />
              <polyline points="18 1 11 8 13 8 13 22 18 22 18 8 21 8 18 1 18 1" />
            </svg>
            {t("Escolher ficheiro")}
            <input
              type="file"
              accept=".json,.csv,text/csv,text/anytext,.bak"
              style={{ display: "none" }}
              onChange={onImportPick}
            />
          </label>
          <span className="muted" style={{ fontSize: 12 }}>
            {importFile ? importFile.name : t("Sem ficheiro")}
          </span>
        </div>
        {importFile && (
          <button className="set-choice" onClick={runImport} disabled={importing}>
            {importing ? t("A importar...") : "Importar"}
          </button>
        )}
        {importMsg && <span className={`muted ${importError ? "auth-error" : ""}`}>{importMsg}</span>}
        {/* Atalho para o mesmo assistente de sempre, aqui no sitio onde se vai
            buscar a segunda vez. **E' o caminho que o `deveMostrar` nao da'**:
            quem ja tem titulos nunca ve o wizard sozinho, e sem esta botao o
            assistente so existia no primeiro minuto de vida de uma conta.

            `window.abrirOnboarding` e' registado pelo `App.jsx` e **desligado
            logo** (`onFechar` volta a por `false`): se ficasse ligado, este
            botao abriria o wizard em todas as navegacoes seguintes. */}
        <div className="set-row">
          <button
            className="set-choice"
            onClick={() => {
              if (typeof window !== "undefined" && window.abrirOnboarding) {
                window.abrirOnboarding();
              }
            }}
          >
            {t("Assistente de importação")}
          </button>
        </div>
      </section>

      {/* ===== Letterboxd ===== */}
      <section className="set-section" data-tab="contas">
        <h3>{t("Letterboxd")}</h3>
        <LetterboxdSection user={user} />
      </section>

      {/* ===== Real-Debrid ===== */}
      <section className="set-section" data-tab="contas">
        <h3>{t("Real-Debrid")}</h3>
        <DebridSection user={user} />
      </section>

      {/* ===== Perfil público ===== */}
      <section className="set-section" data-tab="perfil">
        <h3>{t("Perfil")}</h3>
        {!user ? (
          <p className="muted">
            <Link to="/login">{t("Entra")}</Link> {t("para editares o teu perfil.")}
          </p>
        ) : (
          <>
            <p className="muted">
              {t("É o que os outros veem quando visitam o teu perfil. A biblioteca e as listas só aparecem se o perfil estiver público.")}
            </p>
            <label className="set-field">
              <span>{t("Bio")}</span>
              <textarea
                className="set-bio"
                value={bio}
                maxLength={300}
                rows={3}
                placeholder={t("Uma frase sobre os teus gostos...")}
                onChange={(e) => setBio(e.target.value)}
              />
            </label>
            <label className="set-toggle">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
              />
              <span>
                {t("Perfil público — qualquer pessoa pode ver a tua biblioteca e listas.{estado}", {
                  estado: !isPublic ? t(" (agora está privado: só tu vês)") : "",
                })}
              </span>
            </label>
            <button
              className="lib-watched"
              onClick={saveProfile}
              disabled={profileSaving}
            >
              {profileSaving ? t("A guardar...") : t("Guardar perfil")}
            </button>
            {profileMsg && <p className="muted">{profileMsg}</p>}
          </>
        )}
      </section>

      {/* ===== Avatar ===== */}
      <section className="set-section" data-tab="perfil">
        <h3>{t("Avatar")}</h3>
        {!user ? (
          <p className="muted">
            <Link to="/login">{t("Entra")}</Link> {t("para escolheres um avatar.")}
          </p>
        ) : (
          <>
            <div className="set-avatar-current">
              <Avatar avatar={user.avatar} name={user.username} size={64} userId={user.id} />
              <span className="muted">{user.username}</span>
            </div>

            <div className="avatar-grid">
              {AVATAR_EMOJIS.map((e) => {
                const val = `emoji:${e}`;
                return (
                  <button
                    key={e}
                    className={`avatar-opt ${user.avatar === val ? "active" : ""}`}
                    onClick={() => pickAvatar(val)}
                    disabled={saving}
                  >
                    {e}
                  </button>
                );
              })}
            </div>

            <div className="set-img-url">
              <input
                type="url"
                placeholder={t("...ou cola o URL de uma imagem (https://...)")}
                value={imgUrl}
                onChange={(e) => setImgUrl(e.target.value)}
              />
              <button
                className="lib-watched"
                onClick={() => pickAvatar(imgUrl)}
                disabled={saving || !imgUrl.trim()}
              >
                {t("Usar URL")}
              </button>
              <label className="lib-watched" style={{ cursor: "pointer" }}>
                {t("Escolher do PC")}
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      try {
                        await pickAvatar(await imageFileToDataUrl(f, 256));
                      } catch {
                        /* imagem invalida -> ignora */
                      }
                    }
                    e.target.value = "";
                  }}
                />
              </label>
            </div>

            {user.avatar && (
              <button
                className="set-clear"
                onClick={() => pickAvatar("")}
                disabled={saving}
              >
                {t("Remover avatar")}
              </button>
            )}
            {error && <p className="auth-error">{error}</p>}
          </>
        )}
      </section>

      {/* ===== Estado dos providers ===== */}
      <section className="set-section" data-tab="avancado">
        <h3>{t("Estado dos providers")}</h3>
        <p className="muted">
          {t("Fontes de stream usadas no player (embeds). Quando um está morto fica riscado e é saltado na escolha automática.")}
        </p>
        {provHealth?.checking && !provHealth?.providers ? (
          <p className="muted">{t("A testar providers...")}</p>
        ) : !provHealth?.providers ? (
          <p className="muted">{t("Sem informação.")}</p>
        ) : (
          <div className="provider-health-list">
            {provHealth.providers.map((p) => (
              <div className="provider-health-row" key={p.id}>
                <span className={p.ok ? "ph-ok" : "ph-dead"}>
                  {p.ok ? "●" : "✕"} {p.name}
                </span>
                {!p.ok && p.error && (
                  // `t()` em volta: o motivo vem do servidor, em portugues, e
                  // sao as razoes que became mais uteis com o probe do nativo
                  // (ver `probeNativo`). Sem traduzir, quem esta' em ingles le
                  // o motivo em portugues — e o `t()` devolve a propria chave
                  // quando nao a conhece, entao os motivos antigos (HTTP 500,
                  // timeout) ficam como estavam.
                  <span className="ph-reason muted">({t(p.error)})</span>
                )}
              </div>
            ))}
          </div>
        )}
        {provHealth?.stale && <span className="ph-stale">{t("Atualizado há 24h+")}</span>}
        <div className="set-row" style={{ marginTop: 8 }}>
          <button
            className="set-choice"
            onClick={async () => {
              setProvHealth({ checking: true, providers: null, stale: false });
              try {
                setProvHealth(await api.providersHealth(true));
              } catch (e) {
                setProvHealth(null);
              }
            }}
          >
            {t("Rever agora")}
          </button>
        </div>
      </section>

      {/* ===== App (só na app instalada) ===== */}
      {typeof window !== "undefined" && window.electronAPI?.uninstall && (
        <section className="set-section" data-tab="avancado">
          <h3>{t("Atualizações")}</h3>
          <p className="muted">
            {t("Procura uma versão nova da MEIDA. Não precisas de ter conta.")}
          </p>
          <button onClick={checkUpdate} disabled={updBusy}>
            {updBusy ? t("A procurar...") : t("Procurar atualização")}
          </button>
          {updMsg && <p className="muted">{updMsg}</p>}
          <h3 style={{ marginTop: 22 }}>{t("Desinstalar")}</h3>
          <p className="muted">
            {t("Remove a MEIDA do computador. A app fecha e o desinstalador abre.")}
          </p>
          <button
            className="set-clear danger"
            onClick={() => window.electronAPI.uninstall()}
          >
            {t("Desinstalar MEIDA")}
          </button>
        </section>
      )}
    </div>
  );
}
