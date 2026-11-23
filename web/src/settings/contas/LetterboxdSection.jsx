// Secção de ligação ao Letterboxd (filmes).
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useT } from "../../i18n/I18nContext.jsx";
import { api } from "../../api/client.js";

export default function LetterboxdSection({ user }) {
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