import type { ReactNode } from "react";
import { AlertTriangle, CalendarOff, Check, Hourglass, Loader2, UserX } from "lucide-react";

import EdgeWarningList from "@/components/EdgeWarningList";
import FadeSwap from "@/components/FadeSwap";
import YourTime from "@/components/time/YourTime";
import Bone from "@/components/ui/Bone";
import { TODAY } from "@/hooks/useDateSearch";
import { useLang, useT } from "@/i18n/lang";
import type { SpanConflict } from "@/lib/availability";
import type { EdgeWarning } from "@/lib/earlyMorning";
import type { EventSettings } from "@/lib/eventSearch";
import { formatHeadline, nameList } from "@/lib/format";
import { daysUntil, type AnswerReview } from "@/lib/scheduler";
import { cn } from "@/lib/utils";
import { APP_TIME_ZONE, dayOf } from "@/lib/zone";
import type { TimeSlot } from "@/types";

/**
 * The scheduling page's answer, big: the first date that works, its times
 * and how far away it is, what it costs whom, and what to do with it. While
 * the group's calendars load, the same layout is drawn with placeholders, so
 * nothing jumps when they land; when there is nothing to search at all, it
 * says why in plain words rather than as the red "no date works".
 */
export default function AnswerCard({
  fadeKey,
  waiting,
  review,
  search,
  slot,
  name,
  checkers,
  edge,
  actions,
  hint,
  className,
}: {
  /** What the content fades on: a different group's answer. */
  fadeKey: string;
  /** Why there is no answer yet, if there isn't; `loading` while calendars arrive. */
  waiting: { text: string; loading: boolean } | null;
  review: AnswerReview;
  search: EventSettings;
  slot: TimeSlot | null;
  /** The event's name as typed, for "Alle kan til ...". */
  name: string;
  /**
   * Members with no calendar, who check the date themselves (#82), and
   * whether that is everyone: the headline then promises less, and a note
   * names them.
   */
  checkers: { names: string[]; everyone: boolean } | null;
  edge: EdgeWarning[];
  /** AnswerActions, or nothing when there is nothing to step through. */
  actions: ReactNode;
  /** The line under the actions: what sending does, or how it went. */
  hint: ReactNode;
  className?: string;
}) {
  const t = useT();
  const { lang } = useLang();
  const tone = waiting ? "waiting" : review.tone;
  const { yours, others, accepted } = review;
  const names = (conflicts: SpanConflict[]) =>
    nameList(
      conflicts.map((c) => c.name),
      lang,
    );
  // A trip or holiday's two dates go on a line each, "Fredag 7. maj til" over
  // "mandag 10. maj", so the break never falls somewhere random in a date.
  const answer = slot && formatHeadline(search, slot, lang, t);

  return (
    <section
      className={cn(
        // Beside the settings on a wide screen (#98): a column as tall as
        // they are, the date at the top and the buttons at the bottom.
        "rounded-3xl border p-3 shadow-xl shadow-black/5 transition-colors duration-300 sm:p-8 xl:flex xl:flex-col xl:p-7",
        tone === "none" && "border-rose-200 bg-rose-50",
        (tone === "approve" || tone === "skip") && "border-amber-300 bg-amber-50",
        tone === "review" && "border-sky-200 bg-sky-50",
        (tone === "clean" || tone === "waiting") && "bg-card",
        className,
      )}
    >
      {/* The box stays; what it says fades to the next group's answer. */}
      <FadeSwap swapKey={fadeKey} className="xl:flex xl:flex-1 xl:flex-col">
        {waiting?.loading ? (
          <Placeholder text={waiting.text} />
        ) : waiting ? (
          <p className="text-base text-muted-foreground">{waiting.text}</p>
        ) : !answer ? (
          <>
            <p className="text-base text-rose-800">
              {search.kind === "vacation"
                ? t.scheduler.noVacation(search.days)
                : search.kind === "trip"
                  ? t.scheduler.noTrip
                  : search.anyTime
                    ? t.scheduler.noSingleAnyTime(t.common.duration(search.durationMinutes))
                    : t.scheduler.noSingle(`${String(search.startHour).padStart(2, "0")}:00`)}
            </p>
            {/* Stepped past the last date: the way back stays. */}
            {actions && <div className="mt-4 hidden items-center gap-2 sm:flex">{actions}</div>}
          </>
        ) : (
          <div className="xl:flex xl:flex-1 xl:flex-col">
            {/* The date on the left, what to do on the right. The buttons keep
                their width (shrink-0) and the date wraps to make room: a
                trip's "Fredag 12. februar til mandag 15. februar" takes two
                lines rather than pushing the buttons out of the card. The
                caption under them wraps to the buttons' width (w-0
                min-w-full) instead of widening the column. In the wide
                screen's column this wrapper steps aside (contents) and the
                date, the warnings and the buttons stack in that order. */}
            <div className="flex flex-col gap-3 sm:gap-6 lg:flex-row lg:items-center lg:justify-between xl:contents">
              <div className="min-w-0 xl:order-1">
                <p
                  className={cn(
                    "flex items-center gap-2 text-xs font-bold uppercase tracking-wider sm:text-sm",
                    tone === "clean" && "text-orange-700",
                    (tone === "approve" || tone === "skip") && "text-amber-800",
                    tone === "review" && "text-sky-800",
                  )}
                >
                  {tone === "approve" ? (
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                  ) : tone === "review" ? (
                    <Hourglass className="h-4 w-4 shrink-0" />
                  ) : (
                    <Check className="h-4 w-4 shrink-0" />
                  )}
                  <span className="truncate">
                    {tone === "approve"
                      ? t.scheduler.needsApproval
                      : tone === "review"
                        ? t.scheduler.underReview
                        : tone === "skip"
                          ? t.scheduler.worksIfSkipping
                          : search.people?.atLeast !== undefined
                            ? // Enough people was all it needed (#89).
                              t.scheduler.kickerEnough(name.trim(), search.people.atLeast)
                            : t.scheduler.kickerAll(
                                name.trim(),
                                !checkers ? "all" : checkers.everyone ? "nobody" : "withCalendar",
                              )}
                  </span>
                </p>
                <h1 className="mt-1.5 text-[1.75rem] font-extrabold leading-[1.05] tracking-tight text-foreground sm:text-5xl lg:text-6xl xl:text-5xl">
                  {answer.lines.map((line) => (
                    <span key={line} className="block">
                      {line}
                    </span>
                  ))}
                </h1>
                <p className="mt-1.5 text-base text-muted-foreground sm:text-xl">
                  {answer.time} ·{" "}
                  {t.scheduler.inDays(daysUntil(dayOf(slot.start, APP_TIME_ZONE), TODAY))}
                </p>
                <YourTime kind={search.kind} date={slot} className="mt-0.5" />
              </div>

              <div className="flex flex-col gap-3 lg:shrink-0 lg:items-end xl:order-3 xl:mt-auto xl:items-start xl:pt-5">
                {/* On a phone these live in the bar pinned to the bottom of the
                    screen instead, so the card stays short and the chart under
                    it is on the first screen. */}
                <div className="hidden items-center gap-2 sm:flex">{actions}</div>
                <p className="text-xs text-muted-foreground sm:text-sm lg:w-0 lg:min-w-full lg:text-right xl:w-auto xl:min-w-0 xl:text-left">
                  {hint}
                </p>
              </div>
            </div>

            {/* Warnings, in a strip across the whole card, side by side. There
                is always room for one line of them (a 12px gap and a line:
                min-h-8), and two usually fit on it on a wide screen, so they
                appear in space the card already has instead of stretching it
                and pushing the page down as the settings change. More than
                fit wrap to a new line. Not on a phone, where they wrap to
                several lines anyway and the card is kept short. Flex, so the
                warnings' top margins stay inside the slot instead of
                collapsing out above it. */}
            <div className="flex flex-col sm:min-h-8 sm:flex-row sm:flex-wrap sm:gap-x-8 xl:order-2">
              {tone === "approve" && (
                <p className="mt-3 text-sm text-amber-900">
                  {yours && t.scheduler.selfConflict(titles(yours, t.scheduler.aCommitment))}
                  {others.length > 0 && t.scheduler.othersNeedTimeOff(names(others))}
                </p>
              )}
              {tone === "review" && (
                <p className="mt-3 text-sm text-sky-900">
                  {t.scheduler.othersMustApprove(names(others), others.length)}
                  {accepted && t.scheduler.youApprovedTimeOff}
                </p>
              )}
              {tone === "skip" && (
                <p className="mt-3 text-sm text-amber-900">
                  {yours && t.scheduler.youSkip(titles(yours, t.scheduler.aCommitment))}
                  {others.length > 0 && t.scheduler.othersSkip(names(others))}
                  {t.scheduler.skipWhy}
                </p>
              )}
              {review.absent.length > 0 && (
                <p className="mt-3 flex items-start gap-1.5 text-sm text-muted-foreground">
                  <UserX className="mt-0.5 h-4 w-4 shrink-0" />
                  {t.scheduler.absent(
                    nameList(
                      review.absent.map((a) => a.name),
                      lang,
                    ),
                  )}
                </p>
              )}
              <EdgeWarningList warnings={edge} className="mt-3" />
              {checkers && (
                <p className="mt-3 flex items-start gap-1.5 text-sm text-muted-foreground">
                  <CalendarOff className="mt-0.5 h-4 w-4 shrink-0" />
                  {checkers.everyone
                    ? t.scheduler.nobodyHasCalendar
                    : t.scheduler.checkThemselves(nameList(checkers.names, lang))}
                </p>
              )}
              {tone === "clean" && accepted && (
                <p className="mt-3 text-sm text-muted-foreground">{t.scheduler.youApprovedDates}</p>
              )}
            </div>
          </div>
        )}
      </FadeSwap>
    </section>
  );
}

/**
 * Up to three different things someone would give up, by the name of the
 * calendar they're in ("Arbejde" in an example, "Work" with real data).
 */
function titles(conflict: SpanConflict, fallback: string): string {
  return [...new Set(conflict.events.map((e) => e.title ?? fallback))].slice(0, 3).join(", ");
}

/** The answer's own layout, blank until the calendars are in. */
function Placeholder({ text }: { text: string }) {
  return (
    <div aria-busy="true" className="xl:flex xl:flex-1 xl:flex-col">
      <div className="flex flex-col gap-3 sm:gap-6 lg:flex-row lg:items-center lg:justify-between xl:contents">
        <div className="min-w-0 xl:order-1">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground sm:text-sm">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
            <span className="truncate">{text}</span>
          </p>
          <h1 className="mt-1.5 text-[1.75rem] font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl xl:text-5xl">
            <Bone chars={16} />
          </h1>
          <p className="mt-1.5 text-base sm:text-xl">
            <Bone chars={20} />
          </p>
        </div>
        <div
          aria-hidden="true"
          className="flex flex-col gap-3 lg:shrink-0 lg:items-end xl:order-3 xl:mt-auto xl:items-start xl:pt-5"
        >
          <div className="hidden items-center gap-2 sm:flex">
            <span className="h-12 w-12 animate-pulse rounded-xl bg-secondary" />
            <span className="h-12 w-40 animate-pulse rounded-xl bg-secondary" />
            <span className="h-12 w-52 animate-pulse rounded-xl bg-secondary" />
          </div>
          <p className="text-xs sm:text-sm lg:w-0 lg:min-w-full lg:text-right xl:w-auto xl:min-w-0 xl:text-left">
            <Bone chars={34} />
          </p>
        </div>
      </div>
      {/* The answer's warning strip, held here too. */}
      <div className="sm:min-h-8 xl:order-2" />
    </div>
  );
}
