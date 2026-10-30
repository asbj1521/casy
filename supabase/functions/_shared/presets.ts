/**
 * Genveje (#175): a person's saved plans, as the plan-presets function reads
 * and writes them. The plan itself is the Planlæg sheet's own shape, read
 * strictly by the app that made it (src/lib/presets.ts); here it is only
 * checked to be a small object, since it never reaches anyone else and the
 * search it starts runs through the usual checks.
 */

/** At most this many a person (the table's trigger says the same). */
export const MAX_PRESETS = 6;
export const MAX_PRESET_NAME = 40;
/** The plan's size as JSON, below the table's 8 KB check. */
export const MAX_PLAN_BYTES = 8000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A uuid, or null for anything else. */
export function readUuid(raw: unknown): string | null {
  return typeof raw === "string" && UUID.test(raw) ? raw.toLowerCase() : null;
}

/** What a save sends: a new genvej (no id) or a changed one. */
export interface PresetInput {
  id: string | null;
  name: string;
  plan: Record<string, unknown>;
  /**
   * Its picture (#186): a JPEG to put on it (base64, read by readPicture),
   * null to take it off, undefined to leave it as it is.
   */
  picture: string | null | undefined;
}

/** A save's body as a genvej, or null when any of it is wrong. */
export function readPreset(body: Record<string, unknown>): PresetInput | null {
  const id = body.id === undefined || body.id === null ? null : readUuid(body.id);
  if (body.id != null && id === null) return null;
  if (typeof body.name !== "string") return null;
  const name = body.name.trim().replace(/\s+/g, " ");
  if (name.length === 0 || name.length > MAX_PRESET_NAME) return null;
  const plan = body.plan;
  if (!plan || typeof plan !== "object" || Array.isArray(plan)) return null;
  if (new TextEncoder().encode(JSON.stringify(plan)).length > MAX_PLAN_BYTES) return null;
  const picture = body.picture;
  if (picture !== undefined && picture !== null && typeof picture !== "string") return null;
  return { id, name, plan: plan as Record<string, unknown>, picture };
}

export interface PresetRow {
  id: string;
  name: string;
  plan: Record<string, unknown>;
  updated_at: string;
  picture_path: string | null;
}

export const PRESET_COLUMNS = "id, name, plan, updated_at, picture_path";

/** A genvej as the app gets it. */
export interface StoredPreset {
  id: string;
  name: string;
  plan: Record<string, unknown>;
  updatedAt: string;
  /** Whether it has a picture (#186): the app is handed a link to it, Your data only this. */
  picture: boolean;
}

export function presetFrom(row: PresetRow): StoredPreset {
  return {
    id: row.id,
    name: row.name,
    plan: row.plan,
    updatedAt: row.updated_at,
    picture: !!row.picture_path,
  };
}
