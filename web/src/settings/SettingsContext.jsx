import { createContext, useContext, useState } from "react";
import { settingsStore } from "../api/client.js";

const SettingsContext = createContext(null);

// Definicoes do utilizador (idiomas, legendas, separador inicial). Guardadas
// em localStorage via settingsStore; este contexto torna-as reativas na UI.
export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(() => settingsStore.get());

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
