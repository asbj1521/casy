import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import {
  primaryCalendarQuery,
  updatePrimaryCalendar,
  type CalendarConnectionStatus,
} from "@/api/calendars";
import ConfirmPanel from "@/components/ui/ConfirmPanel";
import Notice from "@/components/ui/Notice";
import { useSignedInUser } from "@/context/auth";
import { useT } from "@/i18n/lang";
import { primaryName, primaryOptions } from "@/lib/primaryCalendar";
import { cn } from "@/lib/utils";

/**
 * Choosing the primary calendar (where Casy adds agreed events): one list of
 * every calendar Casy may write to, by account, shared by the calendars page
 * (PrimaryCalendarCard) and My calendar's list (CalendarListPanel).
 *
 * Choosing the first calendar is one step. Changing it afterwards (or
 * choosing none) asks first, because events already added stay behind in
 * the old calendar.
 */
export default function PrimaryCalendarPicker({
  connections,
  compact = false,
  label,
  className,
}: {
  /** The calendar status; undefined while it loads. */
  connections: CalendarConnectionStatus[] | undefined;
  /** Small, like My calendar's category and priority pickers. */
  compact?: boolean;
  /** Shown before the list on the same line, such as "Primær kalender:". */
  label?: ReactNode;
  className?: string;
}) {
  const t = useT();
  const words = t.primaryCalendar;
  const user = useSignedInUser();
  const queryClient = useQueryClient();
  const { data: primary, isPending } = useQuery(primaryCalendarQuery(user.id));
  // The choice waiting for a yes: a calendar id, or null for "none".
  const [asking, setAsking] = useState<{ calendarId: string | null } | null>(null);

  const save = useMutation({
    mutationFn: (calendarId: string | null) =>
      updatePrimaryCalendar(queryClient, user.id, { calendarId }),
    onSuccess: () => setAsking(null),
  });

  const list = connections ?? [];
  const primaryId = primary?.calendarId ?? null;
  const groups = primaryOptions(list, primaryId);
  const currentName = primaryName(list, primaryId);
  const nameOf = (id: string) => primaryName(list, id) ?? id;
  const busy = save.isPending;
  const error = save.error?.message ?? null;

  function choose(value: string) {
    const calendarId = value || null;
    if (calendarId === primaryId) return;
    save.reset();
    // A first choice needs no second step; anything that replaces one does.
    if (!primaryId && calendarId) save.mutate(calendarId);
    else setAsking({ calendarId });
  }

  return (
    <div className={className}>
      <div className={cn("flex min-w-0 items-center", compact ? "gap-2" : "flex-wrap gap-3")}>
        {label}
        <select
          value={asking ? (asking.calendarId ?? "") : (primaryId ?? "")}
          disabled={!connections || isPending || busy}
          onChange={(e) => choose(e.target.value)}
          aria-label={words.selectLabel}
          className={cn(
            "min-w-0 max-w-full rounded-lg border bg-background text-foreground outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60",
            compact ? "px-2 py-1 text-xs" : "px-3 py-2 text-sm",
          )}
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
        {busy && !asking && (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
        )}
      </div>

      {asking && (
        <ConfirmPanel
          tone="neutral"
          className="mt-3"
          message={
            asking.calendarId
              ? words.confirmChange(nameOf(asking.calendarId), currentName ?? "")
              : words.confirmClear(currentName ?? "")
          }
          confirmLabel={asking.calendarId ? words.yesChange : words.yesStop}
          busy={busy}
          error={error}
          onConfirm={() => save.mutate(asking.calendarId)}
          onCancel={() => setAsking(null)}
        />
      )}
      {error && !asking && (
        <Notice tone="error" bare className="mt-2">
          {error}
        </Notice>
      )}
    </div>
  );
}
