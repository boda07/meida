import { useState } from "react";
import { Link } from "react-router-dom";
import { useSettings } from "../settings/SettingsContext.jsx";
import { useAuth } from "../auth/AuthContext.jsx";
import Avatar, { AVATAR_EMOJIS } from "../components/Avatar.jsx";

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
          (VidLink/VidSrc.cc por MyAnimeList).
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
    </div>
  );
}
