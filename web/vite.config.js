import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const appVersion = JSON.parse(
  readFileSync(fileURLToPath(new URL("../package.json", import.meta.url)), "utf8")
).version;

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        runtimeCaching: [
          {
            // API responses (TMDB/AniList/Jikan/proxy): rede primeiro, cache de
            // backup para funcionar offline parcial (perfil, listas, etc.).
            urlPattern: ({ url }) => url.pathname.startsWith("/api/"),
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              expiration: { maxEntries: 128, maxAgeSeconds: 7 * 24 * 3600 },
            },
          },
          {
            // Assets estaticos (catalogo, cartazes, icones).
            urlPattern: ({ request }) => request.destination === "image",
            handler: "CacheFirst",
            options: {
              cacheName: "image-cache",
              expiration: { maxEntries: 256, maxAgeSeconds: 30 * 24 * 3600 },
            },
          },
        ],
      },
      manifest: {
        name: "MEIDA",
        short_name: "MEIDA",
        start_url: "/",
        display: "standalone",
        background_color: "#0f0f12",
        theme_color: "#0f0f12",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
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
