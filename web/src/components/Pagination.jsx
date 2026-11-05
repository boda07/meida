import { useT } from "../i18n/I18nContext.jsx";
import { paginasVisiveis } from "../lib/paginacao.js";

export default function Pagination({ page, totalPages, onChange }) {
  const t = useT();
  if (!totalPages || totalPages <= 1) return null;

  return (
    <nav className="pagination" aria-label={t("Paginação")}>
      <button
        type="button"
        className="page-btn page-step"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        aria-label={t("Anterior")}
      >
        <svg
          aria-hidden="true"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m15 18-6-6 6-6" />
        </svg>
      </button>

      {paginasVisiveis(page, totalPages).map((p, i) =>
        p === null ? (
          <span key={`gap-${i}`} className="page-gap" aria-hidden="true">
            …
          </span>
        ) : (
          <button
            type="button"
            key={p}
            className={`page-btn ${p === page ? "active" : ""}`}
            onClick={() => onChange(p)}
            aria-current={p === page ? "page" : undefined}
          >
            {p}
          </button>
        )
      )}

      <button
        type="button"
        className="page-btn page-step"
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        aria-label={t("Seguinte")}
      >
        <svg
          aria-hidden="true"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
      </button>
    </nav>
  );
}
