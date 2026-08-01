// Testes de integração do jikanFetch — ordem invertida (1-out-2026):
// Tenrai (primário) -> Jikan (backup). Mock do fetch global, sem deps.
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.DB_DIR = mkdtempSync(join(tmpdir(), "meida-test-"));
const TENRAI = "https://api.tenrai.org/v1";
const JIKAN = "https://api.jikan.moe/v4";

const { jikanFetch } = await import("../src/services/jikan.js");
const { cacheSet } = await import("../src/services/cache.js");

// Tenrai (primário) -> Jikan (backup). O cooldown é do primário (Tenrai).
const realNow = Date.now.bind(Date);
let offset = 0;
beforeEach(() => {
  offset += 40000;
  Date.now = () => realNow() + offset;
});
afterEach(() => {
  Date.now = realNow;
});

function mockFetch({ primaryStatus = 200, backupStatus = 200, primaryBody, backupBody } = {}) {
  const calls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url);
    calls.push(u);
    if (u.startsWith(TENRAI)) {
      if (primaryStatus === 429 || primaryStatus >= 500) return new Response("erro", { status: primaryStatus });
      return new Response(JSON.stringify(primaryBody ?? { data: [{ mal_id: 2, title: "Do Tenrai" }] }), { status: primaryStatus });
    }
    if (u.startsWith(JIKAN)) {
      if (backupStatus === 429 || backupStatus >= 500) return new Response("erro", { status: backupStatus });
      return new Response(JSON.stringify(backupBody ?? { data: [{ mal_id: 1, title: "Do Jikan" }] }), { status: backupStatus });
    }
    return new Response("not found", { status: 404 });
  };
  return {
    calls,
    primaryCalls: () => calls.filter((u) => u.startsWith(TENRAI)),
    backupCalls: () => calls.filter((u) => u.startsWith(JIKAN)),
    restore: () => {
      globalThis.fetch = realFetch;
    },
  };
}

test("Tenrai (primário) a responder: usa-o e nunca toca no Jikan", async () => {
  const m = mockFetch({ primaryBody: { data: [{ mal_id: 2, title: "Do Tenrai" }] } });
  try {
    const data = await jikanFetch("/top/anime");
    assert.equal(data.data[0].title, "Do Tenrai");
    assert.equal(m.primaryCalls().length >= 1, true);
    assert.equal(m.backupCalls().length, 0);
  } finally {
    m.restore();
  }
});

test("Tenrai 500: cai para o Jikan (backup) e devolve os dados", async () => {
  const m = mockFetch({ primaryStatus: 500, backupBody: { data: [{ mal_id: 1, title: "Do Jikan" }] } });
  try {
    const data = await jikanFetch("/top/anime");
    assert.equal(data.data[0].title, "Do Jikan");
    assert.ok(m.primaryCalls().length >= 1);
    assert.equal(m.backupCalls().length, 1);
  } finally {
    m.restore();
  }
});

test("Tenrai 429 (rate limit): tenta de novo e cai para o Jikan", async () => {
  const m = mockFetch({ primaryStatus: 429, backupBody: { data: [{ mal_id: 1, title: "Do Jikan" }] } });
  try {
    const data = await jikanFetch("/top/anime");
    assert.equal(data.data[0].title, "Do Jikan");
    assert.equal(m.primaryCalls().length, 2, "1 tentativa + 1 retry do Tenrai");
    assert.equal(m.backupCalls().length, 1);
  } finally {
    m.restore();
  }
});

test("Tenrai e Jikan em baixo: atira o erro (sem cache)", async () => {
  const m = mockFetch({ primaryStatus: 500, backupStatus: 500 });
  try {
    await assert.rejects(() => jikanFetch("/test/ambos-em-baixo", { retries: 0 }), /Tenrai 500/);
  } finally {
    m.restore();
  }
});

test("Tenrai e Jikan em baixo mas com cache em disco: serve a ultima resposta", async () => {
  const path = "/test/com-cache";
  cacheSet(path, { data: [{ mal_id: 7, title: "Da cache" }] });
  const m = mockFetch({ primaryStatus: 500, backupStatus: 500 });
  try {
    const data = await jikanFetch(path, { retries: 0 });
    assert.equal(data.data[0].title, "Da cache");
  } finally {
    m.restore();
  }
});

test("Falha de rede no Tenrai (primário): cai para o Jikan", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.startsWith(TENRAI)) throw new TypeError("network down");
    return new Response(JSON.stringify({ data: [{ mal_id: 1, title: "Do Jikan" }] }), { status: 200 });
  };
  try {
    const data = await jikanFetch("/top/anime");
    assert.equal(data.data[0].title, "Do Jikan");
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("cooldown: Tenrai bloqueado vai directo ao Jikan sem o tentar", async () => {
  const m1 = mockFetch({ primaryStatus: 500, backupStatus: 500 });
  try {
    await assert.rejects(() => jikanFetch("/test/forca-cooldown", { retries: 0 }), /Tenrai 500/);
  } finally {
    m1.restore();
  }
  // Cooldown do Tenrai ativo: vai directo ao Jikan, sem tocar no Tenrai.
  const m2 = mockFetch({ backupBody: { data: [{ mal_id: 1, title: "Do Jikan" }] } });
  try {
    const data = await jikanFetch("/test/cooldown-direto");
    assert.equal(data.data[0].title, "Do Jikan");
    assert.equal(m2.primaryCalls().length, 0);
    assert.equal(m2.backupCalls().length, 1);
  } finally {
    m2.restore();
  }
});

process.on("exit", () => {
  try {
    rmSync(process.env.DB_DIR, { recursive: true, force: true });
  } catch {
    /* ignora */
  }
});
