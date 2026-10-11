// Extrator NATIVO do MegaPlay: da'-nos o m3u8 e as legendas em claro, sem
// iframe e sem engenharia reversa do player em runtime.
//
// ── O QUE ISTO FAZ E PORQUÊ ──────────────────────────────────────────────────
// A app usava o MegaPlay dentro de um iframe (ver `services/providers.js`). Isso
// traz dois problemas que a ideia "Reprodução nativa" queria resolver:
//   1. as legendas eram as do player, que nao se podiam escolher nem traduzir;
//   2. o play/pausa do Watch Party nao sincroniza num iframe (o `postMessage`
//      nao atravessa o cross-origin do player).
//
// O endpoint `/stream/getSources?id=<data-id>` devolve as legendas em claro
// (`tracks[].file`, um .vtt) e o video num campo `enc` que e' texto cifrado.
//
// ── A CIFRA ───────────────────────────────────────────────────────────────────
// Medido a 2026-10-11 lendo `megaplay.buzz/lib/newclient.min.js`:
//   AES-CBC, chave e IV vindos de `__MegaPlayCfg` com estes valores por
//   defeito (a pagina NAO os sobrescreve — verificado):
//     chave = "i?LMTAx0Q6,:}50U"   (32 bytes, preenchidos com zeros pela funcao `I`)
//     IV    = "W0;27ToaUpl_P%'c"   (16 bytes)
//   O `enc` e' base64-url do texto cifrado, e o texto claro e' um JSON
//   `{"file":"https://.../master.m3u8"}`.
//
// A funcao `I(texto, tamanho)` enche um array de `tamanho` bytes com o texto
// e completa com zeros — e' por isso que a chave de 16 caracteres vira uma de
// 32. Se o servidor mudar estes valores, este servico devolve `null` e a app
// cai para o iframe (que continua a funcionar) — nunca rebenta.
//
// NOTA HONESTA SOBRE "ENGENHARIA REVERSA": nao e' crack. A chave e o IV estao
// no proprio JavaScript do site, em texto simples, e a cifra e' AES com a
// biblioteca padrao do Node. Nao se contorna nenhuma proteccao de acesso: os
// segmentos exigem o mesmo `Referer` que o player usaria.
import crypto from "node:crypto";
import { log } from "./log.js";

const BASE = "https://megaplay.buzz";
const CHAVE_POR_DEFEITO = "i?LMTAx0Q6,:}50U";
const IV_POR_DEFEITO = "W0;27ToaUpl_P%'c";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

// O `data-id` da pagina do player NAO esta' no URL (ver `lerDataId`).

// O `data-id` NAO esta' no URL. O embedUrl e' `https://megaplay.buzz/stream/
// ani/{aniList}/{ep}/{audio}` e o id que o `getSources` quer e' um atributo
// `data-id="7827"` dentro da PAGINA. Sao coisas differentes: o AniList id e' o
// identificador logico do episodio, o `data-id` e' a linha na base de dados do
// site.
//
// E' a pagina que tem de ser lida — e e' por isso que o audio fica correcto sem
// trabalho extra: pedir `/stream/ani/{id}/1/dub` traz a pagina do dub, cujo
// `data-id` e' o do dub. Medido: o mesmo episodio em `sub` da `data-id=7827`, e
// em `dub` a pagina nao tem `data-id` (esse episodio nao existe em dub, e o
// servidor devolve 404 em vez de um id errado).
export async function lerDataId(embedUrl) {
  try {
    const r = await fetch(embedUrl, {
      headers: { "User-Agent": UA, Referer: BASE + "/" },
      signal: AbortSignal.timeout(12000),
    });
    if (!r.ok) return null;
    const html = await r.text();
    const m = /data-id="(\d+)"/.exec(html);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

/** Reproduz a funcao `I(t, e)` do cliente: enche `tamanho` bytes com o texto. */
function I(texto, tamanho) {
  const bytes = new TextEncoder().encode(String(texto));
  const out = new Uint8Array(tamanho);
  out.set(bytes.subarray(0, Math.min(tamanho, bytes.length)));
  return out;
}

/** base64-url -> Buffer (o `enc` vem assim). */
function deB64Url(s) {
  let t = String(s).replace(/-/g, "+").replace(/_/g, "/");
  const r = t.length % 4;
  if (r) t += "====".slice(r);
  return Buffer.from(t, "base64");
}

/** Desencripta o `enc` para o JSON com o `file` (o master.m3u8). */
function decifrarEnc(enc, chaveTexto, ivTexto) {
  const decipher = crypto.createDecipheriv(
    "aes-256-cbc",
    I(chaveTexto, 32),
    I(ivTexto, 16)
  );
  const txt = Buffer.concat([decipher.update(deB64Url(enc)), decipher.final()]).toString("utf8");
  return JSON.parse(txt);
}

function headersBase(referer) {
  return {
    "User-Agent": UA,
    // O MegaPlay exige um `Referer` (sem ele devolve a pagina de erro).
    Referer: referer || BASE + "/",
    accept: "application/json, text/plain, */*",
  };
}

/**
 * Extrai as fontes NATIVAS de um episodio do MegaPlay.
 *
 * @param {{embedUrl?: string, dataId?: string, audio?: string}} opts
 * @returns {Promise<{m3u8:string, tracks:Array, intro:object, outro:object, audio:string}|null>}
 *   `null` quando nao da' (faltam dados, a cifra mudou, a rede falhou) — quem
 *   chama cai para o iframe.
 */
export async function extrairMegaPlayNativo({ embedUrl, dataId, audio = "sub" }) {
  try {
    // O `data-id` vem da pagina, e a pagina e' do audio pedido — por isso o
    // sub/dub fica certo sem se pedir nada: e' a pagina que decide.
    const id = dataId || (embedUrl ? await lerDataId(embedUrl) : null);
    if (!id) return null;

    const url = `${BASE}/stream/getSources?id=${encodeURIComponent(id)}`;
    const r = await fetch(url, {
      headers: headersBase(embedUrl),
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) return null;
    const dados = await r.json();

    if (dados.enc) {
      const claro = decifrarEnc(dados.enc, CHAVE_POR_DEFEITO, IV_POR_DEFEITO);
      if (claro?.file) {
        return {
          m3u8: claro.file,
          tracks: dados.tracks || [],
          intro: dados.intro || null,
          outro: dados.outro || null,
          audio,
        };
      }
    }
    return null;
  } catch (e) {
    // Chave/IV trocados pelo servidor, `enc` corrompido, rede a cair: qualquer
    // um destes e' "nao consegui agora", nunca um erro que chegue ao frontend.
    log.warn("megaplay", `extracao nativa falhou: ${e.message}`);
    return null;
  }
}

/**
 * Transforma as tracks do MegaPlay no formato que a app ja' usa
 * (`[{ url, lang, label }]`, ver `animeStream.js`).
 *
 * O MegaPlay so' traz legendas em ingles e sem codigo de lingua, por isso
 * `lang` fica "" — o player mostra-as sem marcar. Se vier mais do que uma,
 * a que tiver `default` e' a principal.
 */
export function tracksParaSubtitulos(tracks) {
  return (tracks || [])
    .filter((t) => t?.file)
    .map((t) => ({
      url: t.file,
      lang: "",
      label: t.label || "",
    }));
}