// Secção de ligação ao Real-Debrid (streaming de torrents instantâneo).
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useT } from "../../i18n/I18nContext.jsx";
import { api } from "../../api/client.js";

export default function DebridSection({ user }) {
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