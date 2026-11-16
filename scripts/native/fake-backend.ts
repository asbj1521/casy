/**
 * The browser tests' fake backend over HTTP, for the app's UI tests (#198):
 * the same made-up world, so native screens read what the web's tests read.
 * Bundled and started by scripts/native/ui-tests.sh. SLOW_ACTIONS (comma
 * separated) answer after a pause, to show what a screen does while it waits.
 * POST /reset starts the world again, for a test that changes it (leaving a
 * group, answering an invitation) so the next one finds it as it was; a body
 * of `{ friends: [...] }` starts it with those friends from groups since gone,
 * `{ admin: true }` with Mia an admin, and `{ reviews: true }` with reports
 * and AI corrections waiting for her (e2e/adminReviews.ts), and
 * `{ calendars: "none" }` with nothing connected (#200).
 */
import { createServer } from "node:http";
import process from "node:process";

import { addReviews } from "../../e2e/adminReviews";
import { FakeBackend } from "../../e2e/backend";
import { DEFAULT_WORLD, makeWorld } from "../../e2e/world";

const PORT = Number(process.env.PORT ?? 4318);
const SLOW = new Set((process.env.SLOW_ACTIONS ?? "").split(",").filter(Boolean));
const PAUSE_MS = 3000;

let backend = new FakeBackend(makeWorld(DEFAULT_WORLD));

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
    const text = Buffer.concat(chunks).toString();
    if (url.pathname === "/reset") {
      const seed = (text ? JSON.parse(text) : {}) as {
        friends?: typeof backend.world.friends;
        admin?: boolean;
        reviews?: boolean;
        calendars?: "none";
      };
      backend = new FakeBackend(
        makeWorld(seed.calendars ? { ...DEFAULT_WORLD, calendars: seed.calendars } : DEFAULT_WORLD),
      );
      if (seed.friends) backend.world.friends = seed.friends;
      if (seed.admin) backend.world.admin = "current";
      if (seed.reviews) addReviews(backend.world);
      return send(200, {});
    }
    if (!name) return send(404, { error: "Not a function" });
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
