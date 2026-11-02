// Teste de verificação de código-fonte para o hls-attach.
//
// Semelhante ao testar-svg.mjs: verifica que o código-fonte tem os elementos necessários
// (attachMedia, loadSource, isM3U8 separado) para evitar o defeito do vídeo parado em 0:00.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HOOK_PATH = path.join(RAIZ, "web/src/components/useHlsEngine.js");
const HLS_PLAYER_PATH = path.join(RAIZ, "web/src/components/HlsPlayer.jsx");

let ok = 0;
let falhou = 0;
function ok_(nome, cond, extra) {
  if (cond) {
    console.log("  OK    " + nome);
    ok++;
  } else {
    console.log("  FALHA " + nome + (extra ? "  ->  " + extra : ""));
    falhou++;
  }
}

const hlsHook = fs.readFileSync(HOOK_PATH, "utf8");
const hlsPlayer = fs.readFileSync(HLS_PLAYER_PATH, "utf8");

ok_(
  "assinatura do gancho inclui isM3U8",
  hlsHook.includes("export function useHlsEngine({ src, isM3U8, videoRef, onErro })"),
  "isM3U8 separado evita que src.isM3U8 (string) seja lido"
);

ok_(
  "assinatura do HlsPlayer inclui isM3U8",
  hlsPlayer.includes("const isM3U8 = sources[0]?.isM3U8;"),
  "passa isM3U8 como parametro separado"
);

ok_(
  "assinatura do HlsPlayer passa isM3U8",
  hlsPlayer.includes("useHlsEngine({\n    src,\n    isM3U8,\n    videoRef,\n    onErro,"),
  "o gancho recebe isM3U8"
);

ok_(
  "attachMedia está presente no gancho",
  hlsHook.includes("if (video) hls.attachMedia(video);"),
  "sem attachMedia o hls.js nunca liga o video"
);

ok_(
  "loadSource está presente após attachMedia",
  hlsHook.includes("if (video) hls.attachMedia(video);\n    hls.loadSource(src);"),
  "a ordem attachMedia antes de loadSource é necessária"
);

ok_(
  "onErro está fora das dependencias do useEffect",
  hlsHook.includes("}, [src, isM3U8])"),
  "onErro nas dependencias recriava o hls"
);

console.log("");
console.log("  " + ok + " ok, " + falhou + " falha(s)");
process.exitCode = falhou ? 1 : 0;
