import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// O backend corre em :3000. Em dev, o Vite faz proxy de /api para la,
// para evitarmos problemas de CORS e termos um unico origin no browser.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:5175",
    },
  },
});
