import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Loader2 } from "lucide-react";

import {
  primaryCalendarQuery,
  updatePrimaryCalendar,
  type CalendarConnectionStatus,
} from "@/api/calendars";
import BottomSheet from "@/components/ui/BottomSheet";
import ConfirmPanel from "@/components/ui/ConfirmPanel";
import { ListGroup, ListPickRow } from "@/components/ui/ListGroup";
import Notice from "@/components/ui/Notice";
import { useSignedInUser } from "@/context/auth";
import { usePhoneLayout } from "@/hooks/usePhoneLayout";
import { useT } from "@/i18n/lang";
import { primaryName, primaryOptions } from "@/lib/primaryCalendar";
import { cn } from "@/lib/utils";

/**
 * Choosing the primary calendar (where Casy adds agreed events): one list of
 * every calendar Casy may write to, by account, shared by the calendars page
 * (PrimaryCalendarCard) and My calendar's list (CalendarListPanel).
 *
 * On a phone (#153) it is a row naming the calendar, which opens a sheet
 * listing them with a tick, as Planlæg's group picker does; a computer keeps
 * its drop-down.
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
  const phone = usePhoneLayout();
  const queryClient = useQueryClient();
  const { data: primary, isPending } = useQuery(primaryCalendarQuery(user.id));
  // The choice waiting for a yes: a calendar id, or null for "none".
  const [asking, setAsking] = useState<{ calendarId: string | null } | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const save = useMutation({
    mutationFn: (calendarId: string | null) =>
      updatePrimaryCalendar(queryClient, user.id, { calendarId }),
    onSuccess: () => {
      setAsking(null);
      setSheetOpen(false);
    },
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

  const confirm = asking && (
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
  );

  if (phone) {
    const chosen = asking ? asking.calendarId : primaryId;
    return (
      <div className={className}>
        <button
          type="button"
          onClick={() => {
            save.reset();
            setAsking(null);
            setSheetOpen(true);
          }}
          disabled={!connections || isPending}
          aria-label={words.selectLabel}
          className="flex w-full min-w-0 items-center gap-2 text-left disabled:opacity-60"
        >
          <span className="min-w-0 flex-1">
            {label ?? (
              <span className="text-[15px] font-medium text-foreground">{words.title}</span>
            )}
          </span>
          <span className="min-w-0 truncate text-[15px] text-muted-foreground">
            {currentName ?? words.choose}
          </span>
          {busy ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />
          )}
        </button>
        {error && !sheetOpen && (
          <Notice tone="error" bare className="mt-2">
            {error}
          </Notice>
        )}
        <BottomSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          title={words.title}
          doneLabel={t.common.done}
          busy={busy}
        >
          {groups.map((group, i) => (
            <ListGroup key={group.account} title={group.account} className={i === 0 ? "mt-0" : ""}>
              {group.calendars.map((c) => (
                <ListPickRow
                  key={c.id}
                  type="radio"
                  name="primary-calendar"
                  checked={chosen === c.id}
                  onChange={() => choose(c.id)}
                  label={c.name}
                />
              ))}
            </ListGroup>
          ))}
          {/* Choosing none only means something once one is chosen. */}
          {primaryId && (
            <ListGroup>
              <ListPickRow
                type="radio"
                name="primary-calendar"
                checked={asking?.calendarId === null}
                onChange={() => choose("")}
                label={words.noneOption}
              />
            </ListGroup>
          )}
          {confirm}
          {error && !asking && (
            <Notice tone="error" bare className="mt-2">
              {error}
            </Notice>
          )}
        </BottomSheet>
      </div>
    );
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

      {confirm}
      {error && !asking && (
        <Notice tone="error" bare className="mt-2">
          {error}
        </Notice>
      )}
    </div>
  );
}
