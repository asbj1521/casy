import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, X } from "lucide-react";

import { acceptEvent, declineEvent } from "@/api/events";
import { EdgeWarnings, ExitConfirm, ExitLink, Origin, People } from "@/components/myEvents/parts";
import Notice from "@/components/ui/Notice";
import { useSignedInUser } from "@/context/auth";
import { useEventChange } from "@/hooks/useEventChange";
import { eventTitle } from "@/i18n/eventTitle";
import { useLang, useT } from "@/i18n/lang";
import { formatEventDate } from "@/lib/format";
import type { DatedEvent } from "@/lib/myEvents";

/**
 * A date waiting for your answer, the one thing My events is for: accept it,
 * or decline it, which (after a second "yes") swaps in the next date that
 * works for everyone, found in this browser by the same search.
 */
export default function NeedsAnswerCard({ event }: { event: DatedEvent }) {
  const t = useT();
  const { lang } = useLang();
  const userId = useSignedInUser().id;
  const queryClient = useQueryClient();
  const [asking, setAsking] = useState<"decline" | "exit" | null>(null);
  const accept = useEventChange(() => acceptEvent(event));
  const decline = useEventChange(() => declineEvent(queryClient, userId, event));
  const busy = accept.isPending || decline.isPending;
  const error = (accept.error ?? decline.error)?.message;

  return (
    <li className="rounded-2xl border border-primary/30 bg-card p-4 shadow-sm sm:p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-primary">
        {event.group.name} · {eventTitle(event.title, t)}
      </p>
      <p className="mt-1 text-xl font-bold text-foreground">
        {formatEventDate(event.settings.kind, event.currentDate, lang)}
      </p>
      <Origin event={event} />
      <div className="mt-3">
        <People invitees={event.invitees} />
      </div>
      <EdgeWarnings event={event} className="mt-3" />

      {asking === "decline" ? (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4">
          <p className="text-sm text-rose-900">{t.events.cantMake}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              // The card stays, now with the next date to answer.
              onClick={() => decline.mutate(undefined, { onSuccess: () => setAsking(null) })}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {t.events.declineFind}
            </button>
            <button
              type="button"
              onClick={() => setAsking(null)}
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
              setAsking("decline");
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
      {asking === "exit" ? (
        <ExitConfirm event={event} onCancel={() => setAsking(null)} className="mt-3" />
      ) : (
        <ExitLink event={event} onClick={() => setAsking("exit")} className="mt-3" />
      )}
    </li>
  );
}
