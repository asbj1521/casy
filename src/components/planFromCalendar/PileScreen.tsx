import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { motion, useMotionValue, useReducedMotion, type Variants } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";

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
import { comfortNotes } from "@/lib/comfortNotes";
import { edgeWarnings } from "@/lib/earlyMorning";
import { impactOn } from "@/lib/eventImpact";
import { clashSentence, importantClashes } from "@/lib/eventWarnings";
import { SEARCH_WINDOW } from "@/lib/eventSearch";
import { nameList } from "@/lib/format";
import { haptic } from "@/lib/haptics";
import { showHomeBarForFlight } from "@/lib/homeBar";
import type { GridItem } from "@/lib/monthGrid";
import { monthScrollTop } from "@/lib/monthScroll";
import { bigOnNewYearsDay } from "@/lib/newYear";
import {
  buildPile,
  candidateMonth,
  layerAlpha,
  PILE_TIMING,
  pileTimeline,
  type PileOptions,
  type PileSheet,
} from "@/lib/paperPile";
import { playSendFlight } from "@/lib/sendFlightPlay";
import { cn } from "@/lib/utils";
import type { WidenOption } from "@/lib/widen";
import { addDays, dayOf, localDate, startOfMonth, wallTime } from "@/lib/zone";
import {
  type Phase,
  atLeast,
  LIST_MAX,
  FRIEND_COLORS,
  PRESS_PX,
  type Frame,
  type CheckedDate,
  NO_INPUT,
  titleBand,
} from "./pile/shared";
import DateList from "./pile/DateList";
import PileTitle, { NoShortName } from "./pile/PileTitle";
import SharedCalendar from "./pile/SharedCalendar";
import ThrownLayer from "./pile/ThrownLayer";

/**
 * A week row of a layer, pressed down once as the press passes from the
 * middle out. Variants, set off by the layer's own "pressed" (below), so the
 * press moves the rows without React drawing every layer's month again (#162).
 */
const PRESS_ROW: Variants = {
  rest: { y: 0 },
  pressed: ({ w, count }: { w: number; count: number }) => {
    const middle = (count - 1) / 2;
    const away = Math.abs(w - middle);
    return {
      y: [0, PRESS_PX * (1 - away / (middle + 1)), 0],
      transition: { duration: 0.55, delay: away * 0.08, ease: "easeInOut" },
    };
  },
};
const pressRow = (w: number, count: number, row: ReactNode) => (
  <motion.div key={w} custom={{ w, count }} variants={PRESS_ROW}>
    {row}
  </motion.div>
);
/** The same each render, so the layers' months (memoised) aren't drawn again. */
const NO_SHORT_NAME = <NoShortName />;
const NO_ITEMS: GridItem[] = [];
const NO_COLOR = () => "";
/** The close button's size (p-2 round a 20px icon), and the room it keeps above the pile. */
const CLOSE_PX = 36;
const CLOSE_GAP_PX = 8;

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
    const { pool, chosen, byPick, comfort } = rankFromPool(
      poolFound,
      participants,
      search,
      {
        first: { slot: found.slot, conflicts: found.conflicts },
        end: searchWindow.end,
        count: extras.dateCount,
        scores,
        profile,
      },
      TZ,
    );
    // Not offered, but listed as other dates that work: never a big plan on 1 January (#166).
    const others = pool.filter(
      (d) =>
        !chosen.includes(d) &&
        d.conflicts.length === 0 &&
        !bigOnNewYearsDay(profile, d.slot, search, TZ),
    );
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
      // What the comfort rules found (#178): room around it, the morning
      // after, the days kept for family; each said once, never what the
      // warnings above already say.
      const comfortLines = comfortNotes(comfort.get(date)?.penalties ?? [], {
        nameOf: (id) => participants.find((p) => p.profileId === id)?.name ?? "",
        youId: youProfileId,
        lang,
        words: words.comfort,
        warnings,
      });
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
          ...comfortLines.map((n) => ({ found: n.text, notable: n.notable })),
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
  // Built from the listed dates' starts alone: the scores and the event's
  // profile arriving mid-throw change what is said about each date, not
  // which dates there are, and must not rebuild every layer (#162).
  const listedStarts = dates?.checked.map((d) => d.date.slot.start).join(",") ?? "";
  const pile = useMemo(() => {
    if (!participants) return null;
    const opts: PileOptions = {
      timeZone: TZ,
      todayMs: Date.parse(TODAY),
      windowEndMs: Date.parse(SEARCH_WINDOW.end),
      locale: LOCALE[lang],
      window: searchWindow,
    };
    const listed = listedStarts ? listedStarts.split(",") : [];
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
        const color = FRIEND_COLORS[k % FRIEND_COLORS.length];
        // Made once, so a layer's months (memoised) never redraw on the pile's clock.
        return { ...s, items, color, colorOf: () => color };
      });
    return { month: first, months, shine, friends };
  }, [participants, listedStarts, search, searchWindow, youProfileId, lang]);

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
    const target = el && scroller ? monthScrollTop(scroller, el) : 0;
    const scrolls = !!scroller && Math.abs(scroller.scrollTop - target) > 1;
    if (scrolls) scroller.scrollTo({ top: target, behavior: "smooth" });
    // Measured once the scroll has settled; at once if the month is already there.
    const id = window.setTimeout(
      () => {
        const r = el?.getBoundingClientRect();
        const t = document.querySelector("[data-month-title]")?.getBoundingClientRect();
        const title = t && r && t.top < r.top ? { top: t.top, left: t.left } : null;
        setFrame(
          r
            ? { month, top: r.top, left: r.left, width: r.width, height: r.height, title }
            : { month, top: 96, left: 0, width: window.innerWidth, height: 600, title: null },
        );
      },
      scrolls ? 450 : 0,
    );
    return () => window.clearTimeout(id);
  }, [month, reduceMotion]);

  // The clock, from the moment the month is in place, up to the dates being
  // lifted out; from there the list runs it: the scroll that lifts each date
  // into it (onArrived), then the checks (onRanked).
  const [phase, setPhase] = useState<Phase>(reduceMotion ? "done" : "landing");
  const [landed, setLanded] = useState(0);
  const others = pile?.friends.length ?? 0;
  const timeline = useMemo(() => pileTimeline(others, 0, PILE_TIMING.inPlace), [others]);
  // The throw starts as soon as the month is in place. The scores are asked
  // meanwhile and only needed by the list, so the lift waits (briefly) for
  // them instead, and the list is ranked by them from the start (#162).
  const ready = !!frame && !!pile;
  const [liftDue, setLiftDue] = useState(false);
  if (liftDue && scoresSettled && phase === "revealed") setPhase("lifted");
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
    at(timeline.liftAt, () => setLiftDue(true));
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
  // The dates sent (#102): the ones not sent swipe off to the right and the
  // ones sent fly down into the home page's Aftaler button, copies of the
  // rows moving over the page, while the real rows are hidden; then, once the
  // server has answered too, the plan closes onto the home page (#169). The
  // flight starts as they go, not after the answer (#162). Reduced motion
  // closes it at once. The
  // home page's buttons, hidden while the plan is open, come back for it
  // (#169), and stay until the pile is gone.
  const [flying, setFlying] = useState(false);
  const listBox = useRef<HTMLDivElement>(null);
  const { setBeforeLeaving } = planning;
  useEffect(() => {
    if (reduceMotion) return;
    setBeforeLeaving((landed) => {
      const rows = [...(listBox.current?.querySelectorAll<HTMLElement>("[data-send-row]") ?? [])];
      showHomeBarForFlight(true);
      void playSendFlight(
        rows.map((el) => ({ el, offered: el.dataset.sendRow === "yes" })),
        document.querySelector<HTMLElement>('[data-tab-icon="/events"]'),
        () => setFlying(true),
      ).finally(landed);
      // The send failed: the list comes back, with the reason under it.
      return () => {
        setFlying(false);
        showHomeBarForFlight(false);
      };
    });
    return () => setBeforeLeaving(null);
  }, [reduceMotion, setBeforeLeaving]);
  // The buttons go back to hiding behind the plan only once the pile is gone.
  useEffect(() => () => showHomeBarForFlight(false), []);
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

  // The pile reaches up to the page's big month name and names its month
  // there alone: the small name over the 1st gives way (#162).
  const band = frame ? titleBand(frame) : 0;
  const card = useMemo(
    () => frame && { ...frame, top: frame.top - band, height: frame.height + band },
    [frame, band],
  );
  const shortName = band > 0 ? NO_SHORT_NAME : undefined;

  return (
    <>
      {/* The layers, over My calendar's month, until the dates are lifted out: then the shared calendar below. */}
      {frame && card && pile && !reduceMotion && !lifted && (
        <div
          data-pile
          aria-hidden
          className="pointer-events-none fixed inset-0 z-40 overflow-hidden"
        >
          {pile.friends.map((friend, k) => (
            <ThrownLayer
              key={friend.profileId}
              k={k}
              frame={card}
              land={timeline.lands[k]}
              landed={landed}
              pressed={pressed}
              revealed={revealed}
              alpha={alpha}
              name={friend.name}
              color={friend.color}
            >
              <PileTitle frame={frame} month={pile.month} />
              {/* Its rows pressed by PRESS_ROW when this turns "pressed". */}
              <motion.div initial={false} animate={pressed ? "pressed" : "rest"}>
                <MonthLayer
                  month={pile.month}
                  items={friend.items}
                  colorOf={friend.colorOf}
                  wrapRow={pressRow}
                  heading={shortName}
                />
              </motion.div>
            </ThrownLayer>
          ))}

          {/* What shines through: the days free for everyone. There from the
              start, unseen, so revealing it draws nothing new mid-press. */}
          <motion.div
            className="absolute"
            style={{ top: card.top, left: frame.left, width: frame.width }}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={revealed ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <PileTitle frame={frame} month={null} />
            <MonthLayer
              month={pile.month}
              items={NO_ITEMS}
              colorOf={NO_COLOR}
              shine={pile.shine}
              heading={shortName}
            />
          </motion.div>
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
        // Over the list and its blur, which soften the header buttons it sits
        // on, and clear of the pile's top edge, which reaches up to the month name.
        className={cn(
          "glass fixed right-3 z-[60] rounded-full p-2 text-foreground",
          flying && "opacity-0",
        )}
        style={{
          top: card
            ? `clamp(env(safe-area-inset-top), ${card.top - CLOSE_PX - CLOSE_GAP_PX}px, calc(env(safe-area-inset-top) + 0.5rem))`
            : "calc(env(safe-area-inset-top) + 0.5rem)",
        }}
      >
        <X className="h-5 w-5" />
      </button>

      {/* The dates, flown up into a list over the calendar, checked one by one. */}
      {(lifted || failed) && (
        // Over everything. While the dates arrive the
        // calendar scrolls by in plain view, the header buttons above it
        // already softened; once they all have, the calendar softens too
        // behind the list so the list reads.
        <div
          className={cn(
            "fixed inset-0 z-50 flex flex-col pt-[calc(env(safe-area-inset-top)+3.5rem)]",
            flying && "pointer-events-none",
          )}
        >
          <motion.div
            aria-hidden
            className="absolute inset-x-0 top-0 -z-10 bg-background/50 backdrop-blur-[3px]"
            style={{ height: card?.top ?? 0 }}
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
          />
          <motion.div
            aria-hidden
            className="absolute inset-x-0 bottom-0 -z-10 bg-background/50 backdrop-blur-[3px]"
            style={{ top: card?.top ?? 0 }}
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
