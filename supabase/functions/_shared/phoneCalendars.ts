/**
 * A push from the iPhone app's phone calendars (#63; the calendar-phone
 * function): every calendar on the phone and its busy blocks, worked out on
 * the phone by src/lib/phoneBusy.ts. Treated like any other request body:
 * checked, bounded and normalised before it reaches sync_phone_calendars.
 */
import { HttpError, type Body } from "./http.ts";
import { syncWindow } from "./syncWindow.ts";
import { cleanText } from "./text.ts";

/** More calendars than any phone has: a bound, not a limit anyone meets. */
export const MAX_CALENDARS = 100;
/** Busy blocks per push, all calendars together: a year of a very full calendar is a few thousand. */
export const MAX_BLOCKS = 20_000;
/** One block can't be longer than the window it is in. */
const MAX_BLOCK_MS = 400 * 86_400_000;
const MAX_ID_LENGTH = 512;
const MAX_NAME_LENGTH = 120;
const MAX_LABEL_LENGTH = 40;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface PhonePush {
  deviceId: string;
  /** What the account is listed as: "iPhone" or "iPad". */
  label: string;
  /** Make the connection if there is none ("Connect this phone"). */
  create: boolean;
  calendars: {
    id: string;
    name: string;
    hidden: boolean;
    blocks: { start: string; end: string }[];
  }[];
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * The push, checked. Blocks wholly outside the sync window are dropped;
 * blocks reaching into it are kept whole, so an event under way at the push
 * isn't stored as starting then (see syncWindow.ts).
 */
export function parsePhonePush(body: Body, now = new Date()): PhonePush {
  const deviceId = body.deviceId;
  if (typeof deviceId !== "string" || !UUID.test(deviceId)) {
    throw new HttpError(400, "A device id is required");
  }
  if (!Array.isArray(body.calendars)) throw new HttpError(400, "calendars must be a list");
  if (body.calendars.length > MAX_CALENDARS) throw new HttpError(400, "Too many calendars");

  const { start, end } = syncWindow(now);
  const from = start.getTime();
  const to = end.getTime();
  const seen = new Set<string>();
  let total = 0;
  const calendars: PhonePush["calendars"] = [];

  for (const raw of body.calendars) {
    if (!isObject(raw)) throw new HttpError(400, "Each calendar must be an object");
    const id = raw.id;
    if (typeof id !== "string" || id.length === 0 || id.length > MAX_ID_LENGTH) {
      throw new HttpError(400, "Each calendar needs an id");
    }
    // The same calendar twice would be stored once; the first wins.
    if (seen.has(id)) continue;
    seen.add(id);
    if (!Array.isArray(raw.blocks)) throw new HttpError(400, "blocks must be a list");

    const blocks: { start: string; end: string }[] = [];
    for (const b of raw.blocks) {
      if (!isObject(b) || typeof b.start !== "string" || typeof b.end !== "string") {
        throw new HttpError(400, "Each busy block needs a start and an end");
      }
      const s = Date.parse(b.start);
      const e = Date.parse(b.end);
      if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s || e - s > MAX_BLOCK_MS) {
        throw new HttpError(400, "A busy block's times are invalid");
      }
      if (e <= from || s >= to) continue;
      blocks.push({ start: new Date(s).toISOString(), end: new Date(e).toISOString() });
    }
    total += blocks.length;
    if (total > MAX_BLOCKS) throw new HttpError(400, "Too many busy times");

    calendars.push({
      id,
      name: cleanText(raw.name, MAX_NAME_LENGTH) ?? "Calendar",
      hidden: raw.hidden === true,
      blocks,
    });
  }

  return {
    deviceId: deviceId.toLowerCase(),
    label: cleanText(body.label, MAX_LABEL_LENGTH) ?? "iPhone",
    create: body.create === true,
    calendars,
  };
}
