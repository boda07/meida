// Secção de ligação ao AniList (anime). Fonte de verdade da lista quando o MAL
// não está ligado: importa estado/nota/progresso e marca episódios vistos.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useT } from "../../i18n/I18nContext.jsx";
import { api, openExternal } from "../../api/client.js";
import { useAoFocarJanela } from "../../components/useAoFocarJanela.js";

export default function AniListSection({ user }) {
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

  useAoFocarJanela(refresh, { active: !!user });

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