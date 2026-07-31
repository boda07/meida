// Seletor de provider de embed. Os que o health-check marcou como mortos ficam
// sinalizados (cinzentos, com aviso) — clicáveis, mas nunca escolhidos por defeito.
export default function SourceSelector({ embeds, activeId, onSelect, deadIds }) {
  if (!embeds?.length) return <p className="muted">Sem fontes disponiveis.</p>;
  return (
    <div className="sources">
      <span className="sources-label">Fonte:</span>
      <div className="sources-list">
        {embeds.map((e) => {
          const isDead = deadIds?.has(e.provider);
          return (
            <button
              key={e.provider}
              className={`source-btn ${e.provider === activeId ? "active" : ""} ${
                isDead ? "dead" : ""
              }`}
              onClick={() => onSelect(e)}
              title={isDead ? `${e.name}: em baixo (último teste falhou)` : e.name}
            >
              {e.name}
              {isDead && <span className="source-dead-tag">em baixo</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
