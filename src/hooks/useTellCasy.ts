/**
 * Tell Casy (#116): one go at saying when you are away or busy, kept by the
 * sheet that opens from My calendar. A description becomes proposed entries
 * (the `entries-ai` function); more details change the proposal; nothing is
 * kept until "Save", which sends the entries still on screen to
 * `calendar-entries`. Entries already kept are deleted one by one.
 */
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { deleteEntry, entriesChanged, proposeEntries, saveEntries } from "@/api/entries";
import type { CasyEntry } from "@/lib/casyEntries";

/** What the server takes as earlier descriptions, at most (MAX_EARLIER). */
const MAX_EARLIER = 4;

interface Session {
  /** What the person has written, oldest first. */
  texts: string[];
  /** The proposal: the whole list as it stands. */
  entries: CasyEntry[];
  /** A question or remark from Casy about it. */
  message: string | null;
  /** AI answers left today; null before the first. */
  left: number | null;
}

const FRESH: Session = { texts: [], entries: [], message: null, left: null };

export function useTellCasy() {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session>(FRESH);

  const ask = useMutation({
    mutationFn: proposeEntries,
    onSuccess: ({ entries, message, left }, input) => {
      setSession((s) => ({ texts: [...s.texts, input.text], entries, message, left }));
    },
  });

  const save = useMutation({
    mutationFn: () => saveEntries(session.entries),
    onSuccess: async () => {
      // Back to a blank box, but keep how many answers are left.
      setSession((s) => ({ ...FRESH, left: s.left }));
      ask.reset();
      await entriesChanged(queryClient);
    },
  });

  const remove = useMutation({
    mutationFn: deleteEntry,
    onSuccess: () => entriesChanged(queryClient),
  });

  /** Ask about `text`: a first description, or more details on the proposal so far. */
  function describe(text: string) {
    const trimmed = text.trim();
    if (!trimmed || ask.isPending) return;
    ask.mutate({
      text: trimmed,
      earlier: session.texts.slice(-MAX_EARLIER),
      current: session.entries.length > 0 ? session.entries : null,
    });
  }

  /** Leave one proposed entry out. */
  function drop(index: number) {
    setSession((s) => ({ ...s, entries: s.entries.filter((_, i) => i !== index) }));
  }

  /** Start over with a new description. */
  function reset() {
    ask.reset();
    save.reset();
    setSession((s) => ({ ...FRESH, left: s.left }));
  }

  return {
    session,
    describe,
    drop,
    reset,
    save: () => save.mutate(),
    saving: save.isPending,
    saveError: save.error?.message ?? null,
    deleteEntry: (id: string) => remove.mutate(id),
    deletingId: remove.isPending ? remove.variables : null,
    deleteError: remove.error?.message ?? null,
    pending: ask.isPending,
    error: ask.error?.message ?? null,
    /** What was sent when the answer failed, to put back in the box to fix and resend. */
    failedText: ask.isError ? (ask.variables?.text ?? "") : "",
  };
}

export type TellCasy = ReturnType<typeof useTellCasy>;
