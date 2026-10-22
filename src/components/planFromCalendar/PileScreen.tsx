import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check, X } from "lucide-react";

import { FlowButton } from "@/components/findDate/phoneFlow/FlowShell";
import { TODAY } from "@/hooks/useDateSearch";
import { TZ, type Planning } from "@/hooks/usePlanning";
import { LOCALE, useLang, useT } from "@/i18n/lang";
import { rankCandidates } from "@/lib/candidates";
import { SEARCH_WINDOW } from "@/lib/eventSearch";
import { capitalize, formatTime } from "@/lib/format";
import { haptic } from "@/lib/haptics";
import {
  buildPile,
  candidateMonth,
  pileTimeline,
  sheetTilt,
  type PileOptions,
} from "@/lib/paperPile";
import type { FoundDate } from "@/lib/scheduler";
import { cn } from "@/lib/utils";

import PaperSheet from "./PaperSheet";

/** The pile's stages, in order. */
const PHASES = ["landing", "pressed", "revealed", "lifted", "ranking", "done"] as const;
type Phase = (typeof PHASES)[number];
const atLeast = (phase: Phase, than: Phase) => PHASES.indexOf(phase) >= PHASES.indexOf(than);

/** The most dates laid out in the grid: the chosen ones, and others that work, up to this. */
const GRID_MAX = 12;

/**
 * The paper pile (#126), over My calendar: everyone's month lands on yours
 * as paper, crooked and faster each time; the pile is pressed flat and
 * turns see-through, so only the days free for everyone shine through; the
 * dates that work lift out into a grid, the best are picked, and one button
 * sends them to the group. Slower than the search on purpose: seeing every
 * calendar taken into account is what makes the dates believable. A tap
 * anywhere skips to the end, and reduced motion starts there.
 *
 * Until #119 ranks dates by what they cost everyone, the best are the ones
 * a vote has always offered (pickCandidates): free for everyone first,
 * spread over different weekdays.
 */
export default function PileScreen({
  planning,
  onChange,
  onClose,
}: {
  planning: Planning;
  /** Back to the Planlæg sheet. */
  onChange: () => void;
  onClose: () => void;
}) {
  const t = useT();
  const words = t.planFromCalendar;
  const { lang } = useLang();
  const reduceMotion = useReducedMotion();
  const {
    participants,
    search,
    searchWindow,
    youProfileId,
    found,
    waiting,
    extras,
    review,
    canSuggest,
    acceptOwnTimeOff,
    checking,
    sending,
    suggest,
    movedNote,
    sendSuggestion,
  } = planning;

  // The dates: every one the search looked at, and the ones a vote offers.
  const dates = useMemo(() => {
    if (!participants || !found?.slot) return null;
    const { pool, chosen } = rankCandidates(
      participants,
      search,
      {
        first: { slot: found.slot, conflicts: found.conflicts },
        end: searchWindow.end,
        count: extras.dateCount,
      },
      TZ,
    );
    const others = pool.filter((d) => !chosen.includes(d) && d.conflicts.length === 0);
    const shown = [...chosen, ...others.slice(0, Math.max(0, GRID_MAX - chosen.length))].sort(
      (a, b) => Date.parse(a.slot.start) - Date.parse(b.slot.start),
    );
    return { chosen, shown };
  }, [participants, found, search, searchWindow, extras.dateCount]);

  // The month on paper: the one most of those dates are in.
  const pile = useMemo(() => {
    if (!participants) return null;
    const opts: PileOptions = {
      timeZone: TZ,
      todayMs: Date.parse(TODAY),
      windowEndMs: Date.parse(SEARCH_WINDOW.end),
      locale: LOCALE[lang],
      window: searchWindow,
    };
    const starts = dates?.chosen.map((d) => d.slot.start) ?? [];
    const { year, month } = candidateMonth(starts, searchWindow.start, TZ);
    return buildPile(participants, search, youProfileId, year, month, opts);
  }, [participants, dates, search, searchWindow, youProfileId, lang]);

  // The clock: started once, when the group's calendars are in.
  const [phase, setPhase] = useState<Phase>(reduceMotion ? "done" : "landing");
  const [instant, setInstant] = useState(!!reduceMotion);
  const others = Math.max(0, (pile?.sheets.length ?? 1) - 1);
  const timeline = useMemo(() => pileTimeline(others), [others]);
  const ready = !!pile;
  // Every stage on a timer from the moment the calendars are in; a skip
  // (instant) or leaving the screen clears whatever is still to come.
  useEffect(() => {
    if (!ready || instant) return;
    const timers: number[] = [];
    const at = (seconds: number, fn: () => void) =>
      timers.push(window.setTimeout(fn, seconds * 1000));
    timeline.lands.forEach((land) => at(land.at + land.duration * 0.8, () => haptic("tick")));
    at(timeline.pressAt, () => {
      setPhase("pressed");
      haptic("answer");
    });
    at(timeline.revealAt, () => setPhase("revealed"));
    at(timeline.liftAt, () => setPhase("lifted"));
    at(timeline.rankAt, () => setPhase("ranking"));
    at(timeline.doneAt, () => {
      setPhase("done");
      haptic("success");
    });
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [ready, instant, timeline]);

  /** A tap anywhere: straight to the dates. */
  function skip() {
    if (phase === "done" || !ready) return;
    setInstant(true);
    setPhase("done");
  }

  const throughCount = pile?.through.filter(Boolean).length ?? 0;
  const nothing = !found?.slot;
  const status = !pile
    ? (waiting?.text ?? words.waiting)
    : phase === "landing"
      ? words.gathering
      : phase === "pressed"
        ? words.pressing
        : phase === "revealed"
          ? nothing
            ? words.noneThrough
            : words.through(throughCount)
          : phase === "done" && dates
            ? words.ranked(dates.chosen.length)
            : nothing
              ? words.noneThrough
              : words.ranking;

  const lifted = atLeast(phase, "lifted");
  const send = () =>
    dates &&
    void sendSuggestion(
      dates.chosen.map((d) => ({ start: d.slot.start, end: d.slot.end, answer: "accepted" })),
    );

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col bg-background/85 pt-[env(safe-area-inset-top)] backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      onClick={skip}
    >
      <div className="flex justify-end px-3 pt-2">
        <button
          type="button"
          aria-label={words.close}
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="rounded-full p-2 text-muted-foreground hover:bg-secondary"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center px-4">
        {/* The pile, and the dates lifted out of it in its place. */}
        <div className="grid w-full max-w-sm">
          {/* The pile: every sheet in one grid cell, the base under them all. */}
          {pile && (
            <motion.div
              className="grid [grid-area:1/1]"
              animate={
                lifted ? { opacity: 0, scale: 0.92, y: -40 } : { opacity: 1, scale: 1, y: 0 }
              }
              transition={{ duration: instant ? 0 : 0.5, ease: "easeInOut" }}
              aria-hidden
            >
              <div className="[grid-area:1/1]">
                <PaperSheet
                  through
                  sheet={{
                    profileId: "",
                    name: "",
                    isYou: false,
                    days: pile.through.map((d) => (d ? "free" : "off")),
                  }}
                  label=""
                  month={pile.label}
                  lead={pile.lead}
                  see={0}
                  instant={instant}
                />
              </div>
              {pile.sheets.map((sheet, i) => {
                const tilt = sheetTilt(i);
                const land = i === 0 ? null : timeline.lands[i - 1];
                const pressed = atLeast(phase, "pressed");
                return (
                  <motion.div
                    key={sheet.profileId}
                    className="[grid-area:1/1]"
                    initial={
                      instant
                        ? false
                        : i === 0
                          ? { opacity: 0, y: 24, scale: 0.96 }
                          : {
                              opacity: 0,
                              y: -460,
                              x: tilt.x * 4,
                              rotate: tilt.rotate * 4,
                              scale: 1.05,
                            }
                    }
                    animate={
                      pressed
                        ? {
                            opacity: 1,
                            x: 0,
                            y: 0,
                            rotate: 0,
                            scaleX: [1, 1.03, 1],
                            scaleY: [1, 0.94, 1],
                          }
                        : { opacity: 1, x: tilt.x, y: tilt.y, rotate: tilt.rotate, scale: 1 }
                    }
                    transition={
                      instant
                        ? { duration: 0 }
                        : pressed
                          ? { duration: 0.9, ease: [0.3, 0, 0.2, 1] }
                          : land
                            ? { delay: land.at, duration: land.duration, ease: [0.2, 0.9, 0.3, 1] }
                            : { duration: 0.5, ease: "easeOut" }
                    }
                  >
                    <PaperSheet
                      sheet={sheet}
                      label={sheet.isYou ? words.you : sheet.name}
                      month={pile.label}
                      lead={pile.lead}
                      see={atLeast(phase, "revealed") ? 1 : 0}
                      instant={instant}
                    />
                  </motion.div>
                );
              })}
            </motion.div>
          )}

          {/* The dates that work, lifted out, the best ones marked. */}
          {lifted && dates && (
            <DateGrid
              dates={dates.shown}
              chosen={dates.chosen}
              meeting={search.kind === "single"}
              phase={phase}
              instant={instant}
            />
          )}
        </div>

        <p
          aria-live="polite"
          className="mt-5 min-h-[1.5rem] text-center text-[15px] font-semibold text-foreground"
        >
          {status}
        </p>
        {phase !== "done" && pile && (
          <p className="mt-1 text-xs text-muted-foreground">{words.skipHint}</p>
        )}
      </div>

      {phase === "done" && (
        <div
          className="flex flex-col gap-2 border-t bg-card px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3"
          onClick={(e) => e.stopPropagation()}
        >
          {movedNote === "suggest" && (
            <p className="text-sm font-medium text-foreground">
              {t.scheduler.changedBeforeSending}
            </p>
          )}
          {suggest.isError && <p className="text-sm text-red-700">{suggest.error.message}</p>}
          {review.tone === "approve" && (
            <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
              {t.scheduler.hintAccept}
              <button
                type="button"
                onClick={acceptOwnTimeOff}
                className="shrink-0 rounded-lg border px-3 py-1.5 font-semibold text-foreground"
              >
                {t.scheduler.accept}
              </button>
            </div>
          )}
          {dates && (
            <FlowButton onClick={send} disabled={!canSuggest || checking || sending}>
              {checking ? t.scheduler.checking : words.suggest(dates.chosen.length)}
            </FlowButton>
          )}
          <FlowButton quiet onClick={onChange}>
            {words.change}
          </FlowButton>
          {!canSuggest && review.tone !== "approve" && (
            <p className="text-center text-xs text-muted-foreground">
              {planning.user ? t.scheduler.hintExample : t.scheduler.hintSignIn}
            </p>
          )}
        </div>
      )}
    </motion.div>
  );
}

/**
 * The dates that work as cards, rising out of the pile; the ranking pass
 * runs over them one by one, the chosen ones are ticked, and at the end they
 * move to the top with the rest faded below.
 */
function DateGrid({
  dates,
  chosen,
  meeting,
  phase,
  instant,
}: {
  dates: FoundDate[];
  chosen: FoundDate[];
  /** A meeting shows its start time; a trip or holiday its first day only. */
  meeting: boolean;
  phase: Phase;
  instant: boolean;
}) {
  const { lang } = useLang();
  const ranking = phase === "ranking";
  const done = phase === "done";
  // The pass: one card after another over the ranking's time.
  const [looking, setLooking] = useState(-1);
  useEffect(() => {
    if (!ranking || instant) return;
    const step = (1.8 * 1000) / Math.max(1, dates.length);
    let i = 0;
    const id = window.setInterval(() => {
      setLooking(i);
      i += 1;
      if (i >= dates.length) window.clearInterval(id);
    }, step);
    return () => window.clearInterval(id);
  }, [ranking, instant, dates.length]);

  const ordered = done
    ? [...dates].sort((a, b) => Number(chosen.includes(b)) - Number(chosen.includes(a)))
    : dates;

  return (
    <div className="grid grid-cols-3 content-center gap-2 [grid-area:1/1]">
      {ordered.map((d, i) => {
        const isChosen = chosen.includes(d);
        const seen = done || (ranking && dates.indexOf(d) <= looking);
        const start = new Date(d.slot.start);
        return (
          <motion.div
            key={d.slot.start}
            layout={!instant}
            initial={instant ? false : { opacity: 0, y: 24, scale: 0.8 }}
            animate={{
              opacity: done && !isChosen ? 0.35 : 1,
              y: 0,
              scale: dates.indexOf(d) === looking && ranking ? 1.06 : 1,
            }}
            transition={{
              duration: instant ? 0 : 0.35,
              delay: instant || phase !== "lifted" ? 0 : i * 0.04,
            }}
            className={cn(
              "relative rounded-xl border bg-card px-2 py-2 text-center shadow-sm",
              seen && isChosen && "border-emerald-500 ring-2 ring-emerald-500/40",
            )}
          >
            <div className="text-[11px] font-semibold uppercase text-muted-foreground">
              {capitalize(
                start.toLocaleDateString(LOCALE[lang], { weekday: "short", timeZone: TZ }),
              )}
            </div>
            <div className="text-xl font-extrabold leading-tight text-foreground">
              {start.toLocaleDateString(LOCALE[lang], { day: "numeric", timeZone: TZ })}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {start.toLocaleDateString(LOCALE[lang], { month: "short", timeZone: TZ })}
              {meeting && ` · ${formatTime(d.slot.start)}`}
            </div>
            {seen && isChosen && (
              <motion.span
                initial={instant ? false : { scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white"
              >
                <Check className="h-3 w-3" strokeWidth={3} />
              </motion.span>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
