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
        O servidor nao tem o MyAnimeList configurado (falta MAL_CLIENT_ID).
      </p>
    );
  }

  return (
    <div>
      {linked ? (
        <>
          <p className="muted">
            Ligado como <b>{username || "?"}</b>. Os episodios de anime que vires
            sao marcados no teu MAL automaticamente.
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
            Liga a tua conta para importar a tua lista e marcar episodios vistos.
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

// Cores de fundo predefinidas (escuras, para o texto branco continuar legivel).
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

// Seletor de cor: presets + ultimas escolhidas (recentes) + picker livre.
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
      <h2 className="row-title">Definicoes</h2>

      {/* ===== Idiomas ===== */}
      <section className="set-section">
        <h3>Titulos</h3>
        <p className="muted">Idioma dos nomes de filmes, series e anime.</p>
        <div className="set-row">
          <Choice value="en" current={settings.titleLang} onPick={(v) => update({ titleLang: v })}>
            Ingles
          </Choice>
          <Choice value="pt" current={settings.titleLang} onPick={(v) => update({ titleLang: v })}>
            Portugues
          </Choice>
        </div>
      </section>

      <section className="set-section">
        <h3>Sinopses</h3>
        <p className="muted">Idioma das descricoes/sinopses.</p>
        <div className="set-row">
          <Choice value="pt" current={settings.overviewLang} onPick={(v) => update({ overviewLang: v })}>
            Portugues
          </Choice>
          <Choice value="en" current={settings.overviewLang} onPick={(v) => update({ overviewLang: v })}>
            Ingles
          </Choice>
        </div>
      </section>

      <section className="set-section">
        <h3>Legendas</h3>
        <p className="muted">
          Legenda preferida (ativada automaticamente nos players sem anuncios e
          de torrents).
        </p>
        <div className="set-row">
          <Choice value="pt" current={settings.subtitleLang} onPick={(v) => update({ subtitleLang: v })}>
            Portugues
          </Choice>
          <Choice value="en" current={settings.subtitleLang} onPick={(v) => update({ subtitleLang: v })}>
            Ingles
          </Choice>
          <Choice value="off" current={settings.subtitleLang} onPick={(v) => update({ subtitleLang: v })}>
            Desligadas
          </Choice>
        </div>
      </section>

      <section className="set-section">
        <h3>Anime: audio</h3>
        <p className="muted">
          Legendado (sub) ou dobrado (dub). Aplica-se as fontes dedicadas de anime
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
        <h3>Separador inicial</h3>
        <p className="muted">Onde abrir por defeito ao ver um titulo.</p>
        <div className="set-row">
          <Choice value="providers" current={settings.defaultTab} onPick={(v) => update({ defaultTab: v })}>
            Providers
          </Choice>
          <Choice value="extract" current={settings.defaultTab} onPick={(v) => update({ defaultTab: v })}>
            Sem anuncios
          </Choice>
          <Choice value="torrents" current={settings.defaultTab} onPick={(v) => update({ defaultTab: v })}>
            Torrents
          </Choice>
        </div>
      </section>

      {/* ===== Reproducao ===== */}
      <section className="set-section">
        <h3>Reproducao</h3>
        <p className="muted">
          Autoplay liga/desliga o arranque automatico. Autoskip tenta saltar a
          intro/genericos (funciona nos nossos players; nos providers externos
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
          Ajusta a largura e a altura dos posters (util em ecras pequenos).
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
          Cor dos botoes e realces. Predefinidas, as tuas ultimas escolhas, ou o
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
          Fundo da app. Predefinidas (escuras, texto legivel), as tuas ultimas
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

      {/* ===== MyAnimeList ===== */}
      <section className="set-section">
        <h3>MyAnimeList</h3>
        <MalSection user={user} />
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
                Usar imagem
              </button>
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

      {/* ===== App (so na app instalada) ===== */}
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
