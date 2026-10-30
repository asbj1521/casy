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
  return { id, name, plan: plan as Record<string, unknown> };
}

export interface PresetRow {
  id: string;
  name: string;
  plan: Record<string, unknown>;
  updated_at: string;
}

export const PRESET_COLUMNS = "id, name, plan, updated_at";

/** A genvej as the app gets it. */
export interface StoredPreset {
  id: string;
  name: string;
  plan: Record<string, unknown>;
  updatedAt: string;
}

export function presetFrom(row: PresetRow): StoredPreset {
  return {
    id: row.id,
    name: row.name,
    plan: row.plan,
    updatedAt: row.updated_at,
  };
}
