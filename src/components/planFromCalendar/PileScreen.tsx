import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  animate,
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type AnimationPlaybackControls,
  type MotionValue,
  type TargetAndTransition,
  type Transition,
} from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, Loader2, TriangleAlert, X } from "lucide-react";

import type { EventToProfile } from "@/api/eventProfile";
import LaterDates from "@/components/findDate/LaterDates";
import WidenSearch from "@/components/findDate/WidenSearch";
import FlowButton from "@/components/ui/FlowButton";
import { MonthLayer } from "@/components/swipe/MonthView";
import { TODAY } from "@/hooks/useDateSearch";
import { useLabelledEvents } from "@/hooks/useEventLabels";
import { useDateScores } from "@/hooks/useDateScores";
import { eventProfileQuery } from "@/hooks/useEventProfile";
import { TZ, type Planning } from "@/hooks/usePlanning";
import { LOCALE, useLang, useT } from "@/i18n/lang";
import { findPool, rankFromPool } from "@/lib/candidates";
import { edgeWarnings } from "@/lib/earlyMorning";
import { impactOn } from "@/lib/eventImpact";
import { clashSentence, importantClashes } from "@/lib/eventWarnings";
import { SEARCH_WINDOW, type EventSettings } from "@/lib/eventSearch";
import { capitalize, formatEventDate, formatTime, nameList } from "@/lib/format";
import { haptic } from "@/lib/haptics";
import type { GridItem } from "@/lib/monthGrid";
import { monthScrollTop } from "@/lib/monthScroll";
import {
  buildPile,
  candidateMonth,
  checkTimes,
  jostle,
  layerAlpha,
  liveOrder,
  PILE_TIMING,
  PILE_OPACITY,
  pileTimeline,
  sheetTilt,
  rankOrder,
  throwSide,
  type PileOptions,
  type PileSheet,
  type RankedFacts,
} from "@/lib/paperPile";
import type { FoundDate } from "@/lib/scheduler";
import { playSendFlight } from "@/lib/sendFlightPlay";
import { cn } from "@/lib/utils";
import type { WidenOption } from "@/lib/widen";
import { addDays, dayOf, localDate, startOfMonth, wallTime } from "@/lib/zone";

/** The pile's stages, in order. */
const PHASES = ["landing", "pressed", "revealed", "lifted", "ranking", "done"] as const;
type Phase = (typeof PHASES)[number];
const atLeast = (phase: Phase, than: Phase) => PHASES.indexOf(phase) >= PHASES.indexOf(than);

/** The most dates in the list: the chosen ones, and others that work, up to this. */
const LIST_MAX = 8;

/**
 * Lifting the dates into the list: a moment before the calendar starts to
 * scroll, its speed between dates (kept within a range, so a long way is
 * brisk and a short one still reads), and the stop as each date turns into
 * its row.
 */
const SCROLL_START_MS = 250;
const SCROLL_PX_PER_S = 900;
const SCROLL_MIN_S = 0.25;
const SCROLL_MAX_S = 1.1;
const ARRIVAL_PAUSE_MS = 320;
/** How far the calendar scrolls between two light ticks under the thumb. */
const SCROLL_TICK_PX = 70;

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
  /** Which month was measured (its local midnight). */
  month: number;
  top: number;
  left: number;
  width: number;
  height: number;
}

/** One date in the list, with what Casy checked about it. */
interface CheckedDate {
  date: FoundDate;
  /** Its local day, for the green circle it flies up out of. */
  day: number;
  chosen: boolean;
  /** What Casy checked and found, in order; `notable` when it counts against the date. */
  checks: { found: string; notable: boolean }[];
  /** What ranks it (rankOrder). */
  facts: RankedFacts;
  /**
   * The first of your own important events it runs into (#114), in words:
   * shown on the row as it is checked. App only, admins and AI testers.
   */
  yours: string | null;
}

/** No event to profile yet: the query stays off. */
const NO_INPUT = {} as EventToProfile;

/**
 * The paper pile (#126), over My calendar itself: your calendar scrolls to
 * the month, and each friend's calendar is thrown onto it as the same month
 * view on glass, from the left, then the right, faster each time, hitting
 * with a skid and a hop that knocks the ones under it; the pile grows more
 * opaque until it can't be seen through. Then it is pressed down from the
 * middle out, the layers settle into line into the group's calendar
 * together, and the days free for everyone light up on it. Those fly up into a list over the calendar, and
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
  onRestart,
  onClose,
}: {
  planning: Planning;
  /** Back to the Planlæg sheet. */
  onChange: () => void;
  /** Start the pile over: the plan changed from here (a shorter holiday). */
  onRestart: () => void;
  onClose: () => void;
}) {
  const t = useT();
  const words = t.planFromCalendar;
  const { lang } = useLang();
  const reduceMotion = !!useReducedMotion();
  const {
    participants,
    activeGroup,
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
    checkers,
    suggestions,
    adoptSuggestion,
    widen,
    applyWiden,
    aiOn,
    profileFor,
    user,
  } = planning;
  // Your own important events (#114, labelled on this phone; app only, for
  // admins and AI testers), and what the planned event is likely to cause
  // (#113), asked while it was set up: together, what a date runs into for
  // you. Real, from your own calendar; never anyone else's.
  const mine = useLabelledEvents();
  // A yes or no, so the dates below aren't worked out afresh on every render.
  const someCheckByHand = !!checkers;
  const { data: profile, isLoading: profileLoading } = useQuery({
    ...eventProfileQuery(user?.id ?? "", profileFor ?? NO_INPUT),
    enabled: aiOn && !!user && !!profileFor,
  });

  // Everything the search offers, the first date first: what is scored (#119)
  // and what the vote's dates are picked from.
  const poolFound = useMemo(
    () =>
      participants && found?.slot
        ? findPool(
            participants,
            search,
            {
              first: { slot: found.slot, conflicts: found.conflicts },
              end: searchWindow.end,
              count: extras.dateCount,
            },
            TZ,
          )
        : null,
    [participants, found, search, searchWindow, extras.dateCount],
  );
  const scoring = useMemo(
    () => (poolFound && found?.slot ? [{ slot: found.slot }, ...poolFound] : null),
    [poolFound, found],
  );
  // How well each date suits the group by everyone's important events (#119),
  // asked while the calendars are thrown, so the list can rank by it. Only for
  // a real group, and after the planned event's profile (it says what the
  // event does to the night before); never waited for long.
  const {
    scores,
    counted,
    settled: scoresSettled,
  } = useDateScores({
    groupId: activeGroup && !activeGroup.isExample ? activeGroup.id : null,
    settings: search,
    profile: profile ?? null,
    dates: scoring,
    enabled: !profileLoading,
  });

  // The dates: the ones a vote offers, and others that work, with what
  // Casy checks about each.
  const dates = useMemo(() => {
    if (!participants || !found?.slot || !poolFound) return null;
    const { pool, chosen, byPick } = rankFromPool(
      poolFound,
      search,
      {
        first: { slot: found.slot, conflicts: found.conflicts },
        end: searchWindow.end,
        count: extras.dateCount,
        scores,
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
      const yours = importantClashes(impactOn(profile, date.slot, search, TZ), mine, TZ)
        .slice(0, 2)
        .map((c) => clashSentence(c, t.importantClash));
      return {
        date,
        day: Date.parse(dayOf(date.slot.start, TZ)),
        chosen: isChosen,
        checks: [
          {
            found:
              absent.length > 0
                ? words.cant(names(absent))
                : // Never more than Casy knows: members without a calendar check by hand.
                  someCheckByHand
                  ? words.allCanWithCalendar(groupSize)
                  : words.allCan(groupSize),
            notable: absent.length > 0,
          },
          // How well it suits the group by everyone's important events (#119),
          // only when anyone has shared something.
          ...(counted > 0 && scores?.has(date.slot.start)
            ? [
                {
                  found: words.matchScore(scores.get(date.slot.start)!),
                  notable: scores.get(date.slot.start)! < 85,
                },
              ]
            : []),
          ...(warnings
            ? [
                {
                  found:
                    warnings.length > 0 ? warnings.map((w) => w.text).join(" ") : words.edgesClear,
                  notable: warnings.length > 0,
                },
              ]
            : []),
          ...yours.map((found) => ({ found, notable: true })),
          {
            found:
              date.conflicts.length === 0
                ? words.noSkips
                : search.kind === "single"
                  ? t.schedulerFlow.needSkip(names(date.conflicts))
                  : t.schedulerFlow.needTimeOff(names(date.conflicts)),
            notable: date.conflicts.length > 0,
          },
          { found: isChosen ? words.picked : words.notPicked, notable: false },
        ],
        facts: {
          pickedAt: byPick.includes(date) ? byPick.indexOf(date) : null,
          conflicts: date.conflicts.length + absent.length,
          warnings: (warnings?.length ?? 0) + yours.length,
          start: Date.parse(date.slot.start),
        },
        yours: yours[0] ?? null,
      };
    });
    return { chosen, checked };
  }, [
    participants,
    found,
    poolFound,
    scores,
    counted,
    search,
    searchWindow,
    extras.dateCount,
    lang,
    t,
    words,
    youProfileId,
    groupSize,
    someCheckByHand,
    profile,
    mine,
  ]);

  // The month in the pile, the first date's: whose calendars land on it,
  // and the days free for everyone. The months after it, up to the last
  // date in the list, are what the shared calendar scrolls through as the
  // dates are lifted into the list.
  const pile = useMemo(() => {
    if (!participants) return null;
    const opts: PileOptions = {
      timeZone: TZ,
      todayMs: Date.parse(TODAY),
      windowEndMs: Date.parse(SEARCH_WINDOW.end),
      locale: LOCALE[lang],
      window: searchWindow,
    };
    const listed = dates?.checked.map((d) => d.date.slot.start) ?? [];
    const { year, month } = candidateMonth(listed.slice(0, 1), searchWindow.start, TZ);
    const first = wallTime(year, month, 1, 0, TZ);
    const last =
      listed.length > 0 ? startOfMonth(Date.parse(listed[listed.length - 1]), TZ) : first;
    const months: number[] = [];
    for (let m = first; m <= last; m = startOfMonth(m, TZ, 1)) months.push(m);
    // The days free for everyone in each of those months.
    const shine = new Set<number>();
    let sheets: PileSheet[] = [];
    for (const m of months) {
      const { year: y, month: mo } = localDate(m, TZ);
      const built = buildPile(participants, search, youProfileId, y, mo, opts);
      if (m === first) sheets = built.sheets;
      built.through.forEach((free, i) => free && shine.add(addDays(m, i, TZ)));
    }
    // Each friend's busy time over those months (and the week either side,
    // which the first and last rows show), as bars with no words.
    const from = addDays(first, -7, TZ);
    const to = addDays(startOfMonth(last, TZ, 1), 7, TZ);
    const friends = sheets
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
    return { month: first, months, shine, friends };
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
    if (el && scroller)
      scroller.scrollTo({ top: monthScrollTop(scroller, el), behavior: "smooth" });
    // Measured once the scroll has settled.
    const id = window.setTimeout(
      () => {
        const r = el?.getBoundingClientRect();
        setFrame(
          r
            ? { month, top: r.top, left: r.left, width: r.width, height: r.height }
            : { month, top: 96, left: 0, width: window.innerWidth, height: 600 },
        );
      },
      scroller ? 450 : 0,
    );
    return () => window.clearTimeout(id);
  }, [month, reduceMotion]);

  // The clock, from the moment the month is in place, up to the dates being
  // lifted out; from there the list runs it: the scroll that lifts each date
  // into it (onArrived), then the checks (onRanked).
  const [phase, setPhase] = useState<Phase>(reduceMotion ? "done" : "landing");
  const [landed, setLanded] = useState(0);
  const others = pile?.friends.length ?? 0;
  const timeline = useMemo(() => pileTimeline(others), [others]);
  // Waits (briefly) for the scores, so the list is ranked by them from the start.
  const ready = !!frame && !!pile && scoresSettled;
  useEffect(() => {
    if (!ready || reduceMotion) return;
    const timers: number[] = [];
    const at = (seconds: number, fn: () => void) =>
      timers.push(window.setTimeout(fn, seconds * 1000));
    timeline.lands.forEach((land, k) =>
      at(land.at + land.duration, () => {
        setLanded(k + 1);
        haptic("thud");
      }),
    );
    at(timeline.pressAt, () => {
      setPhase("pressed");
      haptic("thud");
    });
    at(timeline.revealAt, () => setPhase("revealed"));
    at(timeline.liftAt, () => setPhase("lifted"));
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [ready, reduceMotion, timeline]);

  const pressed = atLeast(phase, "pressed");
  const revealed = atLeast(phase, "revealed");
  const lifted = atLeast(phase, "lifted");
  // With no date at all, there is no list to run: done once it would start.
  const done = phase === "done" || (lifted && !dates);
  const failed = !participants && waiting && !waiting.loading;
  const ranked = useCallback(() => {
    setPhase("done");
    haptic("success");
  }, []);
  const arrived = useCallback(() => setPhase("ranking"), []);
  // The shared calendar's scroll, and the days already lifted into the list.
  const scroll = useMotionValue(0);
  const [taken, setTaken] = useState<ReadonlySet<number>>(new Set());
  const take = useCallback((day: number) => setTaken((t) => new Set(t).add(day)), []);
  const stillShining = useMemo(
    () => new Set([...(pile?.shine ?? [])].filter((d) => !taken.has(d))),
    [pile, taken],
  );
  const alpha = layerAlpha(others);
  // The send confirmed (#102): the dates not sent swipe off to the right and
  // the ones sent fly down into the Events tab, copies of the rows moving
  // over the page, while the real rows are hidden; then My events opens.
  // Reduced motion goes straight there.
  const [flying, setFlying] = useState(false);
  const listBox = useRef<HTMLDivElement>(null);
  const { setBeforeLeaving } = planning;
  useEffect(() => {
    if (reduceMotion) return;
    setBeforeLeaving((go) => {
      const rows = [...(listBox.current?.querySelectorAll<HTMLElement>("[data-send-row]") ?? [])];
      void playSendFlight(
        rows.map((el) => ({ el, offered: el.dataset.sendRow === "yes" })),
        document.querySelector<HTMLElement>('[data-tab-icon="/events"]'),
        () => setFlying(true),
      ).finally(go);
    });
    return () => setBeforeLeaving(null);
  }, [reduceMotion, setBeforeLeaving]);
  // A way to widen the search picked (#135): the plan changes here, and once
  // its first date is the answer (with its scores, and the calendar scrolled
  // to its month), the dates are lifted into the list again. The pile isn't
  // thrown again: every calendar is already in it.
  const [widenedTo, setWidenedTo] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const pickWiden = (option: WidenOption) => {
    applyWiden(option);
    setWidenedTo(option.first.slot.start);
    setTaken(new Set());
    scroll.set(0);
  };
  // Started while rendering, as the new answer arrives (React's pattern for
  // following a changed value).
  if (
    widenedTo &&
    found?.slot?.start === widenedTo &&
    dates &&
    scoresSettled &&
    (reduceMotion || frame?.month === month)
  ) {
    setWidenedTo(null);
    setRound((r) => r + 1);
    setPhase(reduceMotion ? "done" : "lifted");
  }

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
      {/* The layers, over My calendar's month and clear of the tab bar,
          until the dates are lifted out: then the shared calendar below. */}
      {frame && pile && !reduceMotion && !lifted && (
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
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            >
              <MonthLayer month={pile.month} items={[]} colorOf={() => ""} shine={pile.shine} />
            </motion.div>
          )}
        </div>
      )}

      {/* The pile, now one shared calendar over every month the dates are
          in, scrolled by the list as it lifts each date out. */}
      {frame && pile && !reduceMotion && lifted && (
        <SharedCalendar
          key={round}
          frame={frame}
          months={pile.months}
          friends={pile.friends}
          shine={stillShining}
          scroll={scroll}
        />
      )}

      <button
        type="button"
        aria-label={words.close}
        onClick={onClose}
        className={cn(
          "glass fixed right-3 top-[calc(env(safe-area-inset-top)+0.5rem)] z-50 rounded-full p-2 text-foreground",
          flying && "opacity-0",
        )}
      >
        <X className="h-5 w-5" />
      </button>

      {/* The dates, flown up into a list over the calendar, checked one by one. */}
      {(lifted || failed) && (
        // Over everything down to the tab bar. While the dates arrive the
        // calendar scrolls by in plain view; once they all have, it softens
        // behind the list so the list reads.
        <div
          className={cn(
            "fixed inset-x-0 top-0 z-50 flex flex-col pt-[calc(env(safe-area-inset-top)+3.5rem)]",
            flying && "pointer-events-none",
          )}
          style={{ bottom: "var(--tab-bar-height)" }}
        >
          <motion.div
            aria-hidden
            className="absolute inset-0 -z-10 bg-background/50 backdrop-blur-[3px]"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: atLeast(phase, "ranking") || failed ? 1 : 0 }}
            transition={{ duration: 0.4 }}
          />
          <div
            ref={listBox}
            className={cn("min-h-0 flex-1 overflow-y-auto px-3 pb-3", flying && "opacity-0")}
          >
            {failed ? (
              <p className="glass rounded-[22px] p-4 text-[15px] text-foreground">
                {waiting?.text}
              </p>
            ) : dates ? (
              <DateList
                key={round}
                items={dates.checked}
                meeting={search.kind === "single"}
                kind={search.kind}
                phase={phase}
                instant={reduceMotion}
                scroll={scroll}
                onTaken={take}
                onArrived={arrived}
                onRanked={ranked}
              />
            ) : (
              done && (
                <div className="flex flex-col gap-2">
                  {/* Ways to widen the search that would find a date (#135),
                      in place of only saying there is none. */}
                  {widen.length > 0 ? (
                    <WidenSearch glass options={widen} onPick={pickWiden} />
                  ) : (
                    <p className="glass rounded-[22px] p-4 text-[15px] text-foreground">
                      {words.noneThrough}
                    </p>
                  )}
                  {/* A holiday too long for the period: the shorter stays that fit. */}
                  <LaterDates
                    loading={false}
                    fadeKey="pile"
                    search={search}
                    needsTimeOff={false}
                    suggestions={suggestions}
                    later={[]}
                    groupSize={groupSize}
                    onUseSuggestion={(s) => {
                      adoptSuggestion(s);
                      onRestart();
                    }}
                    onPick={() => {}}
                  />
                </div>
              )
            )}
          </div>

          {(done || failed) && (
            <motion.div
              className="glass mx-3 mb-3 flex flex-col gap-2 rounded-[26px] p-3"
              initial={reduceMotion ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: flying ? 0 : 1, y: 0 }}
              transition={{ duration: flying ? 0.15 : undefined }}
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
        </div>
      )}
    </>
  );
}

/**
 * The pile once pressed, as one calendar: everyone's busy time together over
 * every month the listed dates are in, on the same glass, the free days lit.
 * Drawn in place of the stacked layers once they lie aligned (lighter on a
 * phone than a layer per person per month), and moved by `scroll` alone
 * (never scrolled by hand): the list scrolls it to lift each date out.
 */
function SharedCalendar({
  frame,
  months,
  friends,
  shine,
  scroll,
}: {
  frame: Frame;
  months: number[];
  friends: { profileId: string; items: GridItem[]; color: string }[];
  shine: ReadonlySet<number>;
  scroll: MotionValue<number>;
}) {
  const y = useTransform(scroll, (v) => -v);
  const items = useMemo(() => friends.flatMap((f) => f.items), [friends]);
  const colors = useMemo(() => new Map(friends.map((f) => [f.profileId, f.color])), [friends]);
  const colorOf = useCallback((id: string) => colors.get(id) ?? "", [colors]);
  return (
    <div
      data-shared
      aria-hidden
      className="pointer-events-none fixed inset-x-0 z-40 overflow-hidden rounded-t-[28px] border border-b-0"
      style={{
        top: frame.top,
        bottom: "var(--tab-bar-height)",
        backgroundColor: `rgb(var(--glass-tint) / ${PILE_OPACITY})`,
        borderColor: "rgb(var(--glass-edge))",
      }}
    >
      <motion.div style={{ y, marginLeft: frame.left, width: frame.width }}>
        {months.map((m) => (
          <MonthLayer key={m} month={m} items={items} colorOf={colorOf} shine={shine} />
        ))}
      </motion.div>
    </div>
  );
}

/**
 * One friend's calendar, tossed onto the pile like a sheet thrown onto a
 * table (`throwSide`): it starts high above and to the side (big, close to
 * you), falls faster and faster for `land.duration`, then the hit
 * (PILE_TIMING.impact): squashed flat for an instant, a small skid past
 * where it ends up, a hop, and settling crooked. Its shadow stays on the
 * table, faint and wide while it is high, closing in and darkening as it
 * comes down. Every calendar landing on it after knocks it a little
 * (`jostle`, on a layer of its own so a knock never restarts the throw).
 * Pressed, it settles straight without a bounce, and stays: the pile is now
 * the group's calendar together, where the free days light up. Revealed,
 * only its name and its shadow go.
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
  const toss = useMemo((): {
    initial: TargetAndTransition;
    animate: TargetAndTransition;
    shadowFrom: TargetAndTransition;
    shadow: TargetAndTransition;
    transition: Transition;
  } => {
    const tilt = sheetTilt(k + 1);
    const side = throwSide(k);
    const from = side * frame.width * 0.55;
    const hit = land.duration / (land.duration + PILE_TIMING.impact);
    return {
      initial: { x: from, y: -150, rotate: side * -14, scale: 1.6, opacity: 0 },
      animate: {
        x: [from, tilt.x - side * 7, tilt.x + side * 2, tilt.x],
        y: [-150, tilt.y + 3, tilt.y - 8, tilt.y],
        rotate: [side * -14, tilt.rotate - side * 1.5, tilt.rotate + side * 0.6, tilt.rotate],
        scale: [1.6, 0.975, 1.012, 1],
        opacity: [0, 1, 1, 1],
      },
      shadowFrom: { x: from * 0.4, y: 50, scale: 1.3, opacity: 0 },
      shadow: {
        x: [from * 0.4, tilt.x - side * 7, tilt.x + side * 2, tilt.x],
        y: [50, tilt.y + 12, tilt.y + 14, tilt.y + 12],
        scale: [1.3, 0.99, 1.01, 1],
        rotate: [side * -6, tilt.rotate, tilt.rotate, tilt.rotate],
        opacity: [0, 0.38, 0.3, 0.28],
      },
      transition: {
        delay: land.at,
        duration: land.duration + PILE_TIMING.impact,
        times: [0, hit, hit + (1 - hit) * 0.4, 1],
        // Falling: faster and faster into the hit; then the hop out and back.
        ease: [[0.55, 0, 1, 0.45], "easeOut", "easeInOut"],
      },
    };
  }, [k, frame.width, land.at, land.duration]);
  const knock = jostle(k, landed);
  const place = { top: frame.top, left: frame.left, width: frame.width };
  const settle: Transition = { type: "spring", stiffness: 170, damping: 26 };

  return (
    <>
      {/* The shadow on the table, under the calendar coming down. */}
      <motion.div
        className="absolute rounded-[28px] bg-black blur-2xl"
        style={{ ...place, height: frame.height }}
        initial={toss.shadowFrom}
        animate={
          revealed
            ? { x: 0, y: 12, rotate: 0, scale: 1, opacity: 0 }
            : pressed
              ? { x: 0, y: 12, rotate: 0, scale: 1, opacity: 0.28 }
              : toss.shadow
        }
        transition={revealed || pressed ? settle : toss.transition}
      />
      <motion.div
        className="absolute"
        style={{ ...place, transformOrigin: "50% 35%" }}
        initial={toss.initial}
        animate={pressed ? { x: 0, y: 0, rotate: 0, scale: 1, opacity: 1 } : toss.animate}
        transition={pressed ? settle : toss.transition}
      >
        <motion.div
          animate={pressed ? { x: 0, rotate: 0 } : knock}
          transition={{ type: "spring", stiffness: 520, damping: pressed ? 40 : 16 }}
        >
          <div
            className="relative rounded-[28px] border"
            style={{
              backgroundColor: `rgb(var(--glass-tint) / ${alpha})`,
              borderColor: "rgb(var(--glass-edge))",
              boxShadow: "inset 0 1px 0 rgb(var(--glass-edge))",
            }}
          >
            {children}
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
    </>
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
 * checked one at a time, under one line that stays put ("Gennemgår
 * kalenderne"): a spinner on the row, then a tick (offered in the vote) or
 * a cross, and at once it moves to its place (liveOrder): a good one rises
 * among the best, the others slide down through the list to the bottom,
 * quicker and quicker until dates fly past each other. When the last has
 * settled the list is the ranking (rankOrder), numbered, and a row opens
 * to what Casy found about it.
 */
function DateList({
  items,
  meeting,
  kind,
  phase,
  instant,
  scroll,
  onTaken,
  onArrived,
  onRanked,
}: {
  items: CheckedDate[];
  meeting: boolean;
  kind: EventSettings["kind"];
  phase: Phase;
  instant: boolean;
  /** The shared calendar's scroll, which this list drives to lift each date out. */
  scroll: MotionValue<number>;
  /** A date's green circle has turned into its row: the calendar stops showing it. */
  onTaken: (day: number) => void;
  /** Every date is in the list. */
  onArrived: () => void;
  onRanked: () => void;
}) {
  const t = useT();
  const words = t.planFromCalendar;
  const { lang } = useLang();
  const rows = useRef(new Map<string, HTMLElement>());
  const [flights, setFlights] = useState<Record<string, Flight>>({});
  const [open, setOpen] = useState<string | null>(null);
  const done = phase === "done";
  const ranking = phase === "ranking";

  // The dates arriving, in their order: the shared calendar scrolls up
  // until the next date's green circle is level with its empty row, stops,
  // the circle turns into the row, and on to the next. A date already level
  // or past (two in one week) turns into its row at once; one without a
  // circle (someone gives something up for it) just appears. Measured live
  // each time, so the scroll and the rows can never disagree.
  useEffect(() => {
    if (phase !== "lifted" || instant) return;
    let stopped = false;
    let running: AnimationPlaybackControls | null = null;
    const wait = (ms: number) => new Promise((done) => window.setTimeout(done, ms));
    const circleOf = (day: number) =>
      document.querySelector(`[data-shared] [data-shine="${day}"]`)?.getBoundingClientRect();
    // A light tick for every stretch the calendar scrolls, like a wheel's detents.
    let detent = Math.floor(scroll.get() / SCROLL_TICK_PX);
    const unsubscribe = scroll.on("change", (v) => {
      const now = Math.floor(v / SCROLL_TICK_PX);
      if (now !== detent) {
        detent = now;
        haptic("tick");
      }
    });
    void (async () => {
      await wait(SCROLL_START_MS);
      for (const item of items) {
        if (stopped) return;
        const key = item.date.slot.start;
        const row = rows.current.get(key)?.getBoundingClientRect();
        let circle = circleOf(item.day);
        if (row && circle) {
          const gap = circle.top + circle.height / 2 - (row.top + row.height / 2);
          if (gap > 1) {
            running = animate(scroll, scroll.get() + gap, {
              duration: Math.min(SCROLL_MAX_S, Math.max(SCROLL_MIN_S, gap / SCROLL_PX_PER_S)),
              ease: "easeInOut",
            });
            await running;
            if (stopped) return;
            circle = circleOf(item.day);
          }
        }
        setFlights((all) => ({
          ...all,
          [key]:
            row && circle
              ? {
                  x: circle.left - row.left,
                  y: circle.top - row.top,
                  scaleX: circle.width / row.width,
                  scaleY: circle.height / row.height,
                  circle: true,
                }
              : { x: 0, y: 24, scaleX: 1, scaleY: 1, circle: false },
        }));
        onTaken(item.day);
        haptic("answer");
        await wait(ARRIVAL_PAUSE_MS);
      }
      if (!stopped) onArrived();
    })();
    return () => {
      stopped = true;
      running?.stop();
      unsubscribe();
    };
    // Runs once, as the dates start to come out.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase === "lifted", instant]);

  // The dates checked one after another, quicker and quicker (checkTimes);
  // each moves to its place the moment it is checked. Once the last has
  // settled the list is done.
  const [checked, setChecked] = useState(instant ? items.length : 0);
  useEffect(() => {
    if (!ranking || instant) return;
    const timers = checkTimes(items.length).map((at, i) =>
      window.setTimeout(() => {
        setChecked(i + 1);
        haptic("tick");
      }, at * 1000),
    );
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [ranking, instant, items.length]);
  const allChecked = checked >= items.length;
  useEffect(() => {
    if (!ranking || !allChecked) return;
    const id = window.setTimeout(onRanked, PILE_TIMING.ranked * 1000);
    return () => window.clearTimeout(id);
  }, [ranking, allChecked, onRanked]);

  const order = useMemo(() => rankOrder(items.map((i) => i.facts)), [items]);
  const shown = liveOrder(
    order,
    checked,
    items.map((i) => i.chosen),
  ).map((i) => items[i]);

  return (
    <div className="flex flex-col gap-2">
      {/* One line that stays put while the dates are checked. */}
      <div className="flex min-h-9 items-center px-1">
        {done ? (
          <motion.h2
            initial={instant ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-lg font-extrabold tracking-tight text-foreground"
          >
            {words.ranked(items.filter((i) => i.chosen).length)}
          </motion.h2>
        ) : (
          <p className="glass flex items-center gap-2 rounded-full px-3 py-1.5 text-[13px] font-medium text-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            {words.reviewing}
          </p>
        )}
      </div>

      {shown.map((item) => {
        const key = item.date.slot.start;
        const at = items.indexOf(item);
        const rank = order.indexOf(at) + 1;
        const flight = flights?.[key];
        const status =
          at < checked
            ? item.chosen
              ? "yes"
              : "no"
            : ranking && at === checked
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
            key={`${key}-${flight ? "in" : "waiting"}`}
            // Which rows the send flight moves, and which way (sendFlightPlay.ts).
            data-send-row={item.chosen ? "yes" : "no"}
            ref={(el) => {
              if (el) rows.current.set(key, el);
            }}
            // Slides to its place when checked (the others giving way), and
            // makes room when a row opens. The one just checked passes over
            // the rest.
            layout={ranking || done ? "position" : false}
            style={{
              transformOrigin: "0 0",
              zIndex: ranking && at === checked - 1 ? 10 : undefined,
            }}
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
            // Holds its place, unseen, until its date arrives.
            animate={{ x: 0, y: 0, scaleX: 1, scaleY: 1, opacity: flight || instant ? 1 : 0 }}
            transition={{
              duration: 0.55,
              delay: 0,
              ease: [0.3, 0.9, 0.3, 1],
              layout: { type: "spring", stiffness: 380, damping: 26 },
            }}
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
                transition={{ delay: 0.25, duration: 0.35 }}
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
              transition={{ delay: instant ? 0 : 0.3, duration: 0.25 }}
            >
              {/* Its place: an empty ring until it is checked, so nothing shifts. */}
              <span className="relative flex h-6 w-6 shrink-0 items-center justify-center">
                {at < checked ? (
                  <motion.span
                    key="rank"
                    initial={instant ? false : { scale: 0.4, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 22 }}
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-bold",
                      item.chosen
                        ? "bg-emerald-500 text-white"
                        : "bg-secondary text-muted-foreground",
                    )}
                  >
                    {rank}
                  </motion.span>
                ) : (
                  <span className="h-6 w-6 rounded-full border-2 border-dashed border-muted-foreground/25" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[16px] font-bold text-foreground">{label}</p>
                {meeting && (
                  <p className="text-[13px] text-muted-foreground">
                    {formatTime(item.date.slot.start)}-{formatTime(item.date.slot.end)}
                  </p>
                )}
                {/* Your own important event, found as the date is checked. */}
                {item.yours && at < checked && (
                  <motion.p
                    initial={instant ? false : { opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="mt-0.5 flex items-start gap-1 text-[12px] font-medium text-amber-800"
                  >
                    <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span className="line-clamp-2">{item.yours}</span>
                  </motion.p>
                )}
              </div>
              <StatusMark status={status} instant={instant} />
              {/* There from the start, so the marks never move; shown once a row can open. */}
              <ChevronDown
                aria-hidden
                className={cn(
                  "h-4 w-4 shrink-0 text-muted-foreground transition-[transform,opacity] duration-300",
                  done ? "opacity-100" : "opacity-0",
                  isOpen && "rotate-180",
                )}
              />
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
