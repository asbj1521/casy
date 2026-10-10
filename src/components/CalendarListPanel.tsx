import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Loader2, Pencil, Star } from "lucide-react";

import {
  calendarsChanged,
  primaryCalendarQuery,
  updateCalendar,
  updatePrimaryCalendar,
  type CalendarChange,
} from "@/api/calendars";
import { useIsDark } from "@/hooks/useIsDark";
import { shade } from "@/lib/tint";
import InfoTip from "@/components/InfoTip";
import InlineTextEdit from "@/components/InlineTextEdit";
import Collapse from "@/components/ui/Collapse";
import ConfirmPanel from "@/components/ui/ConfirmPanel";
import Notice from "@/components/ui/Notice";
import { useSignedInUser } from "@/context/auth";
import { useT } from "@/i18n/lang";
import {
  CATEGORIES,
  groupCalendarsByBrand,
  groupVisibility,
  type OverviewCalendar,
} from "@/lib/calendarOverview";
import { cn } from "@/lib/utils";
import type { CalendarPriority, CalendarPurpose } from "@/types";

const PRIORITIES: CalendarPriority[] = ["skip", "normal", "never"];

/** Matches the check on calendar_sources.custom_name. */
const MAX_CALENDAR_NAME_LENGTH = 60;

/** Most colour dots shown on a collapsed group's header before they stop helping. */
const MAX_HEADER_DOTS = 6;

/**
 * The overview's calendar list, grouped by brand. Each group is collapsed by
 * default and has a checkbox that ticks or unticks all of its calendars;
 * opening it reveals a checkbox, a category picker and a priority picker (how
 * much it matters when scheduling) for each calendar. Unticking a calendar
 * means it doesn't count: hidden here and left out when finding dates (saved
 * on the server). It then moves out of its group into a folded "not counted"
 * section at the bottom, and ticking it there moves it back.
 *
 * The primary calendar (where Casy adds agreed events) is named at the top
 * and badged in its row. Nothing is disconnected or deleted here; that lives
 * on the profile page.
 */
export default function CalendarListPanel({
  calendars,
  colorOf,
  onSetVisible,
  visibilityError,
  introInTip = false,
}: {
  /** Every calendar, the built-in holidays included, each with its tick and total. */
  calendars: OverviewCalendar[];
  colorOf: (calendarId: string) => string;
  /** Tick or untick calendars: one, or a whole brand group. */
  onSetVisible: (calendarIds: string[], visible: boolean) => void;
  /** Why the last tick didn't save, if it didn't. */
  visibilityError: string | null;
  /** The sentence under the title goes into the (i) beside it instead (a phone's sheet). */
  introInTip?: boolean;
}) {
  const t = useT();
  const words = t.calendarView;
  const user = useSignedInUser();
  const groups = useMemo(() => groupCalendarsByBrand(calendars), [calendars]);
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const [uncountedOpen, setUncountedOpen] = useState(false);

  const { data: primarySetting } = useQuery(primaryCalendarQuery(user.id));
  const primary = calendars.find((c) => c.id === primarySetting?.calendarId);
  // Only worth a line when a primary calendar exists or could be chosen.
  const showPrimaryLine = !!primary || calendars.some((c) => c.writable);
  // Unticked calendars, in the same brand order as the groups above.
  const uncounted = groups.flatMap((g) =>
    g.calendars.filter((c) => !c.included).map((calendar) => ({ calendar, brand: g })),
  );

  const toggleOpen = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <aside className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex items-center gap-1.5">
        <h2 className="font-semibold text-foreground">{words.listTitle}</h2>
        <InfoTip label={words.priorityHelpLabel}>
          {introInTip && <p className="mb-2">{words.listIntro}</p>}
          {words.priorityHelp}
        </InfoTip>
      </div>
      {!introInTip && <p className="mt-1 text-xs text-muted-foreground">{words.listIntro}</p>}
      {showPrimaryLine && (
        <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-foreground">
          <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-500" />
          <span className="truncate">
            {primary ? t.primaryCalendar.current(primary.name) : t.primaryCalendar.noneYet}
          </span>
        </p>
      )}

      <ul className="mt-3 divide-y">
        {groups.map((group) => {
          // Only the ticked ones are listed here; unticked ones wait in the
          // section below, and a group with none ticked steps aside entirely.
          const shown = group.calendars.filter((c) => c.included);
          if (shown.length === 0) return null;
          const isOpen = open.has(group.id);
          // Over the whole group, so a dash says some of it is down below,
          // and clicking it then brings those back.
          const state = groupVisibility(group);
          const brand = words.brands[group.id] ?? group.label;
          // One account behind the whole group (an iCloud login, say): named
          // once beside the brand instead of under every calendar.
          const accounts = new Set(group.calendars.map((c) => c.account));
          const sharedAccount = accounts.size === 1 ? [...accounts][0] : null;
          const headerNote = group.id === "builtin" ? words.builtInNoAccount : sharedAccount;

          return (
            <li key={group.id}>
              <div className="flex items-center gap-3 py-3">
                <GroupCheckbox
                  state={state}
                  label={words.showAll(brand)}
                  // All ticked -> untick them all; otherwise tick them all.
                  onChange={() =>
                    onSetVisible(
                      group.calendars.map((c) => c.id),
                      state !== "all",
                    )
                  }
                />
                <button
                  type="button"
                  onClick={() => toggleOpen(group.id)}
                  aria-expanded={isOpen}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-foreground">
                      <span className="font-medium">{brand}</span>
                      {headerNote && (
                        <span className="text-xs text-muted-foreground"> · {headerNote}</span>
                      )}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {t.counts.calendars(shown.length)} ·{" "}
                      {words.total(shown.reduce((sum, c) => sum + c.total, 0))}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-0.5">
                    {shown.slice(0, MAX_HEADER_DOTS).map((c) => (
                      <span
                        key={c.id}
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: `rgb(${colorOf(c.id)})` }}
                      />
                    ))}
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                      isOpen && "rotate-180",
                    )}
                  />
                </button>
              </div>

              <Collapse open={isOpen}>
                <ul>
                  {shown.map((c) => (
                    <CalendarRow
                      key={c.id}
                      calendar={c}
                      color={colorOf(c.id)}
                      showAccount={!sharedAccount}
                      primary={primary}
                      onUntick={() => onSetVisible([c.id], false)}
                    />
                  ))}
                </ul>
              </Collapse>
            </li>
          );
        })}
      </ul>

      {uncounted.length > 0 && (
        <div className="mt-1 border-t pt-1">
          <button
            type="button"
            onClick={() => setUncountedOpen((o) => !o)}
            aria-expanded={uncountedOpen}
            className="flex w-full items-center gap-2 py-2 text-left text-sm font-medium text-muted-foreground transition hover:text-foreground"
          >
            <span className="flex-1">{words.notCounted(uncounted.length)}</span>
            <ChevronDown
              className={cn("h-4 w-4 shrink-0 transition-transform", uncountedOpen && "rotate-180")}
            />
          </button>
          <Collapse open={uncountedOpen}>
            <ul>
              {uncounted.map(({ calendar: c, brand }) => (
                <li key={c.id} className="flex items-start gap-3 py-2">
                  <input
                    type="checkbox"
                    checked={false}
                    onChange={() => onSetVisible([c.id], true)}
                    aria-label={words.show(c.name)}
                    className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-primary"
                  />
                  <span
                    className="mt-1 h-3 w-3 shrink-0 rounded-full opacity-40"
                    style={{ backgroundColor: `rgb(${colorOf(c.id)})` }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-muted-foreground">{c.name}</p>
                    <p className="truncate text-xs text-muted-foreground/80">
                      {words.brands[brand.id] ?? brand.label}
                      {c.account ? ` · ${c.account}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </Collapse>
        </div>
      )}

      {visibilityError && (
        <Notice tone="error" bare className="mt-2 text-xs">
          {visibilityError}
        </Notice>
      )}
    </aside>
  );
}

/**
 * A checkbox that can show "some but not all". The browser only exposes the
 * dash through a DOM property, not an attribute, so it is set in an effect.
 */
function GroupCheckbox({
  state,
  label,
  onChange,
}: {
  state: "all" | "none" | "some";
  label: string;
  onChange: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = state === "some";
  }, [state]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={state === "all"}
      onChange={onChange}
      aria-label={label}
      className="h-4 w-4 shrink-0 cursor-pointer accent-primary"
    />
  );
}

/**
 * One ticked calendar: its name (the pencil renames it; a renamed calendar
 * shows its original name underneath, so it can still be found in Apple,
 * Google or Outlook), its category and priority, and, for a calendar Casy may
 * write to, "make primary" after a second "yes". Each saves on its own.
 */
function CalendarRow({
  calendar: c,
  color,
  showAccount,
  primary,
  onUntick,
}: {
  calendar: OverviewCalendar;
  /** "r, g, b". */
  color: string;
  /** False when the group header already names the one account behind it. */
  showAccount: boolean;
  primary: OverviewCalendar | undefined;
  onUntick: () => void;
}) {
  const dark = useIsDark();
  const t = useT();
  const words = t.calendarView;
  const user = useSignedInUser();
  const queryClient = useQueryClient();
  const [renaming, setRenaming] = useState(false);
  const [askingPrimary, setAskingPrimary] = useState(false);

  const labels = useMutation({
    mutationFn: (change: CalendarChange) => updateCalendar(c.id, change),
    onSuccess: () => calendarsChanged(queryClient),
  });
  // The editor stays open until the new name is saved, so a failure shows beside it.
  const rename = useMutation({
    mutationFn: (name: string | null) => updateCalendar(c.id, { name }),
    onSuccess: async () => {
      await calendarsChanged(queryClient);
      setRenaming(false);
    },
  });
  const makePrimary = useMutation({
    mutationFn: () => updatePrimaryCalendar(queryClient, user.id, { calendarId: c.id }),
    onSuccess: () => setAskingPrimary(false),
  });

  const isBuiltIn = c.provider === "builtin";
  const isPrimary = c.id === primary?.id;
  const original = c.renamed ? c.originalName : null;
  // Only what the group header doesn't already say.
  const note = [original && words.originally(original), showAccount && c.account]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className="flex flex-col gap-1.5 border-t border-dashed py-2 pl-7">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked
          onChange={onUntick}
          aria-label={words.show(c.name)}
          className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-primary"
        />
        <span
          className="mt-1 h-3 w-3 shrink-0 rounded-full"
          style={{ backgroundColor: `rgb(${color})` }}
        />
        <div className="min-w-0 flex-1">
          {renaming ? (
            <>
              <InlineTextEdit
                value={c.name}
                maxLength={MAX_CALENDAR_NAME_LENGTH}
                submitting={rename.isPending}
                error={rename.error?.message ?? null}
                onSubmit={(name) => rename.mutate(name)}
                onCancel={() => setRenaming(false)}
              />
              {original && (
                <button
                  type="button"
                  disabled={rename.isPending}
                  onClick={() => rename.mutate(null)}
                  className="mt-1 text-xs font-medium text-muted-foreground underline underline-offset-2 transition hover:text-foreground disabled:opacity-50"
                >
                  {words.useOriginalName(original)}
                </button>
              )}
            </>
          ) : (
            <div className="flex min-w-0 items-center gap-1">
              <p className="truncate text-sm font-medium text-foreground">{c.name}</p>
              {isPrimary && (
                <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                  <Star className="h-2.5 w-2.5 fill-current" />
                  {t.primaryCalendar.badge}
                </span>
              )}
              {/* The holiday calendar has no stored row to rename. */}
              {!isBuiltIn && (
                <button
                  type="button"
                  onClick={() => {
                    rename.reset();
                    setRenaming(true);
                  }}
                  title={words.rename(c.name)}
                  aria-label={words.rename(c.name)}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              )}
            </div>
          )}
          {note && <p className="truncate text-xs text-muted-foreground">{note}</p>}
        </div>
        <span className="mt-0.5 shrink-0 text-xs text-muted-foreground">
          {words.total(c.total)}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 pl-[2.375rem]">
        {isBuiltIn ? (
          // Holidays are always categorised as such and have no priority: a
          // day off blocks nothing, so there is nothing to pick.
          <span
            className="rounded-full px-2 py-0.5 text-xs"
            style={{
              backgroundColor: `rgba(${color}, 0.16)`,
              color: `rgb(${dark ? shade(color, true) : color})`,
            }}
          >
            {words.holidayCategory}
          </span>
        ) : (
          <>
            <select
              value={c.purpose ?? ""}
              disabled={labels.isPending}
              onChange={(e) =>
                labels.mutate({ purpose: (e.target.value || null) as CalendarPurpose | null })
              }
              aria-label={words.categoryFor(c.name)}
              className="rounded-lg border bg-background px-2 py-1 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
            >
              <option value="">{words.noCategory}</option>
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {t.categories[category]}
                </option>
              ))}
            </select>
            {/* Casy's AI picked it (#118): marked until its owner picks one. */}
            {c.purposeGuessed && (
              <span
                title={words.guessedCategory}
                className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[11px] font-bold text-amber-800"
              >
                {t.aiPlan.guessed}
              </span>
            )}
            <select
              value={c.priority}
              disabled={labels.isPending}
              onChange={(e) => labels.mutate({ priority: e.target.value as CalendarPriority })}
              aria-label={words.priorityFor(c.name)}
              className="rounded-lg border bg-background px-2 py-1 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
            >
              {PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {words.priorities[priority]}
                </option>
              ))}
            </select>
          </>
        )}
        {labels.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        {c.writable && !isPrimary && !askingPrimary && (
          <button
            type="button"
            onClick={() => {
              makePrimary.reset();
              setAskingPrimary(true);
            }}
            className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium text-foreground transition hover:bg-secondary"
          >
            <Star className="h-3 w-3" />
            {t.primaryCalendar.makePrimary}
          </button>
        )}
      </div>
      {labels.isError && (
        <Notice tone="error" bare className="pl-[2.375rem] text-xs">
          {labels.error.message}
        </Notice>
      )}

      {askingPrimary && (
        <div className="pl-[2.375rem]">
          <ConfirmPanel
            tone="neutral"
            className="mt-3"
            message={
              primary
                ? t.primaryCalendar.confirmChange(c.name, primary.name)
                : t.primaryCalendar.confirmFirst(c.name)
            }
            confirmLabel={primary ? t.primaryCalendar.yesChange : t.primaryCalendar.yesChoose}
            busy={makePrimary.isPending}
            error={makePrimary.error?.message}
            onConfirm={() => makePrimary.mutate()}
            onCancel={() => setAskingPrimary(false)}
          />
        </div>
      )}
    </li>
  );
}
