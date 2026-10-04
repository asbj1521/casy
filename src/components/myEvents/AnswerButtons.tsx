import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, X } from "lucide-react";

import { acceptEvent, declineEvent } from "@/api/events";
import Notice from "@/components/ui/Notice";
import { useSignedInUser } from "@/context/auth";
import { useEventChange } from "@/hooks/useEventChange";
import { useT } from "@/i18n/lang";
import type { DatedEvent } from "@/lib/myEvents";

/**
 * Your answer to a date: accept it, or decline it, which (after a second
 * "yes") swaps in the next date that works for everyone, found in this
 * browser by the same search. Shared by the phone's card (NeedsAnswerCard)
 * and the computer's open event (EventDetails).
 */
export default function AnswerButtons({ event }: { event: DatedEvent }) {
  const t = useT();
  const userId = useSignedInUser().id;
  const queryClient = useQueryClient();
  const [declining, setDeclining] = useState(false);
  const accept = useEventChange(() => acceptEvent(event));
  const decline = useEventChange(() => declineEvent(queryClient, userId, event));
  const busy = accept.isPending || decline.isPending;
  const error = (accept.error ?? decline.error)?.message;

  return (
    <>
      {declining ? (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4">
          <p className="text-sm text-rose-900">{t.events.cantMake}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              // The event stays, now with the next date to answer.
              onClick={() => decline.mutate(undefined, { onSuccess: () => setDeclining(false) })}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {t.events.declineFind}
            </button>
            <button
              type="button"
              onClick={() => setDeclining(false)}
              disabled={busy}
              className="rounded-full px-4 py-2 text-sm font-medium text-rose-900/80 transition hover:text-rose-900"
            >
              {t.events.keepIt}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              decline.reset();
              accept.mutate();
            }}
            disabled={busy}
            className="flex items-center justify-center gap-2 rounded-full bg-primary py-3 font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition hover:opacity-90 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
            {t.events.accept}
          </button>
          <button
            type="button"
            onClick={() => {
              accept.reset();
              setDeclining(true);
            }}
            disabled={busy}
            className="flex items-center justify-center gap-2 rounded-full border bg-background py-3 font-semibold text-foreground transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-60"
          >
            <X className="h-5 w-5" />
            {t.events.decline}
          </button>
        </div>
      )}

      {error && (
        <Notice tone="error" bare className="mt-3">
          {error}
        </Notice>
      )}
    </>
  );
}
