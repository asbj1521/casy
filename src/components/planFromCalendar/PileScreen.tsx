import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type TargetAndTransition,
  type Transition,
} from "framer-motion";
import { Check, ChevronDown, Loader2, X } from "lucide-react";

import { FlowButton } from "@/components/findDate/phoneFlow/FlowShell";
import { MonthLayer } from "@/components/swipe/MonthView";
import { TODAY } from "@/hooks/useDateSearch";
import { TZ, type Planning } from "@/hooks/usePlanning";
import { LOCALE, useLang, useT } from "@/i18n/lang";
import { rankCandidates } from "@/lib/candidates";
import { edgeWarnings } from "@/lib/earlyMorning";
import { SEARCH_WINDOW, type EventSettings } from "@/lib/eventSearch";
import { capitalize, formatEventDate, formatTime, nameList } from "@/lib/format";
import { haptic } from "@/lib/haptics";
import type { GridItem } from "@/lib/monthGrid";
import {
  buildPile,
  candidateMonth,
  jostle,
  layerAlpha,
  PILE_TIMING,
  pileTimeline,
  sheetTilt,
  throwSide,
  type PileOptions,
} from "@/lib/paperPile";
import type { FoundDate } from "@/lib/scheduler";
import { cn } from "@/lib/utils";
import { addDays, dayOf, wallTime } from "@/lib/zone";

/** The pile's stages, in order. */
const PHASES = ["landing", "pressed", "revealed", "lifted", "ranking", "done"] as const;
type Phase = (typeof PHASES)[number];
const atLeast = (phase: Phase, than: Phase) => PHASES.indexOf(phase) >= PHASES.indexOf(than);

/** The most dates in the list: the chosen ones, and others that work, up to this. */
const LIST_MAX = 8;

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

/** How far the press pushes a row down in the middle of the month, in pixels. */
const PRESS_PX = 5;

/** Where your month sits on screen: the layers land exactly on it. */
interface Frame {
  top: number;
  left: number;
  width: number;
}

/** One date in the list, with what Casy checked about it. */
interface CheckedDate {
  date: FoundDate;
  /** Its local day, for the green circle it flies up out of. */
  day: number;
  chosen: boolean;
  /** What Casy checks, and what it found, in order. */
  checks: { doing: string; found: string; notable: boolean }[];
}

/**
 * The paper pile (#126), over My calendar itself: your calendar scrolls to
 * the month, and each friend's calendar is thrown onto it as the same month
 * view on glass, from the left, then the right, faster each time, hitting
 * with a skid and a hop that knocks the ones under it; the pile grows more
 * opaque until it can't be seen through. Then it is pressed down from the
 * middle out, the layers settle into line and turn clear, and the days free
 * for everyone light up. Those fly up into a list over the calendar, and
 * each date is checked in turn, with what Casy is looking at and what it
 * found shown as it goes; the ones a vote offers get a tick. Tap a date for
 * its details. Slower than the search on purpose, and not skippable:
 * seeing every calendar taken into account is what makes the dates
 * believable. Reduced motion goes straight to the checked list.
 *
 * Only real checks are shown (#126): who can come, the evening before and
 * the morning after, who would have to give something up, and the spread
 * over the week. Friends' calendars show only when they are busy, as bars in
 * their colour with no words, never a calendar name or a title. Until #119
 * ranks dates by what they cost everyone, there is no score: the dates a
 * vote offers are pickCandidates' picks.
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
    groupSize,
  } = planning;

  // The dates: the ones a vote offers, and others that work, with what
  // Casy checks about each.
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
    const listed = [...chosen, ...others.slice(0, Math.max(0, LIST_MAX - chosen.length))].sort(
      (a, b) => Date.parse(a.slot.start) - Date.parse(b.slot.start),
    );
    const names = (list: { name: string }[]) =>
      nameList(
        list.map((p) => p.name),
        lang,
      );
    const checked: CheckedDate[] = listed.map((date) => {
      const isChosen = chosen.includes(date);
      const warnings =
        search.kind === "single"
          ? edgeWarnings(participants, date.slot, TZ, youProfileId, lang, t)
          : null;
      const absent = date.absent ?? [];
      return {
        date,
        day: Date.parse(dayOf(date.slot.start, TZ)),
        chosen: isChosen,
        checks: [
          {
            doing: words.checking(groupSize),
            found:
              absent.length > 0 ? t.schedulerFlow.needSkip(names(absent)) : words.allCan(groupSize),
            notable: absent.length > 0,
          },
          ...(warnings
            ? [
                {
                  doing: words.checkEdges,
                  found:
                    warnings.length > 0 ? warnings.map((w) => w.text).join(" ") : words.edgesClear,
                  notable: warnings.length > 0,
                },
              ]
            : []),
          {
            doing: words.checkSkips,
            found:
              date.conflicts.length === 0
                ? words.noSkips
                : search.kind === "single"
                  ? t.schedulerFlow.needSkip(names(date.conflicts))
                  : t.schedulerFlow.needTimeOff(names(date.conflicts)),
            notable: date.conflicts.length > 0,
          },
          {
            doing: words.checkSpread,
            found: isChosen ? words.picked : words.notPicked,
            notable: false,
          },
        ],
      };
    });
    return { chosen, checked };
  }, [
    participants,
    found,
    search,
    searchWindow,
    extras.dateCount,
    lang,
    t,
    words,
    youProfileId,
    groupSize,
  ]);

  // The month in the pile, the one most of those dates are in: whose
  // calendars land on it, and the days free for everyone.
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
    if (el && scroller) scroller.scrollTo({ top: el.offsetTop, behavior: "smooth" });
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

  // The clock, from the moment the month is in place. The list's checks
  // end it (onRanked), each date taking its turn.
  const [phase, setPhase] = useState<Phase>(reduceMotion ? "done" : "landing");
  const [landed, setLanded] = useState(0);
  const others = pile?.friends.length ?? 0;
  const timeline = useMemo(() => pileTimeline(others), [others]);
  const ready = !!frame && !!pile;
  useEffect(() => {
    if (!ready || reduceMotion) return;
    const timers: number[] = [];
    const at = (seconds: number, fn: () => void) =>
      timers.push(window.setTimeout(fn, seconds * 1000));
    timeline.lands.forEach((land, k) =>
      at(land.at + land.duration, () => {
        setLanded(k + 1);
        haptic("tick");
      }),
    );
    at(timeline.pressAt, () => {
      setPhase("pressed");
      haptic("answer");
    });
    at(timeline.revealAt, () => setPhase("revealed"));
    at(timeline.liftAt, () => setPhase("lifted"));
    at(timeline.rankAt, () => setPhase("ranking"));
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [ready, reduceMotion, timeline]);

  const pressed = atLeast(phase, "pressed");
  const revealed = atLeast(phase, "revealed");
  const lifted = atLeast(phase, "lifted");
  const done = phase === "done";
  const failed = !participants && waiting && !waiting.loading;
  const ranked = useCallback(() => {
    setPhase("done");
    haptic("success");
  }, []);
  const alpha = layerAlpha(others);
  const send = () =>
    dates &&
    void sendSuggestion(
      dates.chosen.map((d) => ({ start: d.slot.start, end: d.slot.end, answer: "accepted" })),
    );

  /** A week row of a layer, pressed down once as the press passes from the middle out. */
  const press = (w: number, count: number, row: ReactNode) => {
    const middle = (count - 1) / 2;
    const away = Math.abs(w - middle);
    return (
      <motion.div
        key={w}
        animate={pressed ? { y: [0, PRESS_PX * (1 - away / (middle + 1)), 0] } : { y: 0 }}
        transition={{ duration: 0.55, delay: away * 0.08, ease: "easeInOut" }}
      >
        {row}
      </motion.div>
    );
  };

  return (
    <>
      {/* The layers, over My calendar's month and clear of the tab bar. They
          stay once clear: for now this is everyone's calendar together. */}
      {frame && pile && !reduceMotion && (
        <div
          data-pile
          aria-hidden
          className="pointer-events-none fixed inset-x-0 top-0 z-40 overflow-hidden"
          style={{ bottom: "var(--tab-bar-height)" }}
        >
          {pile.friends.map((friend, k) => (
            <ThrownLayer
              key={friend.profileId}
              k={k}
              frame={frame}
              land={timeline.lands[k]}
              landed={landed}
              pressed={pressed}
              revealed={revealed}
              alpha={alpha}
              name={friend.name}
              color={friend.color}
            >
              <MonthLayer
                month={pile.month}
                items={friend.items}
                colorOf={() => friend.color}
                wrapRow={press}
              />
            </ThrownLayer>
          ))}

          {/* What shines through: the days free for everyone. */}
          {revealed && (
            <motion.div
              className="absolute"
              style={{ top: frame.top, left: frame.left, width: frame.width }}
              initial={{ opacity: 0, scale: 0.98 }}
              // Gone the moment the dates fly up out of it.
              animate={{ opacity: lifted ? 0 : 1, scale: 1 }}
              transition={{ duration: lifted ? 0.15 : 0.5, ease: "easeOut" }}
            >
              <MonthLayer month={pile.month} items={[]} colorOf={() => ""} shine={pile.shine} />
            </motion.div>
          )}
        </div>
      )}

      <button
        type="button"
        aria-label={words.close}
        onClick={onClose}
        className="glass fixed right-3 top-[calc(env(safe-area-inset-top)+0.5rem)] z-50 rounded-full p-2 text-foreground"
      >
        <X className="h-5 w-5" />
      </button>

      {/* The dates, flown up into a list over the calendar, checked one by one. */}
      {(lifted || failed) && (
        // Over everything down to the tab bar; the calendar stays in view
        // behind it, softened so the list reads.
        <motion.div
          className="fixed inset-x-0 top-0 z-50 flex flex-col bg-background/50 pt-[calc(env(safe-area-inset-top)+3.5rem)] backdrop-blur-[3px]"
          style={{ bottom: "var(--tab-bar-height)" }}
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
            {failed ? (
              <p className="glass rounded-[22px] p-4 text-[15px] text-foreground">
                {waiting?.text}
              </p>
            ) : dates ? (
              <DateList
                items={dates.checked}
                meeting={search.kind === "single"}
                kind={search.kind}
                phase={phase}
                instant={reduceMotion}
                onRanked={ranked}
              />
            ) : (
              done && (
                <p className="glass rounded-[22px] p-4 text-[15px] text-foreground">
                  {words.noneThrough}
                </p>
              )
            )}
          </div>

          {(done || failed) && (
            <motion.div
              className="glass mx-3 mb-3 flex flex-col gap-2 rounded-[26px] p-3"
              initial={reduceMotion ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
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
              {dates && !canSuggest && review.tone !== "approve" && (
                <p className="text-center text-xs text-muted-foreground">
                  {planning.user ? t.scheduler.hintExample : t.scheduler.hintSignIn}
                </p>
              )}
            </motion.div>
          )}
        </motion.div>
      )}
    </>
  );
}

/**
 * One friend's calendar, thrown onto the pile from the side (`throwSide`):
 * in the air for `land.duration`, then the hit (PILE_TIMING.impact): a skid
 * past where it ends up, a hop, and settling crooked. Every calendar landing
 * on it after knocks it a little (`jostle`, on a layer of its own so a knock
 * never restarts the throw). Pressed, it settles straight without a bounce;
 * revealed, its glass clears and its bars fade back.
 */
const ThrownLayer = memo(function ThrownLayer({
  k,
  frame,
  land,
  landed,
  pressed,
  revealed,
  alpha,
  name,
  color,
  children,
}: {
  k: number;
  frame: Frame;
  land: { at: number; duration: number };
  landed: number;
  pressed: boolean;
  revealed: boolean;
  alpha: number;
  name: string;
  color: string;
  children: ReactNode;
}) {
  const throwIn = useMemo((): {
    initial: TargetAndTransition;
    animate: TargetAndTransition;
    transition: Transition;
  } => {
    const tilt = sheetTilt(k + 1);
    const side = throwSide(k);
    const hit = land.duration / (land.duration + PILE_TIMING.impact);
    return {
      initial: { x: side * (frame.width + 80), y: -70, rotate: side * -22, scale: 1.05 },
      animate: {
        // Flies in, slides past where it ends up (in the direction it was
        // thrown), hops, and comes back to rest.
        x: [side * (frame.width + 80), tilt.x - side * 12, tilt.x + side * 3, tilt.x],
        y: [-70, tilt.y + 4, tilt.y - 12, tilt.y],
        rotate: [side * -22, tilt.rotate - side * 2.5, tilt.rotate + side * 1, tilt.rotate],
        scale: [1.05, 0.985, 1.01, 1],
      },
      transition: {
        delay: land.at,
        duration: land.duration + PILE_TIMING.impact,
        times: [0, hit, hit + (1 - hit) * 0.45, 1],
        ease: [[0.4, 0.05, 0.7, 1], "easeOut", "easeInOut"],
      },
    };
  }, [k, frame.width, land.at, land.duration]);
  const knock = jostle(k, landed);

  return (
    <motion.div
      className="absolute"
      style={{ top: frame.top, left: frame.left, width: frame.width, transformOrigin: "50% 35%" }}
      initial={throwIn.initial}
      animate={pressed ? { x: 0, y: 0, rotate: 0, scale: 1 } : throwIn.animate}
      transition={pressed ? { type: "spring", stiffness: 170, damping: 26 } : throwIn.transition}
    >
      <motion.div
        animate={pressed ? { x: 0, rotate: 0 } : knock}
        transition={{ type: "spring", stiffness: 520, damping: pressed ? 40 : 16 }}
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
          <motion.div animate={{ opacity: revealed ? 0.3 : 1 }} transition={{ duration: 0.7 }}>
            {children}
          </motion.div>
          <motion.span
            className="glass absolute right-3 top-4 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-foreground"
            animate={{ opacity: revealed ? 0 : 1 }}
          >
            <span className="h-2 w-2 rounded-full" style={{ background: `rgb(${color})` }} />
            {name}
          </motion.span>
        </div>
      </motion.div>
    </motion.div>
  );
});

/** Where a row flies from: its green circle, as an offset and scale from where it ends up. */
interface Flight {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  /** It came out of a circle (its day is in the month on screen); else it rises from below. */
  circle: boolean;
}

/**
 * The dates as a list over the calendar. Each one flies up out of its green
 * circle and stretches into a row (measured, then animated from the circle
 * to the row: a FLIP); dates in other months rise from below. Then they are
 * checked one at a time, a spinner on the row and what Casy is checking
 * above the list, and each gets a tick (offered in the vote) or a cross.
 * Once done, a row opens to its details.
 */
function DateList({
  items,
  meeting,
  kind,
  phase,
  instant,
  onRanked,
}: {
  items: CheckedDate[];
  meeting: boolean;
  kind: EventSettings["kind"];
  phase: Phase;
  instant: boolean;
  onRanked: () => void;
}) {
  const t = useT();
  const words = t.planFromCalendar;
  const { lang } = useLang();
  const rows = useRef(new Map<string, HTMLElement>());
  const [flights, setFlights] = useState<Record<string, Flight> | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const done = phase === "done";

  // Where each row will be, against its circle: measured before they show.
  useLayoutEffect(() => {
    if (instant) return;
    const frameId = requestAnimationFrame(() => {
      const out: Record<string, Flight> = {};
      for (const item of items) {
        const key = item.date.slot.start;
        const row = rows.current.get(key)?.getBoundingClientRect();
        const circle = document
          .querySelector(`[data-pile] [data-shine="${item.day}"]`)
          ?.getBoundingClientRect();
        if (!row) continue;
        out[key] = circle
          ? {
              x: circle.left - row.left,
              y: circle.top - row.top,
              scaleX: circle.width / row.width,
              scaleY: circle.height / row.height,
              circle: true,
            }
          : { x: 0, y: 60, scaleX: 1, scaleY: 1, circle: false };
      }
      setFlights(out);
    });
    return () => cancelAnimationFrame(frameId);
    // Measured once, when the list first appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The checks: two beats per date, what Casy is checking, then what it
  // found, and on to the next. Over when every date has had its turn.
  const [beat, setBeat] = useState(instant ? items.length * 2 : 0);
  const ranking = phase === "ranking";
  useEffect(() => {
    if (!ranking || instant) return;
    const id = window.setInterval(() => setBeat((b) => b + 1), (PILE_TIMING.checkEach * 1000) / 2);
    return () => window.clearInterval(id);
  }, [ranking, instant]);
  const current = Math.floor(beat / 2);
  useEffect(() => {
    if (ranking && current >= items.length) onRanked();
  }, [ranking, current, items.length, onRanked]);
  const shown = items[current];
  // The most telling check for this date: something found, else each check in turn.
  const thought =
    ranking && shown
      ? (shown.checks.find((c) => c.notable) ?? shown.checks[current % shown.checks.length])
      : null;

  return (
    <div className="flex flex-col gap-2">
      {/* What Casy is doing, or, once done, what came of it. */}
      <div className="flex min-h-9 items-center px-1">
        <AnimatePresence mode="wait">
          {thought ? (
            <motion.p
              key={`${current}-${beat % 2}`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="glass flex items-center gap-2 rounded-full px-3 py-1.5 text-[13px] font-medium text-foreground"
            >
              {beat % 2 === 0 ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  {thought.doing}
                </>
              ) : (
                thought.found
              )}
            </motion.p>
          ) : done ? (
            <motion.h2
              key="done"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-lg font-extrabold tracking-tight text-foreground"
            >
              {words.ranked(items.filter((i) => i.chosen).length)}
            </motion.h2>
          ) : null}
        </AnimatePresence>
      </div>

      {items.map((item, i) => {
        const key = item.date.slot.start;
        const flight = flights?.[key];
        const status =
          done || i < current
            ? item.chosen
              ? "yes"
              : "no"
            : ranking && i === current
              ? "checking"
              : "waiting";
        const start = new Date(item.date.slot.start);
        const label = capitalize(
          start.toLocaleDateString(LOCALE[lang], {
            weekday: "long",
            day: "numeric",
            month: "long",
            timeZone: TZ,
          }),
        );
        const isOpen = done && open === key;
        return (
          <motion.div
            // Mounted afresh once measured, so the flight starts from the circle.
            key={`${key}-${flights ? "fly" : "wait"}`}
            ref={(el) => {
              if (el) rows.current.set(key, el);
            }}
            layout={done}
            style={{ transformOrigin: "0 0", opacity: flights || instant ? undefined : 0 }}
            initial={
              flight && !instant
                ? {
                    x: flight.x,
                    y: flight.y,
                    scaleX: flight.scaleX,
                    scaleY: flight.scaleY,
                    opacity: flight.circle ? 1 : 0,
                  }
                : false
            }
            animate={{ x: 0, y: 0, scaleX: 1, scaleY: 1, opacity: 1 }}
            transition={{ duration: 0.55, delay: instant ? 0 : i * 0.07, ease: [0.3, 0.9, 0.3, 1] }}
            className={cn(
              "glass relative overflow-hidden rounded-[22px]",
              status === "yes" && "ring-2 ring-emerald-500/70",
            )}
          >
            {/* The green of the circle it came out of, fading into glass. */}
            {flight?.circle && !instant && (
              <motion.div
                aria-hidden
                className="absolute inset-0 bg-emerald-500"
                initial={{ opacity: 1 }}
                animate={{ opacity: 0 }}
                transition={{ delay: i * 0.07 + 0.3, duration: 0.35 }}
              />
            )}
            <motion.button
              type="button"
              disabled={!done}
              onClick={() => setOpen(isOpen ? null : key)}
              aria-expanded={isOpen}
              aria-label={words.details(label)}
              className="relative flex w-full items-center gap-3 px-4 py-3 text-left"
              initial={flight && !instant ? { opacity: 0 } : false}
              animate={{ opacity: 1 }}
              transition={{ delay: instant ? 0 : i * 0.07 + 0.35, duration: 0.25 }}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[16px] font-bold text-foreground">{label}</p>
                {meeting && (
                  <p className="text-[13px] text-muted-foreground">
                    {formatTime(item.date.slot.start)}-{formatTime(item.date.slot.end)}
                  </p>
                )}
              </div>
              <StatusMark status={status} instant={instant} />
              {done && (
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                    isOpen && "rotate-180",
                  )}
                />
              )}
            </motion.button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="relative overflow-hidden"
                >
                  <div className="space-y-1.5 border-t border-white/30 px-4 pb-3 pt-2.5 text-[14px]">
                    <p className="font-semibold text-foreground">
                      {formatEventDate(kind, item.date.slot, lang)}
                    </p>
                    {item.checks.map((c, ci) => (
                      <p
                        key={ci}
                        className={cn(
                          "flex items-start gap-2",
                          c.notable ? "text-amber-800" : "text-muted-foreground",
                        )}
                      >
                        <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
                        {c.found}
                      </p>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </div>
  );
}

/** A row's state: waiting its turn, being checked (a spinner), offered (a tick) or not (a cross). */
function StatusMark({
  status,
  instant,
}: {
  status: "waiting" | "checking" | "yes" | "no";
  instant: boolean;
}) {
  return (
    <span className="relative flex h-7 w-7 shrink-0 items-center justify-center">
      <AnimatePresence mode="popLayout" initial={false}>
        {status === "checking" ? (
          <motion.span key="checking" exit={{ opacity: 0, scale: 0.6 }}>
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </motion.span>
        ) : status === "yes" || status === "no" ? (
          <motion.span
            key={status}
            initial={instant ? false : { scale: 0, rotate: -45 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 20 }}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-full text-white",
              status === "yes" ? "bg-emerald-500" : "bg-red-500",
            )}
          >
            {status === "yes" ? (
              <Check className="h-4 w-4" strokeWidth={3} />
            ) : (
              <X className="h-4 w-4" strokeWidth={3} />
            )}
          </motion.span>
        ) : (
          <span key="waiting" className="h-2 w-2 rounded-full bg-muted-foreground/30" />
        )}
      </AnimatePresence>
    </span>
  );
}
