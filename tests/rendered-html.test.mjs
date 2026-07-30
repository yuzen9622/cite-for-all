import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import test from "node:test";

const templateRoot = new URL("../", import.meta.url);

async function getWorker() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker;
}

async function render() {
  const worker = await getWorker();
  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the citation converter product", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Cite for All｜文獻引用格式轉換<\/title>/i);
  assert.match(html, /文獻格式/);
  assert.match(html, /單筆轉換/);
  assert.match(html, /批次轉換/);
  assert.match(html, /APA 7th/);
  assert.match(html, /Powered by PapersFlow/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("rejects an empty citation API request without calling upstream", async () => {
  const worker = await getWorker();
  const response = await worker.fetch(
    new Request("http://localhost/api/cite", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ inputs: [] }),
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: "請至少提供一筆 DOI 或論文標題。",
  });
});

test("removes the disposable starter preview", async () => {
  await assert.rejects(access(new URL("app/_sites-preview", templateRoot)));
});
