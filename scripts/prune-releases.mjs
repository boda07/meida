// Apaga as releases antigas do GitHub, mantendo so as N mais recentes (por
// defeito 3). O auto-update (electron-updater) so precisa da release mais recente;
// as antigas sao peso morto (cada instalador tem ~85 MB). As TAGS sao mantidas
// (historico leve) — so as releases (com os ficheiros) e que sao removidas.
//
// Tambem limpa a pasta local "release/": o electron-builder deixa la os
// instaladores antigos a cada build, por isso apagamos todos menos o da versao
// atual (lida do package.json).
//
// Uso: node scripts/prune-releases.mjs [N]
// Corre automaticamente depois de "npm run app:publish".
import { execSync } from "node:child_process";
import { readFileSync, readdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPO = "boda07/meida";
const KEEP = Math.max(1, Number(process.argv[2] || 3));

function sh(cmd) {
  return execSync(cmd, { encoding: "utf8" });
}

// --- Limpeza local: instaladores antigos na pasta release/ ---
try {
  const version = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).version;
  const relDir = join(ROOT, "release");
  let freed = 0;
  for (const f of readdirSync(relDir)) {
    // "MEIDA Setup 0.8.3.exe" / ".exe.blockmap" que nao sejam da versao atual.
    if (/^MEIDA Setup .*\.exe(\.blockmap)?$/.test(f) && !f.includes(version)) {
      rmSync(join(relDir, f), { force: true });
      freed++;
      console.log("apagado (local)", f);
    }
  }
  if (freed) console.log(`prune-releases: ${freed} instaladores locais antigos apagados.`);
} catch {
  /* sem pasta release/ -> nada a limpar */
}

let releases;
try {
  releases = JSON.parse(sh(`gh release list --repo ${REPO} --limit 300 --json tagName,createdAt`));
} catch (e) {
  console.warn("prune-releases: nao consegui listar as releases (gh autenticado?). A saltar.");
  process.exit(0);
}

releases.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
const toDelete = releases.slice(KEEP);

if (!toDelete.length) {
  console.log(`prune-releases: nada a apagar (${releases.length} releases, mantem-se ${KEEP}).`);
  process.exit(0);
}

let ok = 0;
for (const r of toDelete) {
  try {
    // Sem --cleanup-tag: mantemos a tag (historico), apagamos so a release.
    sh(`gh release delete ${r.tagName} --repo ${REPO} --yes`);
    ok++;
    console.log("apagada", r.tagName);
  } catch {
    console.warn("falhou a apagar", r.tagName);
  }
}
console.log(`prune-releases: apagadas ${ok}/${toDelete.length}; mantidas as ${KEEP} mais recentes.`);
