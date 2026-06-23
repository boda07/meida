import { useState } from "react";
import { createPortal } from "react-dom";
import { CHANGELOG } from "../changelog.js";

// Modal das novidades, com uma barra lateral para ver tambem as versoes antigas.
// `initialVersion` define a versao mostrada por defeito (a mais recente, ou a que
// acabou de ser instalada no aviso automatico). Renderizado num portal para o
// body: o botao vive no Header (que tem `transform`), e isso faria o overlay
// `position: fixed` colar-se a barra em vez de cobrir o ecra.
export default function ChangelogModal({ initialVersion, subtitle, onClose }) {
  const [selected, setSelected] = useState(() =>
    initialVersion && CHANGELOG.some((c) => c.version === initialVersion)
      ? initialVersion
      : CHANGELOG[0]?.version
  );
  const entry = CHANGELOG.find((c) => c.version === selected) || CHANGELOG[0];

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal whatsnew changelog-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h3>✨ Novidades{entry ? ` · v${entry.version}` : ""}</h3>
          <button className="modal-close" aria-label="Fechar" onClick={onClose}>
            ✕
          </button>
        </div>
        {subtitle && (
          <p className="muted" style={{ padding: "0 20px" }}>
            {subtitle}
          </p>
        )}
        <div className="changelog-body">
          <nav className="changelog-versions">
            {CHANGELOG.map((c) => (
              <button
                key={c.version}
                className={`changelog-version ${
                  c.version === selected ? "active" : ""
                }`}
                onClick={() => setSelected(c.version)}
              >
                v{c.version}
              </button>
            ))}
          </nav>
          <ul className="whatsnew-list changelog-items">
            {(entry?.items || []).map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </div>
        <div className="modal-actions">
          <button className="modal-btn" onClick={onClose}>
            Fixe!
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
