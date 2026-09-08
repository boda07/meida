// Cliente da API do Real-Debrid.
// O utilizador cola o token de https://real-debrid.com/apitoken. Com ele:
//  - verificamos se o torrent já está em cache ("instant") -> streaming imediato
//  - adicionamos o magnet -> o RD descarrega nos servidores dele (rápido)
//  - obtemos um link direto e transmitimos por proxy (sem expor o token no browser)
//
// Docs: https://docs.real-debrid.com/ (API v2, duplica a v1).

const RD_API = "https://api.real-debrid.com/rest/1.0";

function httpError(status, msg) {
  const e = new Error(msg);
  e.status = status;
  return e;
}

// As chamadas à API do RD usam o token do próprio utilizador.
async function rdFetch(token, method, path, { form } = {}) {
  const headers = {
    Authorization: `Bearer ${token}`,
  };
  let payload;
  if (form) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    payload = new URLSearchParams(form).toString();
  }
  const res = await fetch(RD_API + path, {
    method,
    headers,
    body: payload,
  });
  if (res.status === 401 || res.status === 403) {
    throw httpError(401, "Token do Real-Debrid inválido ou expirado.");
  }
  if (!res.ok) {
    let msg = `Real-Debrid respondeu ${res.status}`;
    try {
      const body = await res.json();
      if (body.error) msg = body.error;
    } catch {
      /* corpo nao é JSON */
    }
    throw httpError(502, msg);
  }
  if (res.status === 204 || (res.headers.get("content-length") === "0")) return null;
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// Valida o token e devolve o username/email da conta.
export async function checkToken(token) {
  const user = await rdFetch(token, "GET", "/user");
  return user && user.username ? user.username : null;
}

// Torrent já em cache no RD? Devs: { hash -> { rd: [{ filename, files, ... }] } }
// Os clientes do RD podem ter várias cópias; pega na que tiver ficheiros.
export async function instantInfo(token, infoHash) {
  const res = await rdFetch(token, "GET", `/torrents/instantAvailability/${infoHash}`);
  if (!res || typeof res !== "object") return null;
  const entry = res[infoHash.toLowerCase()];
  if (!entry || !entry.rd || entry.rd.length === 0) return null;
  return entry.rd.find((x) => x && Array.isArray(x.files)) || entry.rd[0] || null;
}

// Adiciona um magnet ao RD e devolve o id do torrent novo.
export async function addMagnet(token, magnet) {
  const res = await rdFetch(token, "POST", "/torrents/addMagnet", {
    form: { magnet },
  });
  if (!res?.id) throw httpError(502, "Não consegui adicionar o magnet no Real-Debrid.");
  return res.id;
}

// Seleciona TODOS os ficheiros do torrent (ou um id especifico, se houver `only`).
export async function selectFiles(token, torrentId, only) {
  const files = only != null ? String(only) : "all";
  await rdFetch(token, "POST", `/torrents/selectFiles/${torrentId}`, {
    form: { files },
  });
}

// Detalhes do torrent (estado, progresso, ficheiros) no RD.
export async function torrentInfo(token, torrentId) {
  return rdFetch(token, "GET", `/torrents/info/${torrentId}`);
}

// Associa o torrent a uma "download" e devolve { id, download } (link direto).
export async function createDownload(token, torrentId, fileId) {
  const res = await rdFetch(token, "POST", "/downloads", {
    form: { torrent: torrentId, file: fileId },
  });
  if (!res) throw httpError(502, "Real-Debrid não devolveu link para o ficheiro.");
  return res;
}

// Devolve o link de streaming m3u8 (transcode) de um torrent RD.
export async function streamingLink(token, torrentId, fileId) {
  const res = await rdFetch(
    token,
    "GET",
    `/streaming/transcode/${torrentId}/${fileId}`
  );
  return res;
}

// Escolhe, entre os ficheiros de um torrent RD, o ficheiro de vídeo principal.
export function pickVideoFile(files = []) {
  const vids = files.filter((f) =>
    /\.(mp4|m4v|mkv|webm|avi|mov|ts|mpg|mpeg|wmv|flv)$/i.test(f.path || f.filename || "")
  );
  const pool = vids.length ? vids : files;
  return pool.reduce((a, b) => ((b.bytes || 0) > (a?.bytes || 0) ? b : a), pool[0]);
}
