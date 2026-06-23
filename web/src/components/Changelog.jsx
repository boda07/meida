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
  const [view, setView] = useState(null); // { items, subtitle, version } | null
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
      const news = CHANGELOG.filter(
        (c) => cmpVersion(c.version, seen) > 0 && cmpVersion(c.version, v) <= 0
      );
      const items = (news.length ? news : CHANGELOG.slice(0, 1)).flatMap((e) => e.items);
      setHasNew(true);
      setView({
        items,
        version: v,
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

  // Abertura manual: mostra as novidades da versao mais recente.
  function openLatest() {
    const latest = CHANGELOG[0];
    setView({
      items: latest?.items || [],
      version: latest?.version || version,
      subtitle: "As novidades mais recentes:",
    });
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
      {view && view.items.length > 0 && (
        <ChangelogModal
          version={view.version}
          subtitle={view.subtitle}
          items={view.items}
          onClose={close}
        />
      )}
    </>
  );
}
