import { useEffect, useState } from "react";
import { CHANGELOG, getAppVersion, cmpVersion } from "../changelog.js";

const KEY = "meida_seen_version";

// Mostra um modal com as novidades quando a versao instalada e maior do que a
// ultima que o utilizador ja viu. Na primeira vez (sem registo) nao mostra nada,
// so guarda a versao atual — assim o popup so aparece em atualizacoes reais.
export default function WhatsNew() {
  const [show, setShow] = useState(false);
  const [version, setVersion] = useState(null);
  const [items, setItems] = useState([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const v = await getAppVersion();
      if (!v || !alive) return;
      const seen = localStorage.getItem(KEY);
      if (!seen) {
        localStorage.setItem(KEY, v); // primeira utilizacao -> sem popup
        return;
      }
      if (cmpVersion(v, seen) <= 0) return; // nao atualizou
      const news = CHANGELOG.filter(
        (c) => cmpVersion(c.version, seen) > 0 && cmpVersion(c.version, v) <= 0
      );
      const flat = (news.length ? news : CHANGELOG.slice(0, 1)).flatMap((e) => e.items);
      setVersion(v);
      setItems(flat);
      setShow(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  function close() {
    if (version) localStorage.setItem(KEY, version);
    setShow(false);
  }

  if (!show || !items.length) return null;

  return (
    <div className="modal-overlay" onClick={close}>
      <div className="modal whatsnew" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>✨ O que mudou</h3>
          <button className="modal-close" aria-label="Fechar" onClick={close}>
            ✕
          </button>
        </div>
        <p className="muted" style={{ padding: "0 20px" }}>
          Atualizaste a MEIDA para a versão {version}. Novidades:
        </p>
        <ul className="whatsnew-list">
          {items.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
        <div className="modal-actions">
          <button className="modal-btn" onClick={close}>
            Fixe!
          </button>
        </div>
      </div>
    </div>
  );
}
