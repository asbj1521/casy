import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { useLang, useT } from "@/i18n/lang";
import { addDays } from "@/lib/zone";
import PaperCalendar from "./phone/PaperCalendar";
import PaperStack from "./phone/PaperStack";
import PeopleJoining from "./phone/PeopleJoining";
import PhoneDates from "./phone/PhoneDates";
import PhoneDevice from "./phone/PhoneDevice";
import PhoneGroup from "./phone/PhoneGroup";
import PhoneHome from "./phone/PhoneHome";
import PhoneVote from "./phone/PhoneVote";
import TravelBox, { FLIGHT_S, type BoxStage } from "./phone/TravelBox";
import { dayCell, listScrolls } from "./phone/dayCell";
import {
  demoMonth,
  demoPlan,
  demoVote,
  EVENT_CALENDAR,
  FRIENDS,
  GROUP_NAME,
  TZ,
} from "./phone/demo";
import { DEVICE } from "./phone/geometry";
import { STACK_DONE, THROWS } from "./phone/throws";

/** How the phone stands: `y` a share of the stage's height, `scale` of its fitted size, degrees. */
const POSE = {
  /** Before anything, under the stage. */
  below: { y: 1.05, scale: 1, rotateY: 0, rotate: 0 },
  /** Facing you, room around it for the faces and the paper. */
  flat: { y: 0, scale: 1, rotateY: 0, rotate: 0 },
  /** A little smaller and lower, all of it in view, under a headline. */
  framed: { y: 0.09, scale: 0.86, rotateY: 0, rotate: 0 },
  /** The same, turned a little as you answer, its side showing. */
  turned: { y: 0.09, scale: 0.86, rotateY: -11, rotate: 2 },
};
const POSE_SPRING = { type: "spring", stiffness: 90, damping: 20 } as const;

/** Where the colour shape lies behind the phone, as shares of its panel. */
const SHAPE = {
  under: { x: "-8%", y: "34%", rotate: -14, scale: 1.05, opacity: 1 },
  gone: { x: "-8%", y: "20%", rotate: 8, scale: 1, opacity: 0 },
};

/** When a friend's face pops up around the phone and when it leaves for its row. */
const POP_AT = FRIENDS.map((_, i) => 0.3 + i * 0.13);
const FLY_AT = FRIENDS.map((_, i) => 1.35 + i * 0.13);
const FLY_FOR = 0.42;

/** The paper's weeks dissolving into the month under it, from the middle out. */
const DISSOLVE_S = 1.15;

/** One screen of the phone giving way to the next, zooming on the date when a day opens or closes. */
const SCREEN_MOVE = { duration: 0.48, ease: [0.32, 0.72, 0, 1] } as const;

const AT = (() => {
  const joined = FLY_AT.map((at) => at + FLY_FOR);
  // The members' card grows into the page the month appears on.
  const leave = joined[joined.length - 1] + 0.4;
  const home = leave + 0.42;
  const throwsAt = home + 0.3;
  const thrown = THROWS.map((th) => throwsAt + th.at);
  const landed = THROWS.map((th) => throwsAt + th.landed);
  // Squared up, one sheet with everyone's pen on it, then that dissolving.
  const squared = throwsAt + STACK_DONE + 0.15;
  const merged = squared + 0.45;
  const digital = merged + 0.2;
  const dissolve = digital + 0.15;
  const press = dissolve + DISSOLVE_S - 0.1;
  const shine = press + 0.35;
  // The free days lifted out one by one into a list, under the words.
  const list = shine + 0.9;
  const scrolls = [0, 1, 2].map((i) => list + 0.3 + i * 0.72);
  const taken = scrolls.map((at) => at + 0.45);
  const button = taken[2] + 0.4;
  const pressed = button + 0.75;
  // The button moves down to become the pill as the dates fly into Aftaler.
  const sent = pressed + 0.3;
  const back = sent + 0.3;
  const badge = sent + 0.85;
  const pillPressed = badge + 0.55;
  // The pill grows into the vote's panel as the month zooms into the day.
  const vote = pillPressed + 0.22;
  const answers = [vote + 1.35, vote + 2.3, vote + 3.15];
  // The panel becomes the agreed card, the card the circle, the circle lands.
  const agreed = answers[2] + 0.7;
  const collapsed = agreed + 1.5;
  const flying = collapsed + 0.45;
  const landing = flying + FLIGHT_S;
  return {
    joined,
    leave,
    home,
    throwsAt,
    thrown,
    landed,
    squared,
    merged,
    digital,
    dissolve,
    press,
    shine,
    list,
    scrolls,
    taken,
    button,
    pressed,
    sent,
    back,
    badge,
    pillPressed,
    vote,
    answers,
    agreed,
    collapsed,
    flying,
    landing,
    end: landing + 2,
  };
})();
const MOMENTS = [
  ...AT.joined,
  AT.leave,
  AT.home,
  ...AT.thrown,
  ...AT.landed,
  AT.squared,
  AT.merged,
  AT.digital,
  AT.dissolve,
  AT.press,
  AT.shine,
  AT.list,
  ...AT.scrolls,
  ...AT.taken,
  AT.button,
  AT.pressed,
  AT.sent,
  AT.back,
  AT.badge,
  AT.pillPressed,
  AT.vote,
  ...AT.answers,
  AT.agreed,
  AT.collapsed,
  AT.flying,
  AT.landing,
].sort((a, b) => a - b);

/**
 * The app's welcome animation (#228), every step something Casy does, on a real
 * phone: your friends join a group; their paper calendars are thrown on, one
 * after another, become one sheet and dissolve into the real month; the days
 * free for everyone light up and are lifted into a list of possible dates; those
 * are sent off for a vote; you answer it; the agreed date lands in its day. Then
 * it runs on from the top. Each step hands on to the next through something they
 * share: the members' card grows into the page, a circle stretches into a row,
 * and one box (TravelBox) is the send button, the pill, the vote and the agreed
 * date. Under reduced motion, a still of the phone with the days lit.
 */
export default function WelcomeStage() {
  const t = useT();
  const { lang } = useLang();
  const still = useReducedMotion() ?? false;

  const stage = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;
    const measure = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Where in the round it is, as the last moment reached.
  const [round, setRound] = useState(0);
  const [reached, setReached] = useState({ round: 0, at: 0 });
  const now = still ? AT.shine : reached.round === round ? reached.at : 0;
  useEffect(() => {
    if (still) return;
    const timers = MOMENTS.map((at) => setTimeout(() => setReached({ round, at }), at * 1000));
    timers.push(setTimeout(() => setRound((r) => r + 1), AT.end * 1000));
    return () => timers.forEach(clearTimeout);
  }, [round, still]);

  const [month] = useState(() => demoMonth(Date.now()));
  const plan = useMemo(() => demoPlan(month), [month]);
  const vote = useMemo(() => demoVote(plan.free, t.welcome.event), [plan, t.welcome.event]);
  const everyone = useMemo(() => plan.items.flat(), [plan]);
  const yours = plan.items[0];
  const agreedDay = plan.free[0];
  const withEvent = useMemo(
    () => [
      {
        calendarId: EVENT_CALENDAR,
        start: agreedDay,
        end: addDays(agreedDay, 1, TZ),
        label: t.welcome.event,
      },
      ...everyone,
    ],
    [agreedDay, everyone, t.welcome.event],
  );
  const scrolls = useMemo(() => listScrolls(plan.free, month, lang), [plan, month, lang]);
  const zoomOn = useMemo(() => dayCell(agreedDay, month, lang), [agreedDay, month, lang]);

  const count = (moments: number[]) => moments.filter((at) => now >= at).length;
  const joined = count(AT.joined);
  const thrown = count(AT.thrown);
  const landed = count(AT.landed);
  const taken = count(AT.taken);
  const scrolled = count(AT.scrolls);
  const answered = count(AT.answers);
  // The days still lit are the ones not yet lifted out into their rows.
  const lit = useMemo(() => new Set(plan.free.slice(taken)), [plan, taken]);

  const voting = now >= AT.vote && now < AT.agreed;
  const listing = now >= AT.list && now < AT.vote;
  const onScreen = now < AT.home ? "group" : voting ? "vote" : "home";

  // A line over the phone says what is going on: possible dates, then the vote.
  const headline = listing ? t.welcome.candidates : voting ? t.welcome.voting : null;
  const pose = voting ? POSE.turned : listing ? POSE.framed : POSE.flat;
  const shape = now < AT.home || voting ? SHAPE.under : SHAPE.gone;
  const scale = Math.min((size.height * 0.92) / DEVICE.height, (size.width * 0.62) / DEVICE.width);
  const place = (p: typeof pose) => ({ ...p, y: p.y * size.height, scale: p.scale * scale });

  const items = now >= AT.landing ? withEvent : now >= AT.digital ? everyone : yours;
  const pressing = !still && ((now >= AT.press && now < AT.list) || now >= AT.landing);
  const boxStage: BoxStage | null =
    now < AT.button
      ? null
      : now < AT.sent
        ? "button"
        : now < AT.vote
          ? "pill"
          : now < AT.agreed
            ? "panel"
            : now < AT.collapsed
              ? "card"
              : now < AT.flying
                ? "ball"
                : now < AT.landing
                  ? "flying"
                  : "landed";
  const boxPressed =
    (now >= AT.pressed && now < AT.sent) || (now >= AT.pillPressed && now < AT.vote);

  return (
    <div
      ref={stage}
      aria-hidden
      inert
      className="pointer-events-none relative h-full overflow-hidden"
    >
      <div className="absolute inset-0" style={{ perspective: size.height * 1.9 }}>
        {/* The colour shape, in a panel of its own that fades out at the bottom. */}
        <div className="absolute inset-x-[5%] bottom-0 top-3 overflow-hidden rounded-[28px]">
          <motion.div
            className="absolute inset-x-[-30%] top-0"
            style={{ aspectRatio: "1 / 0.9" }}
            initial={still ? SHAPE.gone : { ...SHAPE.under, y: "90%", opacity: 0 }}
            animate={still ? SHAPE.gone : shape}
            transition={{
              type: "spring",
              stiffness: 50,
              damping: 16,
              // Gone before it has swept away, so it leaves no dark trail behind.
              opacity: { duration: 0.35, ease: "easeOut" },
            }}
          >
            <div
              className="absolute inset-0 rounded-[46%]"
              style={{
                background:
                  "radial-gradient(circle at 74% 26%, #ffd60a 0, transparent 44%), radial-gradient(circle at 82% 78%, #ff2d78 0, transparent 50%), linear-gradient(135deg, #fb923c, #f43f5e)",
              }}
            />
            <div
              className="absolute inset-x-[-6%] top-[52%] h-[70%] rounded-[50%]"
              style={{
                background:
                  "radial-gradient(circle at 20% 20%, #fbbf24 0, transparent 60%), linear-gradient(120deg, #f97316, #ec4899)",
              }}
            />
          </motion.div>
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background to-transparent" />
        </div>

        {/* The line over the phone, one giving way to the next in the same place. */}
        <AnimatePresence>
          {headline && !still && (
            <motion.p
              key={headline}
              className="absolute inset-x-4 top-[3%] text-center text-[2.5rem] font-bold leading-[1.05] tracking-tight text-foreground large-text:text-[1.875rem]"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.34 }}
            >
              {headline}
            </motion.p>
          )}
        </AnimatePresence>

        {/* The phone, centred and turned as one. */}
        {scale > 0 && (
          <motion.div
            className="absolute left-1/2 top-1/2"
            style={{
              width: DEVICE.width,
              height: DEVICE.height,
              marginLeft: -DEVICE.width / 2,
              marginTop: -DEVICE.height / 2,
              transformStyle: "preserve-3d",
            }}
            initial={still ? false : place(POSE.below)}
            animate={still ? place(POSE.flat) : place(pose)}
            transition={still ? { duration: 0 } : POSE_SPRING}
          >
            <PhoneDevice
              over={
                !still && (
                  <>
                    {now < AT.leave && (
                      <PeopleJoining key={round} popAt={POP_AT} flyAt={FLY_AT} flyFor={FLY_FOR} />
                    )}
                    {thrown > 0 && now < AT.digital && (
                      <PaperStack
                        thrown={thrown}
                        landed={landed}
                        squared={now >= AT.squared}
                        month={month}
                        items={everyone}
                      />
                    )}
                    {/* The pile, squared, become one sheet with everyone's pen on it. */}
                    {now >= AT.merged && now < AT.press + 0.5 && (
                      <motion.div
                        className="absolute inset-0"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.2 }}
                      >
                        <PaperCalendar
                          month={month}
                          items={everyone}
                          title={GROUP_NAME}
                          dissolve={now >= AT.dissolve}
                        />
                      </motion.div>
                    )}
                  </>
                )
              }
            >
              <AnimatePresence initial={false} custom={onScreen}>
                <motion.div
                  key={onScreen}
                  className="absolute inset-0"
                  style={{ transformOrigin: `${zoomOn.x}px ${zoomOn.y}px` }}
                  custom={onScreen}
                  variants={{
                    // The month zooms up into a day, and the day back down into the month.
                    leave: (to: string) => ({
                      opacity: 0,
                      scale: to === "vote" ? 1.5 : to === "home" ? 0.6 : 1,
                    }),
                  }}
                  initial={
                    onScreen === "vote"
                      ? { opacity: 0, scale: 0.6 }
                      : onScreen === "home" && now >= AT.agreed
                        ? { opacity: 0, scale: 1.5 }
                        : { opacity: 0, scale: 1 }
                  }
                  animate={{ opacity: 1, scale: 1 }}
                  exit="leave"
                  transition={SCREEN_MOVE}
                >
                  {onScreen === "group" && (
                    <PhoneGroup joined={joined} leaving={now >= AT.leave} arriving={round > 0} />
                  )}
                  {onScreen === "vote" && <PhoneVote event={vote} answered={answered} />}
                  {onScreen === "home" && (
                    <PhoneHome
                      month={month}
                      items={items}
                      pressed={pressing}
                      shine={now >= AT.shine && now < AT.vote ? lit : null}
                      scroll={listing && now < AT.back && scrolled > 0 ? scrolls[scrolled - 1] : 0}
                      dim={listing && now < AT.back}
                      badge={now >= AT.badge && now < AT.vote}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
              {listing && !still && (
                <PhoneDates
                  event={vote}
                  days={plan.free}
                  month={month}
                  taken={taken}
                  sent={now >= AT.sent}
                />
              )}
              <AnimatePresence>
                {boxStage && !still && (
                  <motion.div
                    className="absolute inset-0"
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.28 }}
                  >
                    <TravelBox
                      event={vote}
                      day={agreedDay}
                      month={month}
                      stage={boxStage}
                      pressed={boxPressed}
                      answered={answered}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </PhoneDevice>
          </motion.div>
        )}
      </div>
    </div>
  );
}
