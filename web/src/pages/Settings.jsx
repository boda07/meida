import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useSettings } from "../settings/SettingsContext.jsx";
import { useAuth } from "../auth/AuthContext.jsx";
import { api, openExternal } from "../api/client.js";
import Avatar, { AVATAR_EMOJIS } from "../components/Avatar.jsx";

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

export default function Settings() {
  const { settings, update } = useSettings();
  const { user, updateAvatar } = useAuth();
  const [imgUrl, setImgUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

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

  return (
    <div className="sub-page settings-page">
      <h2 className="row-title">Definições</h2>

      {/* ===== Idiomas ===== */}
      <section className="set-section">
        <h3>Títulos</h3>
        <p className="muted">Idioma dos nomes de filmes, séries e anime.</p>
        <div className="set-row">
          <Choice value="en" current={settings.titleLang} onPick={(v) => update({ titleLang: v })}>
            Inglês
          </Choice>
          <Choice value="pt" current={settings.titleLang} onPick={(v) => update({ titleLang: v })}>
            Português
          </Choice>
        </div>
      </section>

      <section className="set-section">
        <h3>Sinopses</h3>
        <p className="muted">Idioma das descrições/sinopses e dos géneros.</p>
        <div className="set-row">
          <Choice value="pt" current={settings.overviewLang} onPick={(v) => update({ overviewLang: v })}>
            Português
          </Choice>
          <Choice value="en" current={settings.overviewLang} onPick={(v) => update({ overviewLang: v })}>
            Inglês
          </Choice>
        </div>
      </section>

      <section className="set-section">
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

      <section className="set-section">
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

      <section className="set-section">
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

      <section className="set-section">
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
      <section className="set-section">
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
      <section className="set-section">
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
      <section className="set-section">
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
      <section className="set-section">
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
      <section className="set-section">
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
      <section className="set-section">
        <h3>MyAnimeList</h3>
        <MalSection user={user} />
      </section>

      {/* ===== Letterboxd ===== */}
      <section className="set-section">
        <h3>Letterboxd</h3>
        <LetterboxdSection user={user} />
      </section>

      {/* ===== Avatar ===== */}
      <section className="set-section">
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

      {/* ===== App (só na app instalada) ===== */}
      {typeof window !== "undefined" && window.electronAPI?.uninstall && (
        <section className="set-section">
          <h3>App</h3>
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
