import { useT } from "../i18n/I18nContext.jsx";

export default function LoadingStatus({ children, compact = false, muted = false }) {
  // O texto por omissao passa por `t()` e nao por um valor no `children`:
  // uma constante nao se traduz, e o `LoadingStatus` sem texto nenhum
  // aparecia em ingles como "A carregar".
  const t = useT();
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
        <span>{children ?? t("A carregar")}</span>
        <span className="loading-dots" aria-hidden="true">
          <span>.</span>
          <span>.</span>
          <span>.</span>
        </span>
      </div>
    </div>
  );
}
