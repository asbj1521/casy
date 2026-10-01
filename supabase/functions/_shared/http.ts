/**
 * The shell around every function the site calls with fetch() (all but the
 * OAuth callbacks, which browsers reach by redirect): CORS, the one method it
 * answers, the JSON body read once, and every error answered the same way,
 * in the caller's language (i18n.ts).
 *
 * A handler returns what to send (as JSON, status 200) or a Response of its
 * own, and throws an HttpError for anything the caller should be told. Any
 * other throw is a bug or an outage: it is logged under the function's name
 * and answered with a plain 500 that gives nothing away.
 */
import { langOf, translateError } from "./i18n.ts";

/**
 * Any origin may call, which is safe here: the login travels as a bearer
 * token the page adds itself, never as a cookie a browser would attach on a
 * stranger's behalf, so another site can't act as a signed-in person.
 */
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

/** A request's JSON fields; a request without a body has none. */
export type Body = Record<string, unknown>;

type Handler = (req: Request, body: Body) => Promise<unknown>;

/** A failure meant for the caller, answered as `{ error, ...extra }` with this status. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** More of the answer, such as the event list a half-failed action still changed. */
    readonly extra: Body = {},
  ) {
    super(message);
  }
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

/** Answer every request to this function with `handler`, as described at the top. */
export function serve(name: string, handler: Handler, method: "GET" | "POST" = "POST"): void {
  Deno.serve(handle(name, handler, method));
}

/** serve's request handling, apart from the server so it can be tested. */
export function handle(
  name: string,
  handler: Handler,
  method: "GET" | "POST",
): (req: Request) => Promise<Response> {
  return async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
    const lang = langOf(req);
    let body: Body = {};
    try {
      if (req.method !== method) throw new HttpError(405, `Use ${method}`);
      if (method === "POST") body = await readBody(req);
      const result = await handler(req, body);
      return result instanceof Response ? result : json(result);
    } catch (err) {
      if (err instanceof HttpError) {
        return json({ ...err.extra, error: translateError(err.message, lang) }, err.status);
      }
      const action = typeof body.action === "string" ? ` ${body.action}` : "";
      console.error(`${name}${action} failed`, err);
      return json({ error: translateError("Something went wrong. Please try again.", lang) }, 500);
    }
  };
}

async function readBody(req: Request): Promise<Body> {
  const text = await req.text();
  if (!text) return {};
  try {
    const body = JSON.parse(text);
    if (body !== null && typeof body === "object" && !Array.isArray(body)) return body;
  } catch {
    // Not JSON at all: refused below, the same as JSON that isn't an object.
  }
  throw new HttpError(400, "Body must be a JSON object");
}

/** A field that must be text, such as an id. */
export function requireString(body: Body, field: string): string {
  const value = body[field];
  if (typeof value !== "string") throw new HttpError(400, `${field} is required`);
  return value;
}

/**
 * The most days of busy times one request may cover: a month grid needs 42,
 * the scheduling page its whole search window, twelve months from the 1st of
 * this one.
 */
const MAX_RANGE_DAYS = 400;

/** A from/to pair of ISO timestamps, with `to` after `from` and not too far from it. */
export function readRange(from: unknown, to: unknown): { from: Date; to: Date } {
  const start = new Date(typeof from === "string" ? from : NaN);
  const end = new Date(typeof to === "string" ? to : NaN);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
    throw new HttpError(400, "from and to must be ISO timestamps with to after from");
  }
  if (end.getTime() - start.getTime() > MAX_RANGE_DAYS * 86_400_000) {
    throw new HttpError(400, `Range is limited to ${MAX_RANGE_DAYS} days`);
  }
  return { from: start, to: end };
}

/** Supabase's edge runtime: keeps the function alive for work after the response. */
declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

/** Do `work` once the answer has gone. Nobody is waiting, so a failure is only logged. */
export function afterResponse(label: string, work: () => Promise<unknown>): void {
  EdgeRuntime.waitUntil(
    Promise.resolve()
      .then(work)
      .catch((err) => console.error(`${label} failed`, err)),
  );
}
