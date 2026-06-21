import { createContext, useContext, useEffect, useState } from "react";
import { settingsStore } from "../api/client.js";

const SettingsContext = createContext(null);

// Clareia/escurece uma cor hex (amount em -1..1) para derivar tons de hover.
function shade(hex, amount) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const v = amount >= 0 ? c + (255 - c) * amount : c * (1 + amount);
    return Math.max(0, Math.min(255, Math.round(v)));
  });
  return `#${ch.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

// Definicoes do utilizador (idiomas, legendas, cor, separador inicial). Guardadas
// em localStorage via settingsStore; este contexto torna-as reativas na UI.
export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(() => settingsStore.get());

  // Aplica a cor de destaque escolhida as variaveis CSS (--accent).
  useEffect(() => {
    const root = document.documentElement;
    const accent = settings.accent || "#c90303";
    root.style.setProperty("--accent", accent);
    root.style.setProperty("--accent-hover", shade(accent, 0.18));
  }, [settings.accent]);

  function update(patch) {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      settingsStore.set(next);
      return next;
    });
  }

  return (
    <SettingsContext.Provider value={{ settings, update }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
