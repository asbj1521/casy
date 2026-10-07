import { Lightbulb } from "lucide-react";

import FadeSwap from "@/components/FadeSwap";
import Bone from "@/components/ui/Bone";
import { useLang, useT } from "@/i18n/lang";
import type { VacationSuggestion } from "@/lib/availability";
import type { EventSettings } from "@/lib/eventSearch";
import { formatDaySpan, formatLongDate, formatLongSpan, nameList } from "@/lib/format";
import type { FoundDate } from "@/lib/scheduler";

/**
 * Under the chart: the workarounds for a holiday that doesn't fit cleanly
 * ("6 days works if you leave after work"), or else the next few dates found
 * by the same search. While the group loads, the later dates' three places
 * are held with placeholders.
 */
export default function LaterDates({
  loading,
  fadeKey,
  search,
  needsTimeOff,
  suggestions,
  later,
  groupSize,
  onUseSuggestion,
  onPick,
}: {
  loading: boolean;
  /** What the dates fade on: a different group's numbers. */
  fadeKey: string;
  search: EventSettings;
  /** The holiday asked for has a date, only not without time off (else none at all). */
  needsTimeOff: boolean;
  suggestions: VacationSuggestion[];
  later: FoundDate[];
  /** How many people the search covers, for "3 af 4 kan". */
  groupSize: number;
  onUseSuggestion: (suggestion: VacationSuggestion) => void;
  /** A later date picked: its start. */
  onPick: (start: string) => void;
}) {
  const t = useT();
  const { lang } = useLang();

  if (loading) {
    return (
      <div aria-hidden="true" className="grid gap-2 sm:grid-cols-3 sm:gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-2xl border bg-card px-4 py-3 sm:px-5 sm:py-4">
            <div className="flex items-center justify-between gap-3 sm:block">
              <span className="hidden text-xs text-muted-foreground sm:block">
                {t.scheduler.alsoPossible}
              </span>
              <span className="block min-w-0 text-[15px] font-bold sm:mt-0.5 sm:text-lg">
                <Bone chars={16} />
              </span>
              <span className="block shrink-0 text-sm sm:mt-0.5">
                <Bone chars={7} />
              </span>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Only a holiday has workarounds.
  if (suggestions.length > 0 && search.kind === "vacation") {
    return (
      <div className="flex flex-col gap-2">
        {suggestions.map((s) => {
          const span = formatDaySpan(s.slot.start, s.slot.end, lang);
          return (
            <div
              key={`${s.days}-${s.slot.start}`}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4"
            >
              <div className="flex items-center gap-2.5 text-sm text-foreground">
                <Lightbulb className="h-4 w-4 shrink-0 text-primary" />
                <span>
                  {s.conflicts.length === 0
                    ? t.scheduler.suggestionFits(
                        search.days,
                        needsTimeOff,
                        s.days,
                        span,
                        (s.leaveAfterWork ? t.scheduler.leaveAfterWork : "") +
                          (s.homeBeforeWork ? t.scheduler.homeBeforeWork : ""),
                      )
                    : t.scheduler.closestWorkaround(
                        s.days,
                        span,
                        nameList(
                          s.conflicts.map((c) => c.name),
                          lang,
                        ),
                        s.conflicts.length,
                      )}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onUseSuggestion(s)}
                className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
              >
                {t.scheduler.useTheseDates}
              </button>
            </div>
          );
        })}
      </div>
    );
  }

  if (later.length === 0) return null;
  return (
    // One compact line per date on a phone, three cards side by side on
    // anything wider.
    <div className="grid gap-2 sm:grid-cols-3 sm:gap-3">
      {later.map(({ slot, conflicts, absent = [] }, i) => (
        // Keyed by place, not date, so the cards stay and only their dates
        // fade when the group changes.
        <button
          key={i}
          type="button"
          onClick={() => onPick(slot.start)}
          className="rounded-2xl border bg-card px-4 py-3 text-left transition hover:border-primary/40 hover:bg-secondary/40 sm:px-5 sm:py-4"
        >
          <FadeSwap swapKey={fadeKey} className="flex items-center justify-between gap-3 sm:block">
            <span className="hidden text-xs text-muted-foreground sm:block">
              {t.scheduler.alsoPossible}
            </span>
            <span className="block min-w-0 truncate text-[15px] font-bold text-foreground sm:mt-0.5 sm:text-lg">
              {search.kind === "single"
                ? formatLongDate(slot.start, lang)
                : formatLongSpan(slot.start, slot.end, lang)}
            </span>
            <span className="block shrink-0 text-sm text-muted-foreground sm:mt-0.5">
              {t.scheduler.countCan(groupSize - conflicts.length - absent.length, groupSize)}
            </span>
          </FadeSwap>
        </button>
      ))}
    </div>
  );
}
