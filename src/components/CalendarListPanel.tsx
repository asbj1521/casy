import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Loader2 } from "lucide-react";

import InfoTip from "@/components/InfoTip";
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
}) {
  const t = useT();
  const words = t.calendarView;
  const groups = useMemo(() => groupCalendarsByBrand(calendars), [calendars]);
  // The built-in holiday calendar is named in the page's language.
  const nameOf = (c: OverviewCalendar) => (c.id === HOLIDAY_CALENDAR_ID ? words.holidayCalendar : c.name);
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const [uncountedOpen, setUncountedOpen] = useState(false);
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
          const inView = shown.reduce((sum, c) => sum + (blockCounts.get(c.id) ?? 0), 0);
          const n = shown.length;
          const brand = words.brands[group.id] ?? group.label;

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
                    <span className="block truncate text-sm font-medium text-foreground">
                      {brand}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {t.counts.calendars(n)} · {words.inView(inView)}
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
                      return (
                        <li key={c.id} className="flex flex-col gap-2 border-t border-dashed py-3 pl-7">
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
                              <p
                                className={cn(
                                  "truncate text-sm font-medium text-foreground",
                                  isHidden && "text-muted-foreground line-through",
                                )}
                              >
                                {nameOf(c)}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">
                                {isBuiltIn ? words.builtInNoAccount : (c.account ?? "")}
                              </p>
                            </div>
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
                            <span className="text-xs text-muted-foreground">
                              {words.inView(blockCounts.get(c.id) ?? 0)}
                            </span>
                          </div>
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
