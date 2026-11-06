import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { useT } from "@/i18n/lang";
import { addDays } from "@/lib/zone";
import AgreedMoment from "./phone/AgreedMoment";
import PaperStack, { TURN_ALL, TURN_COVERED, TurnDigital } from "./phone/PaperStack";
import { STACK_DONE, THROWS } from "./phone/throws";
import PeopleJoining from "./phone/PeopleJoining";
import PhoneDevice from "./phone/PhoneDevice";
import PhoneGroup from "./phone/PhoneGroup";
import PhoneHome from "./phone/PhoneHome";
import PhoneVote from "./phone/PhoneVote";
import { demoMonth, demoPlan, demoVote, EVENT_CALENDAR, FRIENDS, TZ } from "./phone/demo";
import { DEVICE } from "./phone/geometry";

/** How the phone stands: `y` a share of the stage's height, `scale` of its fitted size, degrees. */
const POSE = {
  /** Before anything, under the stage. */
  below: { y: 1.05, scale: 1, rotateY: 0, rotate: 0 },
  /** Facing you, room around it for the faces and the paper. */
  flat: { y: 0, scale: 1, rotateY: 0, rotate: 0 },
  /** Answering: turned a little, its side showing. */
  turned: { y: 0, scale: 1.02, rotateY: -13, rotate: 2.5 },
};
const POSE_SPRING = { type: "spring", stiffness: 110, damping: 20 } as const;

/** Where the colour shape lies behind the phone, as shares of its panel. */
const SHAPE = {
  under: { x: "-8%", y: "34%", rotate: -14, scale: 1.05, opacity: 1 },
  above: { x: "-14%", y: "-46%", rotate: 22, scale: 1.1, opacity: 1 },
  gone: { x: "-8%", y: "20%", rotate: 8, scale: 1, opacity: 0 },
};

/** When a friend's face pops up around the phone and when it leaves for its row. */
const POP_AT = FRIENDS.map((_, i) => 0.3 + i * 0.13);
const FLY_AT = FRIENDS.map((_, i) => 1.35 + i * 0.13);
const FLY_FOR = 0.42;

const AT = (() => {
  const joined = FLY_AT.map((at) => at + FLY_FOR);
  const home = joined[joined.length - 1] + 0.5;
  const throwsAt = home + 0.35;
  const landed = THROWS.map((th) => throwsAt + th.landed);
  const squared = throwsAt + STACK_DONE + 0.12;
  const turn = squared + 0.28;
  const digital = turn + TURN_COVERED;
  const press = turn + TURN_ALL - 0.2;
  const shine = press + 0.4;
  const words = shine + 1.5;
  const vote = words + 1.5;
  const answers = [vote + 1.2, vote + 2.05, vote + 2.75];
  const agreed = answers[2] + 0.55;
  const flying = agreed + 1.5;
  const event = flying + 0.55;
  return {
    joined,
    home,
    throwsAt,
    landed,
    squared,
    turn,
    digital,
    press,
    shine,
    words,
    vote,
    answers,
    agreed,
    flying,
    event,
    end: event + 1.7,
  };
})();
const MOMENTS = [
  ...AT.joined,
  AT.home,
  AT.throwsAt,
  ...AT.landed,
  AT.squared,
  AT.turn,
  AT.digital,
  AT.press,
  AT.shine,
  AT.words,
  AT.vote,
  ...AT.answers,
  AT.agreed,
  AT.flying,
  AT.event,
].sort((a, b) => a - b);

/**
 * The app's welcome animation (#228), every step something Casy does, on a real
 * phone: your friends join a group; their paper calendars are thrown on, faster
 * and faster, and turn digital together; the days free for everyone light up;
 * you answer a vote; the agreed date lands in its day. Then it runs on from the
 * top with no fade. Under reduced motion, a still of the phone with the days lit.
 */
export default function WelcomeStage() {
  const t = useT();
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
  const shine = useMemo(() => new Set(plan.free), [plan]);
  const agreedShine = useMemo(() => new Set([plan.free[0]]), [plan]);
  const vote = useMemo(
    () => demoVote(plan.free, t.welcome.event, t.welcome.group),
    [plan, t.welcome.event, t.welcome.group],
  );
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

  const joined = AT.joined.filter((at) => now >= at).length;
  const landed = AT.landed.filter((at) => now >= at).length;
  const answered = AT.answers.filter((at) => now >= at).length;
  const voting = now >= AT.vote && now < AT.agreed;
  const onScreen = now < AT.home ? "group" : voting ? "vote" : "home";

  const hidden = now >= AT.words && now < AT.vote;
  const pose = voting ? POSE.turned : hidden ? POSE.below : POSE.flat;
  const shape = now < AT.home ? SHAPE.under : voting ? SHAPE.above : SHAPE.gone;
  const scale = Math.min((size.height * 0.92) / DEVICE.height, (size.width * 0.62) / DEVICE.width);
  const place = (p: typeof pose) => ({ ...p, y: p.y * size.height, scale: p.scale * scale });

  const items = now >= AT.event ? withEvent : now >= AT.digital ? everyone : yours;

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

        {/* The big words, alone on a plain page, while the phone is away. */}
        <AnimatePresence>
          {hidden && !still && (
            <motion.div
              className="absolute inset-x-6 top-0 flex h-full items-center justify-center"
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.04 }}
              transition={{ duration: 0.32, delay: 0.1 }}
            >
              <p className="text-balance text-center text-[3rem] font-bold leading-[1.05] tracking-tight text-foreground">
                {t.welcome.allCan}
              </p>
            </motion.div>
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
                    {now < AT.home && (
                      <PeopleJoining key={round} popAt={POP_AT} flyAt={FLY_AT} flyFor={FLY_FOR} />
                    )}
                    {now >= AT.throwsAt && now < AT.digital && (
                      <PaperStack
                        landed={landed}
                        squared={now >= AT.squared}
                        month={month}
                        items={everyone}
                      />
                    )}
                    {now >= AT.turn && now < AT.press + 0.4 && <TurnDigital />}
                  </>
                )
              }
            >
              <AnimatePresence initial={false}>
                <motion.div
                  key={onScreen}
                  className="absolute inset-0"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.28 }}
                >
                  {onScreen === "group" && <PhoneGroup joined={joined} />}
                  {onScreen === "vote" && <PhoneVote event={vote} answered={answered} />}
                  {onScreen === "home" && (
                    <PhoneHome
                      month={month}
                      items={items}
                      pressed={!still && now >= AT.press && now < AT.words}
                      shine={
                        now >= AT.event
                          ? agreedShine
                          : now >= AT.shine && now < AT.agreed
                            ? shine
                            : null
                      }
                    />
                  )}
                </motion.div>
              </AnimatePresence>
              {now >= AT.agreed && now < AT.event + 0.1 && (
                <AgreedMoment
                  event={vote}
                  day={agreedDay}
                  month={month}
                  flying={now >= AT.flying}
                />
              )}
            </PhoneDevice>
          </motion.div>
        )}
      </div>
    </div>
  );
}
