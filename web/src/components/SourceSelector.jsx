// Seletor de provider de embed. Na Fase B ganha um separador "Torrents".
export default function SourceSelector({ embeds, activeId, onSelect }) {
  if (!embeds?.length) return <p className="muted">Sem fontes disponiveis.</p>;
  return (
    <div className="sources">
      <span className="sources-label">Fonte:</span>
      <div className="sources-list">
        {embeds.map((e) => (
          <button
            key={e.provider}
            className={`source-btn ${e.provider === activeId ? "active" : ""}`}
            onClick={() => onSelect(e)}
          >
            {e.name}
          </button>
        ))}
      </div>
    </div>
  );
}
