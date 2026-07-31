export default function LoadingStatus({ children = "A carregar", compact = false, muted = false }) {
  return (
    <div
      className={`status loading-status${compact ? " compact" : ""}${muted ? " muted" : ""}`}
      role="status"
      aria-live="polite"
    >
      <div className="loading-ring" aria-hidden="true">
        {Array.from({ length: 6 }).map((_, i) => (
          <span key={i} style={{ "--i": i }} />
        ))}
      </div>
      <div className="loading-copy">
        <span>{children}</span>
        <span className="loading-dots" aria-hidden="true">
          <span>.</span>
          <span>.</span>
          <span>.</span>
        </span>
      </div>
    </div>
  );
}
