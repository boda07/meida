import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useSettings } from "../settings/SettingsContext.jsx";
import { useAuth } from "../auth/AuthContext.jsx";
import { api, openExternal } from "../api/client.js";
import Avatar, { AVATAR_EMOJIS } from "../components/Avatar.jsx";
import { clearPresence, presenceSupported } from "../discord.js";

// Seccao de ligacao ao MyAnimeList.
function MalSection({ user }) {
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
      setMsg("Autoriza no browser e volta a esta janela.");
    } catch (e) {
      setMsg(e.message);
    }
  }

  async function importList() {
    setBusy(true);
    setMsg(null);
    try {
      const d = await api.malImport();
      setMsg(`Importados ${d.imported} animes para a tua lista.`);
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
        <Link to="/login">Entra</Link> para ligares o MyAnimeList.
      </p>
    );
  }
  if (!enabled) {
    return (
      <p className="muted">
        O servidor não tem o MyAnimeList configurado (falta MAL_CLIENT_ID).
      </p>
    );
  }

  return (
    <div>
      {linked ? (
        <>
          <p className="muted">
            Ligado como <b>{username || "?"}</b>. Os episódios de anime que vires
            são marcados no teu MAL automaticamente.
          </p>
          <div className="set-row">
            <button className="set-choice active" onClick={importList} disabled={busy}>
              {busy ? "A importar..." : "Importar lista do MAL"}
            </button>
            <button className="set-clear" onClick={unlink}>Desligar conta</button>
          </div>
        </>
      ) : (
        <>
          <p className="muted">
            Liga a tua conta para importar a tua lista e marcar episódios vistos.
          </p>
          <button className="set-choice active" onClick={link}>
            Ligar MyAnimeList
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
      setMsg("Autoriza no browser e volta a esta janela.");
    } catch (e) {
      setMsg(e.message);
    }
  }

  async function importList() {
    setBusy(true);
    setMsg(null);
    try {
      const d = await api.anilistImport();
      setMsg(`Importados ${d.imported} animes para a tua lista.`);
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
      setMsg(`Cross-sync concluído: +${d.malUpdated} no MAL, +${d.aniUpdated} no AniList.`);
    } catch (e) {
      setMsg(e.message || "Falha na sincronização.");
    } finally {
      setSyncing(false);
    }
  }

  if (!user) {
    return (
      <p className="muted">
        <Link to="/login">Entra</Link> para ligares o AniList.
      </p>
    );
  }
  if (!enabled) {
    return (
      <p className="muted">
        O servidor não tem o AniList configurado (falta ANILIST_CLIENT_ID).
      </p>
    );
  }

  return (
    <div>
      {linked ? (
        <>
            <p className="muted">
              Ligado como <b>{username || "?"}</b>. Quando não tens o MyAnimeList
              ligado, os episódios de anime que vires são marcados no teu AniList
              automaticamente. Se tens o MAL também ligado, podes fazer cross-sync
              manual (Sincronizar com MAL) ou ela corre automaticamente ao abrir a
              Library.
            </p>
          <div className="set-row">
            <button className="set-choice active" onClick={importList} disabled={busy}>
              {busy ? "A importar..." : "Importar lista do AniList"}
            </button>
            {malLinked && (
              <button className="set-choice" onClick={syncCross} disabled={syncing}>
                {syncing ? "A sincronizar..." : "Sincronizar com MAL"}
              </button>
            )}
            <button className="set-clear" onClick={unlink}>Desligar conta</button>
          </div>
        </>
      ) : (
        <>
          <p className="muted">
            Liga a tua conta para importar a tua lista e marcar episódios vistos.
          </p>
          <button className="set-choice active" onClick={link}>
            Ligar AniList
          </button>
        </>
      )}
      {msg && <p className="muted" style={{ marginTop: 10 }}>{msg}</p>}
    </div>
  );
}

// Seccao de ligacao ao Letterboxd (filmes).
function LetterboxdSection({ user }) {
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
      setMsg("Conta ligada. Carrega em Importar para trazer os teus filmes.");
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
      if (what === "films") setMsg(`Importados ${d.imported} filmes vistos.`);
      else if (what === "watchlist") setMsg(`Importados ${d.watchlist} da watchlist.`);
      else setMsg(`Importados ${d.imported} vistos + ${d.watchlist} da watchlist.`);
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
        <Link to="/login">Entra</Link> para ligares o Letterboxd.
      </p>
    );
  }

  return (
    <div>
      {username ? (
        <>
          <p className="muted">
            Ligado como <b>{username}</b>. A nota da comunidade dos teus filmes
            (na tua lista) passa a vir do Letterboxd.
          </p>
          <div className="set-row">
            <button className="set-choice active" onClick={() => importList("films")} disabled={busy}>
              {busy ? "A importar..." : "Importar vistos"}
            </button>
            <button className="set-choice active" onClick={() => importList("watchlist")} disabled={busy}>
              {busy ? "A importar..." : "Importar watchlist"}
            </button>
            <button className="set-choice" onClick={() => importList("all")} disabled={busy}>
              {busy ? "A importar..." : "Importar tudo"}
            </button>
          </div>
          <div className="set-row" style={{ marginTop: 8 }}>
            <button className="set-clear" onClick={unlink}>
              Desligar conta
            </button>
          </div>
          <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
            Importa todos os filmes vistos (com as tuas notas) e/ou a watchlist
            completa. Em listas grandes pode demorar alguns segundos. Em cada
            filme tens um botao para o abrir no Letterboxd.
          </p>
        </>
      ) : (
        <>
          <p className="muted">
            Indica o teu username do Letterboxd para importar a tua watchlist e
            os filmes vistos (com as tuas notas), e usar a nota da comunidade do
            Letterboxd.
          </p>
          <div className="set-img-url">
            <input
              type="text"
              placeholder="username do Letterboxd"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && input.trim() && link()}
            />
            <button
              className="lib-watched"
              onClick={link}
              disabled={busy || !input.trim()}
            >
              {busy ? "A ligar..." : "Ligar"}
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
      setMsg("Real-Debrid ligado. Os torrents em cache no DeBrid reproduzem logo.");
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
        <Link to="/login">Entra</Link> para ligares o Real-Debrid.
      </p>
    );
  }

  return (
    <div>
      {status?.linked ? (
        <>
          <p className="muted">
            Ligado como <b>{status.account}</b>. Nos torrents, os que estiverem em
            cache no Real-Debrid reproduzem <b>logo</b> (sem esperar por peers).
          </p>
          <div className="set-row" style={{ marginTop: 8 }}>
            <button className="set-clear" onClick={unlink}>
              Desligar
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="muted">
            Cola o teu token do Real-Debrid (obtém-no em{" "}
            <a
              href="https://real-debrid.com/apitoken"
              target="_blank"
              rel="noopener noreferrer"
            >
              real-debrid.com/apitoken
            </a>
            ). É um serviço pago (mas barato) que guarda os torrents em cache —
            por isso o stream começa imediatamente, como no Stremio.
          </p>
          <div className="set-img-url">
            <input
              type="password"
              placeholder="token do Real-Debrid"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && input.trim() && link()}
            />
            <button
              className="lib-watched"
              onClick={link}
              disabled={busy || !input.trim()}
            >
              {busy ? "A ligar..." : "Ligar"}
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
  const { settings, update } = useSettings();
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
    setUpdMsg("A procurar...");
    try {
      const r = await window.electronAPI.checkForUpdates();
      if (r?.status === "available")
        setUpdMsg(`Nova versão ${r.version} — a descarregar...`);
      else if (r?.status === "latest") setUpdMsg("Já tens a versão mais recente. ✓");
      else if (r?.status === "dev") setUpdMsg("Indisponível em desenvolvimento.");
      else setUpdMsg("Não foi possível verificar agora.");
    } catch {
      setUpdMsg("Não foi possível verificar agora.");
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
      setProfileMsg("Perfil atualizado. ✓");
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
      setSrvMsg(r?.error || "Não foi possível guardar.");
      setSrvBusy(false);
      return;
    }
    setSrv(r.config);
    setSrvMsg("Guardado. A reiniciar...");
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
          ["type", "tmdbId", "title", "titleEn", "titleRomaji", "generos", "nota", "media_comunidade", "visto", "watchlist", "atualizado_em"],
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
        filename = `meida-export-${stamp}.csv`;
      } else {
        blob = new Blob([JSON.stringify({ exportedAt, library, diary }, null, 2)], {
          type: "application/json;charset=utf-8",
        });
        filename = `meida-export-${stamp}.json`;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setExportMsg("Ficheiro descarregado. Vai à pasta de downloads do teu sistema.");
    } catch (e) {
      setExportMsg(e.message || "Não foi possível exportar.");
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
      setImportMsg(`Importados ${d.imported.library} títulos e ${d.imported.diary} entradas do diário.`);
      setImportFile(null);
    } catch (e) {
      setImportMsg(e.message || "Não foi possível importar.");
      setImportError(true);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="sub-page settings-page" data-active-tab={tab}>
      <h2 className="row-title">Definições</h2>

      {/* Abas: uma secção de cada vez, para não teres de rolar a página toda. */}
      <nav className="mode-tabs settings-tabs" role="tablist" aria-label="Secções das definições">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={tab === t.id ? "active" : ""}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* ===== Servidor (so no desktop Electron) ===== */}
      {desktop?.getServerConfig && (
        <section className="set-section" data-tab="dados">
          <h3>Servidor</h3>
          <p className="muted">
            Onde ficam os teus dados. <strong>Este computador</strong> guarda tudo localmente.{" "}
            <strong>Servidor remoto</strong> liga a app a um MEIDA alojado noutro sítio, para
            partilhares conta, biblioteca, seguidores e comentários entre dispositivos.
          </p>
          {srv && !srv.packaged && (
            <p className="muted">
              Estás em desenvolvimento — esta opção só se aplica à app instalada.
            </p>
          )}
          <div className="set-row set-server-row">
            <button
              className={`set-server-choice ${srvMode === "local" ? "active" : ""}`}
              onClick={() => setSrvMode("local")}
            >
              Este computador
            </button>
            <button
              className={`set-server-choice ${srvMode === "remote" ? "active" : ""}`}
              onClick={() => setSrvMode("remote")}
            >
              Servidor remoto
            </button>
          </div>
          {srvMode === "remote" && (
            <label className="set-field">
              <span>Endereço do servidor</span>
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
            {srvBusy ? "A guardar..." : "Guardar e reiniciar"}
          </button>
          {srv && (
            <p className="muted">
              A ligar a:{" "}
              <strong>
                {srv.mode === "remote" && srv.url ? srv.url : "servidor local deste computador"}
              </strong>
            </p>
          )}
          {srvMsg && <p className={srvErr ? "status error" : "muted"}>{srvMsg}</p>}
          <p className="muted">
            O servidor remoto tem de correr o MEIDA com a web incluída (ex.: <code>npm run start:pwa</code>).
          </p>
        </section>
      )}

      {/* ===== Idiomas ===== */}
      <section className="set-section" data-tab="conteudo">
        <h3>Títulos</h3>
        <p className="muted">Idioma dos nomes de filmes, séries e anime.</p>
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
        <h3>Sinopses</h3>
        <p className="muted">Idioma das descrições/sinopses.</p>
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
        <h3>Géneros</h3>
        <p className="muted">Idioma dos géneros e temas (na tua lista, filtros e detalhes).</p>
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
        <h3>Legendas</h3>
        <p className="muted">
          Legenda preferida (ativada automaticamente nos players sem anúncios e
          de torrents).
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
        <h3>Anime: áudio</h3>
        <p className="muted">
          Legendado (sub) ou dobrado (dub). Aplica-se às fontes dedicadas de anime
          (MegaPlay/VidLink/VidSrc.cc por MyAnimeList).
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
        <h3>Anime: títulos</h3>
        <p className="muted">
          Como mostrar os nomes dos animes (catálogo, pesquisa e a tua lista).
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
        <h3>Conteúdo adulto (anime)</h3>
        <p className="muted">
          Mostrar anime adulto (NSFW/hentai) na pesquisa, nos filtros de género e no
          "Escolhe algo para mim". Desligado por defeito.
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
        <h3>Separador inicial</h3>
        <p className="muted">Onde abrir por defeito ao ver um título.</p>
        <div className="set-row">
          <Choice value="providers" current={settings.defaultTab} onPick={(v) => update({ defaultTab: v })}>
            Providers
          </Choice>
          <Choice value="extract" current={settings.defaultTab} onPick={(v) => update({ defaultTab: v })}>
            Sem anúncios
          </Choice>
          <Choice value="torrents" current={settings.defaultTab} onPick={(v) => update({ defaultTab: v })}>
            Torrents
          </Choice>
        </div>
      </section>

      {/* ===== Reprodução ===== */}
      <section className="set-section" data-tab="reproducao">
        <h3>Reprodução</h3>
        <p className="muted">
          Autoplay liga/desliga o arranque automático. Autoskip tenta saltar a
          intro/genéricos (funciona nos nossos players; nos providers externos
          depende do site).
        </p>
        <div className="set-row">
          <Choice value={true} current={settings.autoplay} onPick={(v) => update({ autoplay: v })}>
            Autoplay ligado
          </Choice>
          <Choice value={false} current={settings.autoplay} onPick={(v) => update({ autoplay: v })}>
            Autoplay desligado
          </Choice>
        </div>
        <div className="set-row" style={{ marginTop: 8 }}>
          <Choice value={true} current={settings.autoskip} onPick={(v) => update({ autoskip: v })}>
            Autoskip ligado
          </Choice>
          <Choice value={false} current={settings.autoskip} onPick={(v) => update({ autoskip: v })}>
            Autoskip desligado
          </Choice>
        </div>
      </section>

      {/* ===== Tamanho dos cartazes ===== */}
      <section className="set-section" data-tab="aparencia">
        <h3>Tamanho dos cartazes</h3>
        <p className="muted">
          Ajusta a largura e a altura dos posters (útil em ecrãs pequenos).
        </p>
        <div className="set-slider">
          <label>
            <span>Largura</span>
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
            <span>Altura</span>
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
          Repor tamanho
        </button>
      </section>

      {/* ===== Cor da UI ===== */}
      <section className="set-section" data-tab="aparencia">
        <h3>Cor de destaque</h3>
        <p className="muted">
          Cor dos botões e realces. Predefinidas, as tuas últimas escolhas, ou o
          picker.
        </p>
        <ColorField
          presets={ACCENT_PRESETS}
          value={settings.accent}
          recent={settings.recentAccent}
          fallback="#c90303"
          onPick={(v) => update({ accent: v })}
          onCommit={(v) => update({ recentAccent: addRecent(settings.recentAccent, v) })}
        />
      </section>

      {/* ===== Cor de fundo ===== */}
      <section className="set-section" data-tab="aparencia">
        <h3>Cor de fundo</h3>
        <p className="muted">
          Fundo da app. Predefinidas (escuras, texto legível), as tuas últimas
          escolhas, ou o picker.
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
        <h3>Estilo de fundo</h3>
        <p className="muted">
          Simples (só a cor), um padrão por cima, ou uma imagem tua (como o fundo
          do WhatsApp). O padrão usa a tua cor de destaque.
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
              {o.label}
            </Choice>
          ))}
        </div>
        {settings.bgStyle === "image" && (
          <div style={{ marginTop: 12 }}>
            <div className="set-img-url">
              <input
                className="set-input"
                type="text"
                placeholder="Cola o URL de uma imagem (https://...)"
                value={settings.bgImage?.startsWith("data:") ? "" : settings.bgImage || ""}
                onChange={(e) => update({ bgImage: e.target.value.trim() })}
              />
              <label className="lib-watched" style={{ cursor: "pointer" }}>
                Escolher do PC
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
                    ? "Imagem do computador"
                    : "Imagem por URL"}
                </span>
                <button className="set-clear" onClick={() => update({ bgImage: "" })}>
                  Remover imagem
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ===== MyAnimeList ===== */}
      <section className="set-section" data-tab="contas">
        <h3>MyAnimeList</h3>
        <MalSection user={user} />
      </section>

      {/* ===== AniList ===== */}
      <section className="set-section" data-tab="contas">
        <h3>AniList</h3>
        <AniListSection user={user} />
      </section>

      {/* ===== Os teus dados ===== */}
      <section className="set-section" data-tab="dados">
        <h3>Os teus dados</h3>
        <p className="muted">
          Descarrega a tua biblioteca e diário. Em JSON (para fazer backup ou
          voltar a usar depois) ou CSV (para abrir no Excel/Sheets).
        </p>
        <div className="set-row">
          <button
            className="set-choice"
            onClick={() => exportData("json")}
            disabled={exporting !== null}
          >
            {exporting === "json" ? "A exportar..." : "Exportar JSON"}
          </button>
          <button
            className="set-choice"
            onClick={() => exportData("csv")}
            disabled={exporting !== null}
          >
            {exporting === "csv" ? "A exportar..." : "Exportar CSV"}
          </button>
        </div>
        {exportMsg && <span className="muted" style={{ display: "block", marginTop: 8 }}>{exportMsg}</span>}
      </section>

      {/* ===== Discord ===== */}
      <section className="set-section" data-tab="dados">
        <h3>Discord</h3>
        <p className="muted">
          Aparece ao lado do teu nome no Discord o que estás a ver, como no
          Stremio. Só funciona com a app do Discord aberta neste computador, e
          nada é enviado para a internet — a MEIDA escreve directamente no
          Discord do teu PC.
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
            <span>Mostrar no Discord o que estou a ver</span>
          </label>
        ) : (
          <p className="muted">
            Isto só funciona na app de computador (Electron), não na versão web.
          </p>
        )}
      </section>

      {/* ===== Importar dados ===== */}
      <section className="set-section" data-tab="dados">
        <h3>Importar dados</h3>
        <p className="muted">
          Carrega um ficheiro JSON ou CSV exportado da MEIDA para voltar a
          carregar a tua biblioteca e diário. É um merge: não apaga notas nem
          visto que o ficheiro não traga.
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
            Escolher ficheiro
            <input
              type="file"
              accept=".json,.csv,text/csv,text/anytext,.bak"
              style={{ display: "none" }}
              onChange={onImportPick}
            />
          </label>
          <span className="muted" style={{ fontSize: 12 }}>
            {importFile ? importFile.name : "Sem ficheiro"}
          </span>
        </div>
        {importFile && (
          <button className="set-choice" onClick={runImport} disabled={importing}>
            {importing ? "A importar..." : "Importar"}
          </button>
        )}
        {importMsg && <span className={`muted ${importError ? "auth-error" : ""}`}>{importMsg}</span>}
      </section>

      {/* ===== Letterboxd ===== */}
      <section className="set-section" data-tab="contas">
        <h3>Letterboxd</h3>
        <LetterboxdSection user={user} />
      </section>

      {/* ===== Real-Debrid ===== */}
      <section className="set-section" data-tab="contas">
        <h3>Real-Debrid</h3>
        <DebridSection user={user} />
      </section>

      {/* ===== Perfil público ===== */}
      <section className="set-section" data-tab="perfil">
        <h3>Perfil</h3>
        {!user ? (
          <p className="muted">
            <Link to="/login">Entra</Link> para editares o teu perfil.
          </p>
        ) : (
          <>
            <p className="muted">
              É o que os outros veem quando visitam o teu perfil. A biblioteca e as
              listas só aparecem se o perfil estiver público.
            </p>
            <label className="set-field">
              <span>Bio</span>
              <textarea
                className="set-bio"
                value={bio}
                maxLength={300}
                rows={3}
                placeholder="Uma frase sobre os teus gostos..."
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
                Perfil público — qualquer pessoa pode ver a tua biblioteca e listas.
                {!isPublic && " (agora está privado: só tu vês)"}
              </span>
            </label>
            <button
              className="lib-watched"
              onClick={saveProfile}
              disabled={profileSaving}
            >
              {profileSaving ? "A guardar..." : "Guardar perfil"}
            </button>
            {profileMsg && <p className="muted">{profileMsg}</p>}
          </>
        )}
      </section>

      {/* ===== Avatar ===== */}
      <section className="set-section" data-tab="perfil">
        <h3>Avatar</h3>
        {!user ? (
          <p className="muted">
            <Link to="/login">Entra</Link> para escolheres um avatar.
          </p>
        ) : (
          <>
            <div className="set-avatar-current">
              <Avatar avatar={user.avatar} name={user.username} size={64} />
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
                placeholder="...ou cola o URL de uma imagem (https://...)"
                value={imgUrl}
                onChange={(e) => setImgUrl(e.target.value)}
              />
              <button
                className="lib-watched"
                onClick={() => pickAvatar(imgUrl)}
                disabled={saving || !imgUrl.trim()}
              >
                Usar URL
              </button>
              <label className="lib-watched" style={{ cursor: "pointer" }}>
                Escolher do PC
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
                Remover avatar
              </button>
            )}
            {error && <p className="auth-error">{error}</p>}
          </>
        )}
      </section>

      {/* ===== Estado dos providers ===== */}
      <section className="set-section" data-tab="avancado">
        <h3>Estado dos providers</h3>
        <p className="muted">
          Fontes de stream usadas no player (embeds). Quando um está morto fica
          riscado e é saltado na escolha automática.
        </p>
        {provHealth?.checking && !provHealth?.providers ? (
          <p className="muted">A testar providers...</p>
        ) : !provHealth?.providers ? (
          <p className="muted">Sem informação.</p>
        ) : (
          <div className="provider-health-list">
            {provHealth.providers.map((p) => (
              <div className="provider-health-row" key={p.id}>
                <span className={p.ok ? "ph-ok" : "ph-dead"}>
                  {p.ok ? "●" : "✕"} {p.name}
                </span>
                {!p.ok && p.error && (
                  <span className="ph-reason muted">({p.error})</span>
                )}
              </div>
            ))}
          </div>
        )}
        {provHealth?.stale && <span className="ph-stale">Atualizado há 24h+</span>}
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
            Rever agora
          </button>
        </div>
      </section>

      {/* ===== App (só na app instalada) ===== */}
      {typeof window !== "undefined" && window.electronAPI?.uninstall && (
        <section className="set-section" data-tab="avancado">
          <h3>Atualizações</h3>
          <p className="muted">
            Procura uma versão nova da MEIDA. Não precisas de ter conta.
          </p>
          <button onClick={checkUpdate} disabled={updBusy}>
            {updBusy ? "A procurar..." : "Procurar atualização"}
          </button>
          {updMsg && <p className="muted">{updMsg}</p>}
          <h3 style={{ marginTop: 22 }}>Desinstalar</h3>
          <p className="muted">
            Remove a MEIDA do computador. A app fecha e o desinstalador abre.
          </p>
          <button
            className="set-clear danger"
            onClick={() => window.electronAPI.uninstall()}
          >
            Desinstalar MEIDA
          </button>
        </section>
      )}
    </div>
  );
}
