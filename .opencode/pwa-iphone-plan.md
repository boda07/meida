# Plan: app iOS grátis (PWA — sem App Store, sem $99)

## Arquitetura decidida
- **PWA (webapp progressiva)** — instalável do Safari ("Adicionar à Tela de Início"). Electron desktop continua igual.
- **Same-origin hosting (recomendado, zero config):** server MEIDA `SERVE_WEB=1` serve `web/dist` + `/api` no mesmo URL. Correr num free host (Render/Railway/Fly/Cloudflare) e abrir no Safari → instalar.
- **Static hosting (opcional):** publicar só o `web/dist` (GitHub Pages) → editar `web/public/runtime-config.json` → `"VITE_API_BASE": "https://teu.backend"`.

## Estado (v0.9.7 — DONE)
- [x] `web/public/manifest.json` + `icon-192.png`, `icon-512.png` (gerados de `build/icon.png` via sharp).
- [x] `web/vite.config.js` + `vite-plugin-pwa` (workbox): precache assets + runtime `/api` (NetworkFirst 7d) + imagens (CacheFirst 30d).
- [x] `web/index.html`: `<link rel="manifest">` + `theme-color`.
- [x] `web/src/main.jsx`: fetch `runtime-config.json` antes do render + registo do SW (só web, não Electron).
- [x] `web/src/api/client.js`: `fullUrl()` usa `window.MEIDA_API_BASE || window.location.origin`.
- [x] `web/public/runtime-config.json` = `{"VITE_API_BASE":""}` (same-origin default).
- [x] `web/package.json` script `build:pwa`.
- [x] `.github/workflows/pages.yml` (GitHub Pages).
- [x] Release v0.9.7 (commit `85078cb`, tag `v0.9.7`, GitHub release publicada) + CHANGELOG.md + IDEIAS.md.

## Verificado
- `npm run lint` (root) limpa. `npm test` → 22/22. `npm --prefix web run build` → `web/dist` contém sw.js, manifest.webmanifest, runtime-config.json, icon-*.png.
- Server dev: `/api/anilist/enabled` `{enabled:false}`, `/api/anilist/status` 401.

## Como instalar no iPhone (para o user)
1. Deploy do server MEIDA (`SERVE_WEB=1`) num free host → URL (ex.: `https://meida.onrender.com`).
2. iPhone → Safari → URL → Share (↑) → "Adicionar à Tela de Início" → "Adicionar".
3. Ícone MEIDA na home. Abre standalone, funciona offline-parcial.

## Follow-ups (fora scope grátis)
- App nativo RN/Expo (App Store $99) — não feito.
- WebTorrent P2P iOS: Safari não suporta WebRTC DataChannels → usa HLS/providers só (já existem).
- Notificações push: PWA iOS push não confiável (iOS 16.4+).
