import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Loader2, Pencil, Star } from "lucide-react";

import InfoTip from "@/components/InfoTip";
import InlineTextEdit from "@/components/InlineTextEdit";
import PrimaryCalendarConfirm from "@/components/PrimaryCalendarConfirm";
import { useT } from "@/i18n/lang";
import {
  CATEGORIES,
  groupCalendarsByBrand,
  groupVisibility,
  HOLIDAY_CALENDAR_ID,
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
 * The overview's calendar list, grouped by brand. Each group is collapsed by
 * default and has a checkbox that ticks or unticks all of its calendars;
 * opening it reveals a checkbox, a category picker and a priority
 * picker (how much it matters when scheduling) for each calendar. Unchecking
 * a calendar means it doesn't count: hidden here and left out when finding
 * dates (saved on the server). It then moves out of its group into a folded
 * "not counted" section at the bottom, and ticking it there moves it back.
 * The pencil beside a name renames it; a renamed calendar shows its original
 * name underneath, so it can still be found in Apple, Google or Outlook.
 * The primary calendar (where Casy adds agreed events) is named at the top
 * and badged in its row; any other calendar Casy may write to can be made
 * primary from its row, always after a second "yes".
 * Nothing is disconnected or deleted; that lives on the profile page.
 */
export default function CalendarListPanel({
  calendars,
  hidden,
  blockCounts,
  colorOf,
  savingId,
  saveError,
  onSetVisible,
  onSetPurpose,
  onSetPriority,
  renamingId,
  renameSubmitting,
  renameError,
  onStartRename,
  onCancelRename,
  onRename,
  primaryId,
  askingPrimaryId,
  primaryBusy,
  primaryError,
  onAskPrimary,
  onCancelPrimary,
  onConfirmPrimary,
}: {
  calendars: OverviewCalendar[];
  hidden: ReadonlySet<string>;
  blockCounts: ReadonlyMap<string, number>;
  colorOf: (calendarId: string) => string;
  /** The calendar whose category is being saved right now, if any. */
  savingId: string | null;
  saveError: string | null;
  onSetVisible: (calendarIds: string[], visible: boolean) => void;
  onSetPurpose: (calendarId: string, purpose: CalendarPurpose | null) => void;
  onSetPriority: (calendarId: string, priority: CalendarPriority) => void;
  /** The calendar whose name is being edited, if any. */
  renamingId: string | null;
  renameSubmitting: boolean;
  renameError: string | null;
  onStartRename: (calendarId: string) => void;
  onCancelRename: () => void;
  /** A new name, or null to go back to the provider's own. */
  onRename: (calendarId: string, name: string | null) => void;
  /** The primary calendar's id, if one is chosen. */
  primaryId: string | null;
  /** The calendar whose "make primary" is waiting for a yes, if any. */
  askingPrimaryId: string | null;
  primaryBusy: boolean;
  primaryError: string | null;
  onAskPrimary: (calendarId: string) => void;
  onCancelPrimary: () => void;
  onConfirmPrimary: (calendarId: string) => void;
}) {
  const t = useT();
  const words = t.calendarView;
  const primaryWords = t.primaryCalendar;
  const groups = useMemo(() => groupCalendarsByBrand(calendars), [calendars]);
  // The built-in holiday calendar is named in the page's language.
  const nameOf = (c: OverviewCalendar) => (c.id === HOLIDAY_CALENDAR_ID ? words.holidayCalendar : c.name);
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const [uncountedOpen, setUncountedOpen] = useState(false);
  const primary = primaryId ? calendars.find((c) => c.id === primaryId) : undefined;
  // Only worth a line when a primary calendar exists or could be chosen.
  const showPrimaryLine = !!primary || calendars.some((c) => c.writable);
  // Unticked calendars, in the same brand order as the groups above.
  const uncounted = groups.flatMap((g) =>
    g.calendars.filter((c) => hidden.has(c.id)).map((c) => ({ calendar: c, brandId: g.id, brandLabel: g.label })),
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
        <InfoTip label={words.priorityHelpLabel}>{words.priorityHelp}</InfoTip>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{words.listIntro}</p>
      {showPrimaryLine && (
        <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-foreground">
          <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-500" />
          <span className="truncate">
            {primary ? primaryWords.current(nameOf(primary)) : primaryWords.noneYet}
          </span>
        </p>
      )}

      <ul className="mt-3 divide-y">
        {groups.map((group) => {
          // Only the ticked ones are listed here; unticked ones wait in the
          // section below, and a group with none ticked steps aside entirely.
          const shown = group.calendars.filter((c) => !hidden.has(c.id));
          if (shown.length === 0) return null;
          const isOpen = open.has(group.id);
          // Over the whole group, so a dash says some of it is down below,
          // and clicking it then brings those back.
          const state = groupVisibility(group, hidden);
          const ids = group.calendars.map((c) => c.id);
          // Unknown (a function deployed before totals existed) shows no number, not 0.
          const known = shown.filter((c) => blockCounts.has(c.id));
          const total = known.length > 0 ? known.reduce((sum, c) => sum + blockCounts.get(c.id)!, 0) : null;
          const n = shown.length;
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
                  // All visible -> hide them all; otherwise show them all.
                  onChange={() => onSetVisible(ids, state !== "all")}
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
                      {t.counts.calendars(n)}
                      {total !== null && ` · ${words.total(total)}`}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-0.5">
                    {shown.slice(0, MAX_HEADER_DOTS).map((c) => (
                      <span
                        key={c.id}
                        className={cn("h-2 w-2 rounded-full", hidden.has(c.id) && "opacity-30")}
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

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.ul
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    {shown.map((c) => {
                      const isBuiltIn = c.provider === "builtin";
                      const isHidden = hidden.has(c.id);
                      const saving = savingId === c.id;
                      // Only what the group header doesn't already say.
                      const note = isBuiltIn
                        ? null
                        : [c.renamed && c.originalName ? words.originally(c.originalName) : null, sharedAccount ? null : c.account]
                            .filter(Boolean)
                            .join(" · ");
                      return (
                        <li key={c.id} className="flex flex-col gap-1.5 border-t border-dashed py-2 pl-7">
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={!isHidden}
                              onChange={() => onSetVisible([c.id], isHidden)}
                              aria-label={words.show(nameOf(c))}
                              className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-primary"
                            />
                            <span
                              className={cn("mt-1 h-3 w-3 shrink-0 rounded-full", isHidden && "opacity-30")}
                              style={{ backgroundColor: `rgb(${colorOf(c.id)})` }}
                            />
                            <div className="min-w-0 flex-1">
                              {renamingId === c.id ? (
                                <>
                                  <InlineTextEdit
                                    value={nameOf(c)}
                                    maxLength={MAX_CALENDAR_NAME_LENGTH}
                                    submitting={renameSubmitting}
                                    error={renameError}
                                    onSubmit={(name) => onRename(c.id, name)}
                                    onCancel={onCancelRename}
                                  />
                                  {c.renamed && c.originalName && (
                                    <button
                                      type="button"
                                      disabled={renameSubmitting}
                                      onClick={() => onRename(c.id, null)}
                                      className="mt-1 text-xs font-medium text-muted-foreground underline underline-offset-2 transition hover:text-foreground disabled:opacity-50"
                                    >
                                      {words.useOriginalName(c.originalName)}
                                    </button>
                                  )}
                                </>
                              ) : (
                                <div className="flex min-w-0 items-center gap-1">
                                  <p
                                    className={cn(
                                      "truncate text-sm font-medium text-foreground",
                                      isHidden && "text-muted-foreground line-through",
                                    )}
                                  >
                                    {nameOf(c)}
                                  </p>
                                  {c.id === primaryId && (
                                    <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                                      <Star className="h-2.5 w-2.5 fill-current" />
                                      {primaryWords.badge}
                                    </span>
                                  )}
                                  {/* The holiday calendar has no stored row to rename. */}
                                  {!isBuiltIn && (
                                    <button
                                      type="button"
                                      onClick={() => onStartRename(c.id)}
                                      title={words.rename(nameOf(c))}
                                      aria-label={words.rename(nameOf(c))}
                                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                                    >
                                      <Pencil className="h-3 w-3" />
                                    </button>
                                  )}
                                </div>
                              )}
                              {note && <p className="truncate text-xs text-muted-foreground">{note}</p>}
                            </div>
                            {blockCounts.has(c.id) && (
                              <span className="mt-0.5 shrink-0 text-xs text-muted-foreground">
                                {words.total(blockCounts.get(c.id)!)}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 pl-[2.375rem]">
                            {isBuiltIn ? (
                              // Holidays are always categorised as such; there is nothing to pick.
                              <span
                                className="rounded-full px-2 py-0.5 text-xs"
                                style={{
                                  backgroundColor: `rgba(${colorOf(c.id)}, 0.16)`,
                                  color: `rgb(${colorOf(c.id)})`,
                                }}
                              >
                                {words.holidayCategory}
                              </span>
                            ) : (
                              <select
                                value={c.purpose ?? ""}
                                disabled={saving}
                                onChange={(e) =>
                                  onSetPurpose(c.id, (e.target.value || null) as CalendarPurpose | null)
                                }
                                aria-label={words.categoryFor(nameOf(c))}
                                className="rounded-lg border bg-background px-2 py-1 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
                              >
                                <option value="">{words.noCategory}</option>
                                {CATEGORIES.map((category) => (
                                  <option key={category} value={category}>
                                    {t.categories[category]}
                                  </option>
                                ))}
                              </select>
                            )}
                            {/* Holidays have no priority: a day off blocks nothing. */}
                            {!isBuiltIn && (
                              <select
                                value={c.priority ?? "normal"}
                                disabled={saving}
                                onChange={(e) =>
                                  onSetPriority(c.id, e.target.value as CalendarPriority)
                                }
                                aria-label={words.priorityFor(nameOf(c))}
                                className="rounded-lg border bg-background px-2 py-1 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
                              >
                                {PRIORITIES.map((priority) => (
                                  <option key={priority} value={priority}>
                                    {words.priorities[priority]}
                                  </option>
                                ))}
                              </select>
                            )}
                            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                            {c.writable && c.id !== primaryId && askingPrimaryId !== c.id && (
                              <button
                                type="button"
                                onClick={() => onAskPrimary(c.id)}
                                className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium text-foreground transition hover:bg-secondary"
                              >
                                <Star className="h-3 w-3" />
                                {primaryWords.makePrimary}
                              </button>
                            )}
                          </div>
                          {askingPrimaryId === c.id && (
                            <div className="pl-[2.375rem]">
                              <PrimaryCalendarConfirm
                                message={
                                  primary
                                    ? primaryWords.confirmChange(nameOf(c), nameOf(primary))
                                    : primaryWords.confirmFirst(nameOf(c))
                                }
                                confirmLabel={primary ? primaryWords.yesChange : primaryWords.yesChoose}
                                busy={primaryBusy}
                                error={primaryError}
                                onConfirm={() => onConfirmPrimary(c.id)}
                                onCancel={onCancelPrimary}
                              />
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </motion.ul>
                )}
              </AnimatePresence>
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
          <AnimatePresence initial={false}>
            {uncountedOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <ul>
                  {uncounted.map(({ calendar: c, brandId, brandLabel }) => (
                    <li key={c.id} className="flex items-start gap-3 py-2">
                      <input
                        type="checkbox"
                        checked={false}
                        onChange={() => onSetVisible([c.id], true)}
                        aria-label={words.show(nameOf(c))}
                        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-primary"
                      />
                      <span
                        className="mt-1 h-3 w-3 shrink-0 rounded-full opacity-40"
                        style={{ backgroundColor: `rgb(${colorOf(c.id)})` }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-muted-foreground">{nameOf(c)}</p>
                        <p className="truncate text-xs text-muted-foreground/80">
                          {words.brands[brandId] ?? brandLabel}
                          {c.provider !== "builtin" && c.account ? ` · ${c.account}` : ""}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {saveError && <p className="mt-2 text-xs text-red-700">{saveError}</p>}
    </aside>
  );
}
