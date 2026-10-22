import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check, X } from "lucide-react";

import { FlowButton } from "@/components/findDate/phoneFlow/FlowShell";
import { MonthLayer } from "@/components/swipe/MonthView";
import { TODAY } from "@/hooks/useDateSearch";
import { TZ, type Planning } from "@/hooks/usePlanning";
import { LOCALE, useLang, useT } from "@/i18n/lang";
import { rankCandidates } from "@/lib/candidates";
import { SEARCH_WINDOW } from "@/lib/eventSearch";
import { capitalize, formatTime } from "@/lib/format";
import { haptic } from "@/lib/haptics";
import type { GridItem } from "@/lib/monthGrid";
import {
  buildPile,
  candidateMonth,
  layerAlpha,
  pileTimeline,
  sheetTilt,
  type PileOptions,
} from "@/lib/paperPile";
import type { FoundDate } from "@/lib/scheduler";
import { cn } from "@/lib/utils";
import { addDays, wallTime } from "@/lib/zone";

/** The pile's stages, in order. */
const PHASES = ["landing", "pressed", "revealed", "lifted", "ranking", "done"] as const;
type Phase = (typeof PHASES)[number];
const atLeast = (phase: Phase, than: Phase) => PHASES.indexOf(phase) >= PHASES.indexOf(than);

/** The most dates laid out in the grid: the chosen ones, and others that work, up to this. */
const GRID_MAX = 12;

/** A colour per friend, Apple Calendar's own, in the group's order. */
const FRIEND_COLORS = [
  "0, 122, 255",
  "52, 199, 89",
  "175, 82, 222",
  "255, 149, 0",
  "255, 45, 85",
  "90, 200, 250",
  "162, 132, 94",
  "88, 86, 214",
];

/** How far the wave dips a row in the middle, in pixels. */
const WAVE_PX = 18;

/** Where your month sits on screen: the layers land exactly on it. */
interface Frame {
  top: number;
  left: number;
  width: number;
}

/**
 * The paper pile (#126), over My calendar itself: your calendar scrolls to
 * the month, and each friend's calendar lands on it as the same month view
 * on glass, crooked and faster each time, the pile growing more opaque until
 * it can't be seen through. Then it is pressed in the middle: a wave runs
 * out through the rows, the layers spring into line and turn clear, and the
 * days free for everyone light up. The dates that work lift into a grid, the
 * best are picked, and one button sends them. Slower than the search on
 * purpose, and not skippable: seeing every calendar taken into account is
 * what makes the dates believable. Reduced motion goes straight to the dates.
 *
 * Friends' calendars show only when they are busy, as bars in their colour
 * with no words: what members already see of each other, never a calendar
 * name or a title. Until #119 ranks dates by what they cost everyone, the
 * best are the ones a vote has always offered (pickCandidates), ticked
 * rather than ranked.
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
  const reduceMotion = !!useReducedMotion();
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

  // The month in the pile, the one most of those dates are in: who is in
  // it, and the days free for everyone.
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
    const built = buildPile(participants, search, youProfileId, year, month, opts);
    const first = wallTime(year, month, 1, 0, TZ);
    const shine = new Set(
      built.through.flatMap((free, i) => (free ? [addDays(first, i, TZ)] : [])),
    );
    // Each friend's busy time in that month (and the week either side, which
    // its first and last rows show), as bars with no words.
    const from = addDays(first, -7, TZ);
    const to = addDays(wallTime(year, month + 1, 1, 0, TZ), 7, TZ);
    const friends = built.sheets
      .filter((s) => !s.isYou)
      .map((s, k) => {
        const busy = participants.find((p) => p.profileId === s.profileId)?.busy ?? [];
        const items: GridItem[] = busy
          .filter((b) => !b.holiday)
          .map((b) => ({
            calendarId: s.profileId,
            start: Date.parse(b.start),
            end: Date.parse(b.end),
            label: "",
          }))
          .filter((b) => b.end > from && b.start < to);
        return { ...s, items, color: FRIEND_COLORS[k % FRIEND_COLORS.length] };
      });
    return { month: first, shine, friends };
  }, [participants, dates, search, searchWindow, youProfileId, lang]);

  // Your month on screen: My calendar scrolls to it, and the layers land on
  // where it then is.
  const [frame, setFrame] = useState<Frame | null>(null);
  const month = pile?.month ?? null;
  useEffect(() => {
    if (month === null || reduceMotion) return;
    const el = [...document.querySelectorAll<HTMLElement>(`[data-month="${month}"]`)].find(
      (e) => !e.closest("[data-pile]"),
    );
    const scroller = el?.closest<HTMLElement>(".overflow-y-auto");
    scroller?.scrollTo({ top: el!.offsetTop, behavior: "smooth" });
    // Measured once the scroll has settled.
    const id = window.setTimeout(
      () => {
        const r = el?.getBoundingClientRect();
        setFrame(
          r
            ? { top: r.top, left: r.left, width: r.width }
            : { top: 96, left: 0, width: window.innerWidth },
        );
      },
      scroller ? 450 : 0,
    );
    return () => window.clearTimeout(id);
  }, [month, reduceMotion]);

  // The clock, from the moment the month is in place.
  const [phase, setPhase] = useState<Phase>(reduceMotion ? "done" : "landing");
  const timeline = useMemo(() => pileTimeline(pile?.friends.length ?? 0), [pile?.friends.length]);
  const ready = !!frame && !!pile;
  useEffect(() => {
    if (!ready || reduceMotion) return;
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
  }, [ready, reduceMotion, timeline]);

  const pressed = atLeast(phase, "pressed");
  const revealed = atLeast(phase, "revealed");
  const lifted = atLeast(phase, "lifted");
  const failed = !participants && waiting && !waiting.loading;
  const alpha = layerAlpha(pile?.friends.length ?? 0);
  const send = () =>
    dates &&
    void sendSuggestion(
      dates.chosen.map((d) => ({ start: d.slot.start, end: d.slot.end, answer: "accepted" })),
    );

  /** A week row of a layer, dipping with the wave when the pile is pressed. */
  const wave = (w: number, count: number, row: ReactNode) => {
    const middle = (count - 1) / 2;
    const away = Math.abs(w - middle);
    const amp = WAVE_PX * (1 - away / (middle + 1));
    return (
      <motion.div
        key={w}
        animate={pressed ? { y: [0, amp, -amp * 0.5, amp * 0.25, -amp * 0.1, 0] } : { y: 0 }}
        transition={{ duration: 1.3, delay: away * 0.07, ease: "easeInOut" }}
      >
        {row}
      </motion.div>
    );
  };

  return (
    <>
      {/* The layers, over My calendar's month and clear of the tab bar. */}
      {frame && pile && !reduceMotion && (
        <motion.div
          data-pile
          aria-hidden
          className="pointer-events-none fixed inset-x-0 top-0 z-40 overflow-hidden"
          style={{ bottom: "var(--tab-bar-height)" }}
          animate={{ opacity: lifted ? 0 : 1 }}
          transition={{ duration: 0.5 }}
        >
          {pile.friends.map((friend, k) => {
            const tilt = sheetTilt(k + 1);
            const land = timeline.lands[k];
            const place: CSSProperties = { top: frame.top, left: frame.left, width: frame.width };
            return (
              <motion.div
                key={friend.profileId}
                className="absolute"
                style={{ ...place, transformOrigin: "50% 30%" }}
                initial={{
                  y: -(frame.top + window.innerHeight * 0.9),
                  x: tilt.x * 3,
                  rotate: tilt.rotate * 3,
                }}
                animate={
                  pressed
                    ? { x: 0, y: 0, rotate: 0 }
                    : { x: tilt.x, y: tilt.y, rotate: tilt.rotate }
                }
                transition={
                  pressed
                    ? { type: "spring", stiffness: 140, damping: 11 }
                    : { delay: land.at, duration: land.duration, ease: [0.2, 0.9, 0.3, 1] }
                }
              >
                <div
                  className="relative rounded-[28px] border transition-[background-color,box-shadow,border-color] duration-700"
                  style={{
                    backgroundColor: `rgb(var(--glass-tint) / ${revealed ? 0 : alpha})`,
                    borderColor: revealed ? "transparent" : "rgb(var(--glass-edge))",
                    boxShadow: revealed
                      ? "none"
                      : "inset 0 1px 0 rgb(var(--glass-edge)), 0 18px 40px -18px rgb(0 0 0 / 0.45)",
                  }}
                >
                  <motion.div
                    animate={{ opacity: revealed ? 0.25 : 1 }}
                    transition={{ duration: 0.7 }}
                  >
                    <MonthLayer
                      month={pile.month}
                      items={friend.items}
                      colorOf={() => friend.color}
                      wrapRow={wave}
                    />
                  </motion.div>
                  <motion.span
                    className="glass absolute right-3 top-4 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-foreground"
                    animate={{ opacity: revealed ? 0 : 1 }}
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: `rgb(${friend.color})` }}
                    />
                    {friend.name}
                  </motion.span>
                </div>
              </motion.div>
            );
          })}

          {/* What shines through: the days free for everyone. */}
          {revealed && (
            <motion.div
              className="absolute"
              style={{ top: frame.top, left: frame.left, width: frame.width }}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            >
              <MonthLayer month={pile.month} items={[]} colorOf={() => ""} shine={pile.shine} />
            </motion.div>
          )}
        </motion.div>
      )}

      <button
        type="button"
        aria-label={words.close}
        onClick={onClose}
        className="glass fixed right-3 top-[calc(env(safe-area-inset-top)+0.5rem)] z-50 rounded-full p-2 text-foreground"
      >
        <X className="h-5 w-5" />
      </button>

      {/* The dates that work, lifted out, the best ones ticked; then the way on. */}
      {(lifted || failed) && (
        <motion.div
          className="fixed inset-x-0 top-0 z-50 flex flex-col justify-end px-3 pb-[calc(var(--tab-bar-height)+0.75rem)] pt-[calc(env(safe-area-inset-top)+3.5rem)]"
          style={{ bottom: 0 }}
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
        >
          <div className="glass flex max-h-full flex-col gap-3 overflow-y-auto rounded-[28px] p-4">
            {failed ? (
              <p className="text-[15px] text-foreground">{waiting?.text}</p>
            ) : dates ? (
              <>
                {phase === "done" && (
                  <h2 className="text-lg font-extrabold tracking-tight text-foreground">
                    {words.ranked(dates.chosen.length)}
                  </h2>
                )}
                <DateGrid
                  dates={dates.shown}
                  chosen={dates.chosen}
                  meeting={search.kind === "single"}
                  phase={phase}
                  instant={reduceMotion}
                />
              </>
            ) : (
              phase === "done" && <p className="text-[15px] text-foreground">{words.noneThrough}</p>
            )}

            {(phase === "done" || failed) && (
              <div className="flex flex-col gap-2 pt-1">
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
                {dates && !canSuggest && review.tone !== "approve" && (
                  <p className="text-center text-xs text-muted-foreground">
                    {planning.user ? t.scheduler.hintExample : t.scheduler.hintSignIn}
                  </p>
                )}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </>
  );
}

/**
 * The dates that work as glass cards, rising out of the pile; the ranking
 * pass runs over them one by one, the chosen ones are ticked, and at the end
 * they move to the top with the rest faded below.
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
    const step = (1.5 * 1000) / Math.max(1, dates.length);
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
    <div className="grid grid-cols-3 gap-2">
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
              "relative rounded-2xl border border-white/40 bg-card/60 px-2 py-2 text-center shadow-sm",
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
