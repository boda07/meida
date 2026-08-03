export function SearchIcon({ size = 22 }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

export function UserIcon({ size = 24 }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

export function PlayIcon({ size = 20 }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

export function InfoIcon({ size = 20 }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

// Ícones das conquistas (sem emojis, SVG inline). Um por tipo de badge.
export function BadgeIcon({ id, size = 28 }) {
  const common = {
    ariaHidden: true,
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "currentColor",
  };
  switch (id) {
    case "movie": // clapper de cinema
      return (
        <svg {...common}>
          <path d="M2 5a3 3 0 0 1 3-3h13a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H7.5l-5 5V5z" />
          <circle cx="10" cy="11" r="2" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      );
    case "tv": // écrã
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="14" rx="2" />
          <polyline points="9 14l3-3 3 3" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      );
    case "anime": // folha (estilo anime)
      return (
        <svg {...common}>
          <path d="M12 2C9 6 5 7.5 5 12c0 4 3 6 7 6s7-2 7-6c0-4.5-4-6-7-10z" />
        </svg>
      );
    case "star": // estrela
      return (
        <svg {...common}>
          <polygon points="12 2l3 7h7l-5 4 2 7-6-4-6 4 2-7-5-4h7z" />
        </svg>
      );
    case "list": // lista
      return (
        <svg {...common}>
          <line x1="8" y1="6" x2="21" y2="6" />
          <line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <circle cx="4" cy="6" r="1" />
          <circle cx="4" cy="12" r="1" />
          <circle cx="4" cy="18" r="1" />
        </svg>
      );
    case "fire": // chama (racha/consistência)
      return (
        <svg {...common}>
          <path d="M12 2c-2 2-4 4-4 6 0 2 2 3 4 3s4-1 4-3-2-4-4-6zm0 9c-2 0-4 1-4 3s2 3 4 3 4-1 4-3-2-3-4-3z" />
        </svg>
      );
    case "streak": // relógio/coroa de dias
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <line x1="12" y1="7" x2="12" y2="12" />
          <line x1="12" y1="12" x2="12.01" y2="12" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="10" />
        </svg>
      );
  }
}
