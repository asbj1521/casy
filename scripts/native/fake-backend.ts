/**
 * The browser tests' fake backend over HTTP, for the app's UI tests (#198):
 * the same made-up world, so native screens read what the web's tests read.
 * Bundled and started by scripts/native/ui-tests.sh. SLOW_ACTIONS (comma
 * separated) answer after a pause, to show what a screen does while it waits.
 */
import { createServer } from "node:http";
import process from "node:process";

import { FakeBackend } from "../../e2e/backend";
import { DEFAULT_WORLD, makeWorld } from "../../e2e/world";

const PORT = Number(process.env.PORT ?? 4318);
const SLOW = new Set((process.env.SLOW_ACTIONS ?? "").split(",").filter(Boolean));
const PAUSE_MS = 8000;

const backend = new FakeBackend(makeWorld(DEFAULT_WORLD));

createServer((request, response) => {
  const chunks: Buffer[] = [];
  request.on("data", (chunk: Buffer) => chunks.push(chunk));
  request.on("end", () => {
    const url = new URL(request.url ?? "/", `http://localhost:${PORT}`);
    const name = /^\/functions\/v1\/([^/]+)$/.exec(url.pathname)?.[1];
    const send = (status: number, json: unknown) => {
      response.writeHead(status, { "Content-Type": "application/json" });
      response.end(JSON.stringify(json));
    };
    if (!name) return send(404, { error: "Not a function" });
    const text = Buffer.concat(chunks).toString();
    const body = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    const answer = backend.answer({ name, params: url.searchParams, body });
    console.log(
      `${name} ${String(body.action ?? "")} ${String(body.kind ?? "")} ${String(body.on ?? "")}`,
    );
    setTimeout(
      () => send(answer.status, answer.json),
      typeof body.action === "string" && SLOW.has(body.action) ? PAUSE_MS : 0,
    );
  });
}).listen(PORT, () => console.log(`fake backend on ${PORT}`));
