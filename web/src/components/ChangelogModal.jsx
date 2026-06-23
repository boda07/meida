import { createPortal } from "react-dom";

// Modal das novidades (reutilizado pelo aviso automatico de atualizacao e pelo
// botao "Novidades" do cabecalho). Renderizado num portal para o body: o botao
// vive no Header, que tem `transform`, e isso faria o overlay `position: fixed`
// colar-se a barra em vez de cobrir o ecra todo.
export default function ChangelogModal({ version, subtitle, items, onClose }) {
  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal whatsnew" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>✨ Novidades{version ? ` · v${version}` : ""}</h3>
          <button className="modal-close" aria-label="Fechar" onClick={onClose}>
            ✕
          </button>
        </div>
        {subtitle && (
          <p className="muted" style={{ padding: "0 20px" }}>
            {subtitle}
          </p>
        )}
        <ul className="whatsnew-list">
          {items.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
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
