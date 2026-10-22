/**
 * Tell Casy (#116), backed by two Edge Functions: `entries-ai` turns what the
 * person said or wrote into proposed entries (nothing is saved), and
 * `calendar-entries` saves the ones they kept and deletes them again. Only the
 * text, the language and the proposal on screen are sent to the AI; never
 * calendars.
 */
import type { QueryClient } from "@tanstack/react-query";

import { currentMessages } from "@/i18n/current";
import type { CasyEntry, StoredEntry } from "@/lib/casyEntries";
import { callFunction } from "@/lib/supabaseFunctions";

export interface EntriesProposal {
  /** The whole list as it should be now (a go refines the one before). */
  entries: CasyEntry[];
  /** A question or remark from Casy, in the person's language. */
  message: string | null;
  /** Your AI calls left today. */
  left: number;
}

/**
 * Ask for entries from a description (`current` null) or from more details on
 * the proposal so far, with what was written before in `earlier`.
 */
export async function proposeEntries(input: {
  text: string;
  earlier: string[];
  current: CasyEntry[] | null;
}): Promise<EntriesProposal> {
  return await callFunction<EntriesProposal>("entries-ai", {
    body: input,
    errorMessage: currentMessages().tellCasy.failed,
  });
}

/** Keep the entries the person checked. */
export async function saveEntries(entries: CasyEntry[]): Promise<StoredEntry[]> {
  const answer = await callFunction<{ entries: StoredEntry[] }>("calendar-entries", {
    body: { action: "add", entries },
    errorMessage: currentMessages().tellCasy.saveFailed,
  });
  return answer.entries;
}

export async function deleteEntry(id: string): Promise<void> {
  await callFunction("calendar-entries", {
    body: { action: "delete", id },
    errorMessage: currentMessages().tellCasy.deleteFailed,
  });
}

/**
 * After entries were saved or deleted: My calendar and every answer built
 * from your busy time are fetched again, your groups' searches too (they read
 * the entries through the groups function).
 */
export async function entriesChanged(queryClient: QueryClient): Promise<void> {
  await Promise.all(
    ["calendar-busy", "group-busy"].map((key) =>
      queryClient.invalidateQueries({ queryKey: [key] }),
    ),
  );
}
