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
 * `{ calendars: "none" }` with nothing connected and `{ aiConsent: false }`
 * without the yes to the AI (#200), and `{ outdated: true }` with every
 * app too old, so the page asks it to update (#281), and `{ phoneCalendar:
 * { externalId, name } }` with that calendar on this phone (the app's labels, #282).
 *
 * POST /someone makes a change as someone else would (#202): with `{ trips:
 * true }` two agreed events over several days, otherwise a new vote from
 * Jonas waiting for Mia's answers, the pulse moved, and a broadcast on every
 * socket joined to a pulse topic. The socket is Realtime's, as much as
 * the app's live pulse speaks (PulseSocket.swift): the handshake, a join let
 * in when it carries a login, heartbeats answered, and the broadcast.
 *
 * It also stands in for Supabase Auth (#280): the web build the parity shots
 * compare against (`npm run ios:parity`) talks to this server from the app's
 * page, so it answers Mia's user, her token and signing out, with the CORS
 * headers a page on capacitor://localhost needs.
 */
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import type { Duplex } from "node:stream";
import process from "node:process";

import { addReviews } from "../../e2e/adminReviews";
import { FakeBackend } from "../../e2e/backend";
import { CORS, session, user } from "../../e2e/session";
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
    const send = (status: number, json?: unknown) => {
      response.writeHead(status, { ...CORS, "Content-Type": "application/json" });
      response.end(json === undefined ? "" : JSON.stringify(json));
    };
    if (request.method === "OPTIONS") return send(204);
    const text = Buffer.concat(chunks).toString();
    if (url.pathname === "/someone") {
      const asked = (text ? JSON.parse(text) : {}) as { trips?: boolean };
      // Two agreed events over several days (#202): a weekend away and three weeks in Norway.
      const run = backend.world.events.find((e) => e.title === "Løbetur");
      if (asked.trips && run) {
        const agreed = (id: string, title: string, start: string, end: string) => ({
          ...structuredClone(run),
          id,
          title,
          currentDate: { ...structuredClone(run.currentDate!), start, end },
        });
        backend.world.events.push(
          agreed(
            "ev-weekend",
            "Weekendtur",
            "2026-10-16T15:00:00.000Z",
            "2026-10-19T19:00:00.000Z",
          ),
          agreed("ev-norway", "Norge", "2026-11-02T07:00:00.000Z", "2026-11-22T18:00:00.000Z"),
        );
        backend.world.version++;
        return send(200, {});
      }
      const vote = backend.world.events.find((e) => e.id === "ev-boardgames");
      if (vote) {
        backend.world.events.push({
          ...structuredClone(vote),
          id: "ev-live",
          title: "Padel",
          candidates: vote.candidates.map((c) => ({ ...c, id: `${c.id}-live` })),
        });
      }
      backend.world.version++;
      broadcastPulse();
      return send(200, {});
    }
    if (url.pathname === "/reset") {
      const seed = (text ? JSON.parse(text) : {}) as {
        friends?: typeof backend.world.friends;
        admin?: boolean;
        reviews?: boolean;
        calendars?: "none";
        aiConsent?: boolean;
        outdated?: boolean;
        phoneCalendar?: { externalId: string; name: string };
      };
      backend = new FakeBackend(
        makeWorld(seed.calendars ? { ...DEFAULT_WORLD, calendars: seed.calendars } : DEFAULT_WORLD),
      );
      if (seed.friends) backend.world.friends = seed.friends;
      if (seed.admin) backend.world.admin = "current";
      if (seed.reviews) addReviews(backend.world);
      if (seed.aiConsent === false) backend.world.aiConsent = false;
      if (seed.outdated) backend.world.minAppVersion = "999.0.0";
      // The app's own labels test (#282, TestPhone.swift): a calendar it made on the
      // simulator, listed as this phone's under its EventKit id.
      if (seed.phoneCalendar) {
        backend.world.connections.push({
          ...backend.world.connections[0],
          id: "conn-phone",
          provider: "device",
          account_label: "iPhone",
          calendar_sources: [
            {
              ...backend.world.connections[0].calendar_sources[0],
              id: "cal-phone",
              display_name: seed.phoneCalendar.name,
              external_id: seed.phoneCalendar.externalId,
              // New on the phone: nobody has sorted it, so the app's AI sorting asks (#118).
              purpose: null,
              purpose_source: null,
            },
          ],
        });
      }
      return send(200, {});
    }
    // What a parity test (#280) hands the app (-casyWebSession) to put in the
    // page's storage before it loads: Mia's session under the web build's key
    // (authOptions in src/lib/supabase.ts, for http://localhost:4318), and her
    // Apple account remembered as this phone's (src/lib/phoneCalendar.ts), as
    // after connecting it, so the page shows her month, not the import step.
    if (url.pathname === "/parity/session") {
      // The connection it names this phone's, as the real server knows the phone by its id.
      backend.world.phoneConnection = "conn-apple";
      return send(200, {
        "sb-localhost-auth-token": JSON.stringify(session()),
        [`casy-phone-calendar:${user.id}`]: "conn-apple",
      });
    }
    if (url.pathname === "/auth/v1/user") return send(200, user);
    if (url.pathname === "/auth/v1/logout") return send(204);
    if (url.pathname === "/auth/v1/token") return send(200, session());
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
})
  .on("upgrade", (request, socket: Duplex) => {
    const key = request.headers["sec-websocket-key"];
    if (!request.url?.startsWith("/realtime/v1/websocket") || typeof key !== "string") {
      socket.destroy();
      return;
    }
    const accept = createHash("sha1")
      .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
      .digest("base64");
    socket.write(
      "HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n" +
        `Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
    );
    const live: LiveSocket = { socket, topics: new Set() };
    sockets.add(live);
    let pending = Buffer.alloc(0);
    socket.on("data", (chunk: Buffer) => {
      pending = Buffer.concat([pending, chunk]);
      for (;;) {
        const frame = readFrame(pending);
        if (!frame) break;
        pending = pending.subarray(frame.length);
        if (frame.opcode === 8) {
          socket.end();
          return;
        }
        if (frame.opcode === 1 || frame.opcode === 2) answerSocket(live, frame.payload.toString());
      }
    });
    socket.on("close", () => sockets.delete(live));
    socket.on("error", () => sockets.delete(live));
  })
  .listen(PORT, () => console.log(`fake backend on ${PORT}`));

interface LiveSocket {
  socket: Duplex;
  topics: Set<string>;
}

const sockets = new Set<LiveSocket>();

/** One frame from a client (always masked), or nothing until it has all arrived. */
function readFrame(data: Buffer): { opcode: number; payload: Buffer; length: number } | null {
  if (data.length < 2) return null;
  const opcode = data[0] & 0x0f;
  let size = data[1] & 0x7f;
  let offset = 2;
  if (size === 126) {
    if (data.length < 4) return null;
    size = data.readUInt16BE(2);
    offset = 4;
  } else if (size === 127) {
    if (data.length < 10) return null;
    size = Number(data.readBigUInt64BE(2));
    offset = 10;
  }
  const masked = (data[1] & 0x80) !== 0;
  const mask = masked ? data.subarray(offset, offset + 4) : null;
  if (masked) offset += 4;
  if (data.length < offset + size) return null;
  const payload = Buffer.from(data.subarray(offset, offset + size));
  if (mask) for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4];
  return { opcode, payload, length: offset + size };
}

function sendText(socket: Duplex, text: string) {
  const body = Buffer.from(text);
  const head =
    body.length < 126
      ? Buffer.from([0x81, body.length])
      : Buffer.from([0x81, 126, body.length >> 8, body.length & 0xff]);
  socket.write(Buffer.concat([head, body]));
}

/** Realtime's answers: a join with a login let in, a heartbeat answered. */
function answerSocket(live: LiveSocket, text: string) {
  const message = JSON.parse(text) as {
    topic: string;
    event: string;
    payload: { access_token?: string };
    ref: string | null;
    join_ref?: string;
  };
  const reply = (status: string) =>
    sendText(
      live.socket,
      JSON.stringify({
        topic: message.topic,
        event: "phx_reply",
        payload: { status, response: {} },
        ref: message.ref,
        join_ref: message.join_ref ?? message.ref,
      }),
    );
  if (message.event === "phx_join") {
    if (!message.payload.access_token) return reply("error");
    live.topics.add(message.topic);
    return reply("ok");
  }
  if (message.event === "heartbeat") reply("ok");
}

/** Every pulse topic joined told something changed (a test's app may be Mia or "test-user"). */
function broadcastPulse() {
  for (const live of sockets) {
    const topic = [...live.topics].find((t) => t.startsWith("realtime:pulse:"));
    if (!topic) continue;
    sendText(
      live.socket,
      JSON.stringify({
        topic,
        event: "broadcast",
        payload: { type: "broadcast", event: "pulse", payload: {} },
        ref: null,
      }),
    );
  }
}
