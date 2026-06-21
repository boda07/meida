import { useEffect, useRef, useState } from "react";
import { useWatchParty } from "../watchparty/WatchPartyContext.jsx";

function PeopleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export default function WatchParty() {
  const party = useWatchParty();
  const [open, setOpen] = useState(false);
  const [nick, setNick] = useState("");
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);
  const ref = useRef(null);

  // Fecha ao clicar fora.
  useEffect(() => {
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  if (!party?.enabled) return null; // Watch Party não configurado neste build

  const copy = () => {
    navigator.clipboard?.writeText(party.room).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="wp" ref={ref}>
      <button
        className={`icon-btn ${party.active ? "wp-on" : ""}`}
        title="Watch Party"
        aria-label="Watch Party"
        onClick={() => setOpen((v) => !v)}
      >
        <PeopleIcon />
        {party.active && <span className="wp-badge">{party.members.length}</span>}
      </button>

      {open && (
        <div className="wp-panel">
          <h4>Watch Party</h4>
          {party.active ? (
            <>
              <p className="muted">
                Veem o mesmo ao mesmo tempo. Pausa/play e sincronizado nos
                separadores <b>Sem anúncios</b> e <b>Torrents</b>.
              </p>
              <div className="wp-code">
                <span>{party.room}</span>
                <button className="set-choice" onClick={copy}>
                  {copied ? "Copiado!" : "Copiar codigo"}
                </button>
              </div>
              <div className="wp-members">
                {party.members.map((m, i) => (
                  <span className="wp-member" key={i}>
                    {m.nick}
                  </span>
                ))}
              </div>
              <button className="set-clear" onClick={party.leave}>
                Sair da sala
              </button>
            </>
          ) : (
            <>
              <p className="muted">
                Cria uma sala e envia o codigo ao teu amigo, ou entra com um
                codigo.
              </p>
              <input
                className="wp-input"
                placeholder="O teu nome"
                value={nick}
                onChange={(e) => setNick(e.target.value)}
              />
              <button
                className="set-choice active wp-block"
                onClick={() => {
                  party.createRoom(nick);
                  setOpen(true);
                }}
              >
                Criar sala
              </button>
              <div className="wp-or">ou</div>
              <div className="wp-join">
                <input
                  className="wp-input"
                  placeholder="Codigo"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  maxLength={5}
                />
                <button
                  className="set-choice"
                  onClick={() => party.joinRoom(code, nick)}
                  disabled={!code.trim()}
                >
                  Entrar
                </button>
              </div>
              {party.error && <p className="auth-error">{party.error}</p>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
