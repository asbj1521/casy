/**
 * Genveje (#175), kept by the plan-presets function: your saved plans, read
 * strictly as they come back (lib/shortcuts.ts). Only ever your own.
 */
import { queryOptions } from "@tanstack/react-query";

import { currentMessages } from "@/i18n/current";
import { readShortcutPlan, type Shortcut, type ShortcutPlan } from "@/lib/shortcuts";
import { randomDefaultSettings } from "@/lib/scheduler";
import { callFunction } from "@/lib/supabaseFunctions";

interface StoredShortcut {
  id: string;
  name: string;
  plan: unknown;
  updatedAt: string;
}

/** The ones whose plan reads as one; anything else is left out rather than run wrong. */
function readAll(stored: StoredShortcut[] | undefined): Shortcut[] {
  // Missing settings take the first meeting time of the defaults, the same every time.
  const base = randomDefaultSettings(() => 0);
  return (stored ?? []).flatMap((s) => {
    const plan = readShortcutPlan(s.plan, base);
    return plan ? [{ id: s.id, name: s.name, plan, updatedAt: s.updatedAt }] : [];
  });
}

export function shortcutsQueryKey(userId: string) {
  return ["shortcuts", userId] as const;
}

/** Your genveje, oldest first. `userId` only keys the cache. */
export function shortcutsQuery(userId: string) {
  return queryOptions({
    queryKey: shortcutsQueryKey(userId),
    queryFn: async (): Promise<Shortcut[]> => {
      const body = await callFunction<{ presets?: StoredShortcut[] }>("plan-presets", {
        body: { action: "list" },
        errorMessage: currentMessages().shortcuts.loadFailed,
      });
      return readAll(body.presets);
    },
    staleTime: 60_000,
  });
}

/** What a save sends: a new genvej (no id) or a changed one. */
export interface ShortcutInput {
  id: string | null;
  name: string;
  plan: ShortcutPlan;
}

/** A new genvej (no id) or a changed one; answers with them all, and the one saved. */
export async function saveShortcut(
  input: ShortcutInput,
): Promise<{ shortcuts: Shortcut[]; savedId: string }> {
  const body = await callFunction<{ presets: StoredShortcut[]; savedId: string }>("plan-presets", {
    body: { action: "save", ...input },
    errorMessage: currentMessages().shortcuts.saveFailed,
  });
  return { shortcuts: readAll(body.presets), savedId: body.savedId };
}

export async function deleteShortcut(id: string): Promise<Shortcut[]> {
  const body = await callFunction<{ presets: StoredShortcut[] }>("plan-presets", {
    body: { action: "delete", id },
    errorMessage: currentMessages().shortcuts.deleteFailed,
  });
  return readAll(body.presets);
}
