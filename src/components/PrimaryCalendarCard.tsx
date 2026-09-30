import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Star } from "lucide-react";

import type { CalendarConnectionStatus } from "@/api/calendarStatus";
import { primaryCalendarQuery, updatePrimaryCalendar } from "@/api/primaryCalendar";
import PrimaryCalendarConfirm from "@/components/PrimaryCalendarConfirm";
import { useSignedInUser } from "@/context/auth";
import { useT } from "@/i18n/lang";
import { primaryName, primaryOptions } from "@/lib/primaryCalendar";
import { cn } from "@/lib/utils";

/**
 * The profile page's primary calendar setting: which calendar Casy adds
 * agreed events to, and whether it does so automatically.
 *
 * Choosing the first calendar is one step. Changing it afterwards (or
 * choosing none) asks first, the same way My calendar does, because events
 * already added stay behind in the old calendar.
 */
export default function PrimaryCalendarCard({
  connections,
}: {
  /** The profile page's calendar status; undefined while it loads. */
  connections: CalendarConnectionStatus[] | undefined;
}) {
  const t = useT();
  const words = t.primaryCalendar;
  const user = useSignedInUser();
  const queryClient = useQueryClient();
  const { data: primary, isPending } = useQuery(primaryCalendarQuery(user.id));
  // The choice waiting for a yes: a calendar id, or null for "none".
  const [asking, setAsking] = useState<{ calendarId: string | null } | null>(null);

  const save = useMutation({
    mutationFn: (change: { calendarId: string | null } | { autoAdd: boolean }) =>
      updatePrimaryCalendar(queryClient, user.id, change),
    onSuccess: () => setAsking(null),
  });

  const list = connections ?? [];
  const primaryId = primary?.calendarId ?? null;
  const groups = primaryOptions(list, primaryId);
  const currentName = primaryName(list, primaryId);
  const nameOf = (id: string) => primaryName(list, id) ?? id;
  const hasApple = list.some((c) => c.provider === "apple" && c.status === "connected");
  const busy = save.isPending;
  const error = save.error?.message ?? null;

  function choose(value: string) {
    const calendarId = value || null;
    if (calendarId === primaryId) return;
    save.reset();
    // A first choice needs no second step; anything that replaces one does.
    if (!primaryId && calendarId) save.mutate({ calendarId });
    else setAsking({ calendarId });
  }

  return (
    <div className="mt-4 rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
      <div className="flex items-center gap-2">
        <Star className="h-4 w-4 text-amber-500" />
        <h3 className="font-semibold text-foreground">{words.title}</h3>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{words.intro}</p>

      {connections && groups.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          {hasApple ? words.waitingForSync : words.noWritable}
        </p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <select
              value={asking ? (asking.calendarId ?? "") : (primaryId ?? "")}
              disabled={!connections || isPending || busy}
              onChange={(e) => choose(e.target.value)}
              aria-label={words.selectLabel}
              className="max-w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
            >
              <option value="">{primaryId || asking ? words.noneOption : words.choose}</option>
              {groups.map((group) => (
                <optgroup key={group.account} label={group.account}>
                  {group.calendars.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {busy && !asking && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>

          {asking && (
            <PrimaryCalendarConfirm
              message={
                asking.calendarId
                  ? words.confirmChange(nameOf(asking.calendarId), currentName ?? "")
                  : words.confirmClear(currentName ?? "")
              }
              confirmLabel={asking.calendarId ? words.yesChange : words.yesStop}
              busy={busy}
              error={error}
              onConfirm={() => save.mutate({ calendarId: asking.calendarId })}
              onCancel={() => setAsking(null)}
            />
          )}

          <div className="mt-4 flex items-start gap-3 border-t pt-4">
            <button
              type="button"
              role="switch"
              aria-checked={!!primary?.autoAdd}
              aria-label={words.autoAdd}
              disabled={!primary || busy}
              onClick={() => {
                save.reset();
                save.mutate({ autoAdd: !primary?.autoAdd });
              }}
              className={cn(
                "relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full transition disabled:opacity-50",
                primary?.autoAdd ? "bg-primary" : "bg-zinc-300",
              )}
            >
              <span
                className={cn(
                  "inline-block h-4 w-4 rounded-full bg-white shadow transition-transform",
                  primary?.autoAdd ? "translate-x-[1.125rem]" : "translate-x-0.5",
                )}
              />
            </button>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{words.autoAdd}</p>
              <p className="text-xs text-muted-foreground">
                {primary ? words.autoAddHelp : words.autoAddNeedsPrimary}
              </p>
            </div>
          </div>

          {error && !asking && <p className="mt-3 text-sm text-red-700">{error}</p>}
        </>
      )}
    </div>
  );
}
