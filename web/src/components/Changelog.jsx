import { useEffect, useState } from "react";
import { CHANGELOG, getAppVersion, cmpVersion } from "../changelog.js";
import ChangelogModal from "./ChangelogModal.jsx";

const KEY = "meida_seen_version";

function MegaphoneIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 11l14-6v14L3 13z" />
      <path d="M3 11v2a2 2 0 0 0 2 2h1" />
      <path d="M7 15v3a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-2" />
    </svg>
  );
}

// Botao "Novidades" no cabecalho: abre as patch notes a qualquer momento. Tambem
// trata do aviso automatico quando a app foi mesmo atualizada (mostra o que mudou
// desde a ultima versao vista) e poe um ponto vermelho enquanto nao for visto.
export default function Changelog() {
  const [version, setVersion] = useState(null);
  const [view, setView] = useState(null); // { initialVersion, subtitle } | null
  const [hasNew, setHasNew] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const v = await getAppVersion();
      if (!v || !alive) return;
      setVersion(v);
      const seen = localStorage.getItem(KEY);
      if (!seen) {
        localStorage.setItem(KEY, v); // primeira utilizacao -> sem aviso
        return;
      }
      if (cmpVersion(v, seen) <= 0) return; // nao atualizou
      setHasNew(true);
      setView({
        initialVersion: v,
        subtitle: `Atualizaste a MEIDA para a versão ${v}. Novidades:`,
      });
    })();
    return () => {
      alive = false;
    };
  }, []);

  function markSeen() {
    if (version) localStorage.setItem(KEY, version);
    setHasNew(false);
  }

  // Abertura manual: arranca na versao mais recente (e da para navegar as antigas).
  function openLatest() {
    setView({ initialVersion: CHANGELOG[0]?.version, subtitle: null });
    markSeen();
  }

  function close() {
    markSeen();
    setView(null);
  }

  return (
    <>
      <button
        className="icon-btn"
        title="Novidades"
        aria-label="Novidades"
        onClick={openLatest}
      >
        <MegaphoneIcon />
        {hasNew && <span className="wp-badge">!</span>}
      </button>
      {view && (
        <ChangelogModal
          initialVersion={view.initialVersion}
          subtitle={view.subtitle}
          onClose={close}
        />
      )}
    </>
  );
}
