import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Versao da app (package.json da raiz) injetada no build, como fallback do
// "o que mudou" quando nao ha Electron (dev/web).
const appVersion = JSON.parse(
  readFileSync(fileURLToPath(new URL("../package.json", import.meta.url)), "utf8")
).version;

// O backend corre em :3000. Em dev, o Vite faz proxy de /api para la,
// para evitarmos problemas de CORS e termos um unico origin no browser.
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:5175",
    },
  },
});
