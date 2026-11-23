// Secção de ligação ao MyAnimeList (Definições > Contas).
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useT } from "../../i18n/I18nContext.jsx";
import { api, openExternal } from "../../api/client.js";
import { useAoFocarJanela } from "../../components/useAoFocarJanela.js";

export default function MalSection({ user }) {
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
  useAoFocarJanela(refresh, { active: !!user });

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