import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { useLang, useT } from "@/i18n/lang";
import Friends, { FLY_FOR, SEND_FOR, type FriendState } from "./phone/Friends";
import PaperCalendar from "./phone/PaperCalendar";
import PaperStack from "./phone/PaperStack";
import PhoneDates from "./phone/PhoneDates";
import PhoneDevice from "./phone/PhoneDevice";
import PhoneGroup from "./phone/PhoneGroup";
import PhoneHome from "./phone/PhoneHome";
import PhoneVote from "./phone/PhoneVote";
import TravelBox, { FLIGHT_S, type BoxStage } from "./phone/TravelBox";
import { dayCell, listScrolls } from "./phone/dayCell";
import { demoMonth, demoPlan, demoVote, FRIENDS, GROUP_NAME } from "./phone/demo";
import { DEVICE } from "./phone/geometry";
import { rectOfCard, type MorphRect } from "./phone/morph";
import { STACK_DONE, THROWS } from "./phone/throws";

/** How the phone stands: `y` a share of the stage's height, `scale` of its fitted size, degrees. */
const POSE = {
  /** Before anything, under the stage. */
  below: { y: 1.05, scale: 1, rotateY: 0, rotate: 0 },
  /** Facing you, room around it for the faces and the paper. */
  flat: { y: 0, scale: 1, rotateY: 0, rotate: 0 },
  /** All of it in view under a headline: where it stands and how big comes from the room left. */
  framed: { y: 0, scale: 1, rotateY: 0, rotate: 0 },
  /** The same, turned a little as you answer, its side showing. */
  turned: { y: 0, scale: 1, rotateY: -11, rotate: 2 },
};
/** The headline's distance from the top of the stage, in px. */
const HEADLINE_TOP = 12;
const HEADLINE_TEXT =
  "text-balance text-center text-[2rem] font-bold leading-[1.08] tracking-tight text-foreground large-text:text-[1.5rem]";

const POSE_SPRING = { type: "spring", stiffness: 90, damping: 20 } as const;

/**
 * Where the colour shape lies behind the phone, as shares of its panel: one place
 * for each way the phone stands, so it moves only when the phone does, and with
 * it. Never so high that it runs behind a headline.
 */
const SHAPE = {
  flat: { x: "-8%", y: "34%", rotate: -14, scale: 1.05 },
  list: { x: "-16%", y: "38%", rotate: 20, scale: 1.05 },
  vote: { x: "-4%", y: "30%", rotate: -22, scale: 1.1 },
  agreed: { x: "-24%", y: "42%", rotate: 6, scale: 1.05 },
  finale: { x: "2%", y: "32%", rotate: -6, scale: 1.15 },
};

/** When a friend's face pops up around the phone and when it leaves for its row. */
const POP_AT = FRIENDS.map((_, i) => 0.3 + i * 0.13);
const FLY_AT = FRIENDS.map((_, i) => 1.35 + i * 0.13);

/** The paper's weeks dissolving into the month under it, from the middle out. */
const DISSOLVE_S = 1.15;

/** One screen of the phone giving way to the next, zooming on the date when a day opens or closes. */
const SCREEN_MOVE = { duration: 0.48, ease: [0.32, 0.72, 0, 1] } as const;

/** How long the end stays once all have it: long enough to take in, it is what all of it led up to. */
const FINALE_HOLD_S = 2;

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
  const merged = squared + 0.2;
  const digital = merged + 0.28;
  const dissolve = digital + 0.22;
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
  // The date is in; then the phone steps back and it goes out to everyone.
  const thudDone = landing + 0.2;
  const finale = landing + 0.75;
  const sends = FRIENDS.map((_, i) => finale + 0.55 + i * 0.17);
  const arrived = sends.map((at) => at + SEND_FOR);
  // It stays a while, then the tiles go and the phone grows back under the faces.
  const finaleOut = arrived[arrived.length - 1] + FINALE_HOLD_S;
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
    thudDone,
    finale,
    sends,
    arrived,
    finaleOut,
    end: finaleOut + 0.28,
  };
})();
const MOMENTS = [
  ...POP_AT,
  ...FLY_AT,
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
  AT.thudDone,
  AT.finale,
  ...AT.sends,
  ...AT.arrived,
  AT.finaleOut,
].sort((a, b) => a - b);

/** The colour shape spread out to fill the screen, behind the sign-in card. */
const SHAPE_FILL = { x: "-15%", y: "-6%", rotate: -8, scale: 1.7 };
const SHAPE_COLORS =
  "radial-gradient(circle at 74% 26%, #ffd60a 0, transparent 44%), radial-gradient(circle at 82% 78%, #ff2d78 0, transparent 50%), linear-gradient(135deg, #fb923c, #f43f5e)";
const MORPH_SPRING = { type: "spring", stiffness: 170, damping: 24 } as const;
/** How long the box stands in for the card or the phone, until the real one has appeared over it. */
const MORPH_S = 0.95;

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
 *
 * `leaving` is sign-in opening over it: wherever the animation had got to, the
 * phone turns into the sign-in card and the colour spreads to fill the screen and
 * stays behind it. Going back does the same the other way, and it starts over.
 */
export default function WelcomeStage({
  leaving = false,
  cardOnLeaving,
  fromIntro = null,
}: {
  leaving?: boolean;
  /** Where the card stood as sign-in closed, to shrink back from. */
  cardOnLeaving?: RefObject<MorphRect | null>;
  /**
   * Where the intro's link card stood as it handed over (#275): the phone grows
   * out of it instead of rising from below.
   */
  fromIntro?: MorphRect | null;
}) {
  const t = useT();
  const { lang } = useLang();
  const still = useReducedMotion() ?? false;

  const stage = useRef<HTMLDivElement>(null);
  // The longest headline, unseen, measured: the phone stands under that much room.
  const ruler = useRef<HTMLParagraphElement>(null);
  const [size, setSize] = useState({ left: 0, top: 0, width: 0, height: 0, headline: 0 });
  useLayoutEffect(() => {
    const el = stage.current;
    const line = ruler.current;
    if (!el || !line) return;
    const measure = () => {
      const { left, top } = el.getBoundingClientRect();
      setSize({
        left,
        top,
        width: el.clientWidth,
        height: el.clientHeight,
        headline: line.offsetHeight,
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    observer.observe(line);
    return () => observer.disconnect();
  }, []);

  // Where in the round it is, as the last moment reached.
  const [round, setRound] = useState(0);
  const [reached, setReached] = useState({ round: 0, at: 0 });
  const now = still ? AT.shine : reached.round === round ? reached.at : 0;
  // While sign-in is open it waits, and starts over behind the scenes, ready for back.
  const startedOver = useRef(-1);
  useEffect(() => {
    if (still) return;
    if (leaving) {
      if (startedOver.current === round) return;
      const id = setTimeout(() => {
        startedOver.current = round + 1;
        setRound((r) => r + 1);
      }, MORPH_S * 1000);
      return () => clearTimeout(id);
    }
    const timers = MOMENTS.map((at) => setTimeout(() => setReached({ round, at }), at * 1000));
    timers.push(setTimeout(() => setRound((r) => r + 1), AT.end * 1000));
    return () => timers.forEach(clearTimeout);
  }, [round, still, leaving]);

  const [month] = useState(() => demoMonth(Date.now()));
  const plan = useMemo(() => demoPlan(month), [month]);
  const vote = useMemo(() => demoVote(plan.free, t.welcome.event), [plan, t.welcome.event]);
  const everyone = useMemo(() => plan.items.flat(), [plan]);
  const yours = plan.items[0];
  const agreedDay = plan.free[0];
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
  const finale = now >= AT.finale;
  const onScreen = now < AT.home ? "group" : voting ? "vote" : "home";

  // A line over the phone says what is going on: possible dates, then the vote.
  const headline = listing
    ? t.welcome.candidates
    : voting
      ? t.welcome.voting
      : finale && now < AT.finaleOut
        ? t.welcome.inEveryones
        : null;
  const framedNow = listing || voting || (finale && now < AT.finaleOut);
  const pose = voting ? POSE.turned : framedNow ? POSE.framed : POSE.flat;
  const shape = finale
    ? now < AT.finaleOut
      ? SHAPE.finale
      : SHAPE.flat
    : now >= AT.agreed
      ? SHAPE.agreed
      : voting
        ? SHAPE.vote
        : listing
          ? SHAPE.list
          : SHAPE.flat;
  const scale = Math.min((size.height * 0.92) / DEVICE.height, (size.width * 0.62) / DEVICE.width);
  const place = (p: typeof pose) => ({ ...p, y: p.y * size.height, scale: p.scale * scale });
  // Under a headline: as big as fits in what is left, and centred there.
  const room = HEADLINE_TOP + size.headline + 10;
  const framedHeight = size.height - room - 6;
  const framed = {
    y: room + framedHeight / 2 - size.height / 2,
    scale: Math.min(framedHeight / DEVICE.height, scale),
  };

  // Past the first round they are already standing there, from the end of the last.
  const friends: FriendState[] = FRIENDS.map((_, i) => {
    if (now >= AT.arrived[i]) return "around";
    if (now >= AT.joined[i]) return "gone";
    if (now >= FLY_AT[i]) return "row";
    return round > 0 || now >= POP_AT[i] ? "around" : "gone";
  });
  const thud = now >= AT.landing && now < AT.thudDone;
  const items = now >= AT.digital ? everyone : yours;
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
  // The phone turning into the card, or back: a box from the one to the other.
  const phoneRect = (flat: boolean): MorphRect => {
    const standing = !flat && framedNow ? framed : { y: 0, scale };
    const width = DEVICE.width * standing.scale;
    const height = DEVICE.height * standing.scale;
    return {
      left: size.left + (size.width - width) / 2,
      top: size.top + size.height / 2 + standing.y - height / 2,
      width,
      height,
      borderRadius: DEVICE.radius * standing.scale,
    };
  };
  const [morph, setMorph] = useState<{ from: MorphRect; to: MorphRect; out: boolean } | null>(null);
  // The intro's link card growing into the phone: once, as soon as the stage is measured.
  const [growing, setGrowing] = useState(!!fromIntro && !still);
  const grown = useRef(false);
  useEffect(() => {
    if (!fromIntro || still || grown.current || size.height === 0) return;
    grown.current = true;
    const frame = requestAnimationFrame(() =>
      setMorph({ from: fromIntro, to: phoneRect(true), out: false }),
    );
    const shown = setTimeout(() => setGrowing(false), MORPH_S * 700);
    const done = setTimeout(() => setMorph(null), MORPH_S * 1000);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(shown);
      clearTimeout(done);
    };
    // Once, when the stage first has a size: the card's place is fixed at the hand-over.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.height]);
  const wasLeaving = useRef(leaving);
  useEffect(() => {
    if (wasLeaving.current === leaving) return;
    wasLeaving.current = leaving;
    if (still) return;
    let frame = 0;
    let tries = 0;
    if (leaving) {
      const from = phoneRect(false);
      const find = () => {
        const card = rectOfCard();
        if (card) setMorph({ from, to: card, out: true });
        else if (tries++ < 120) frame = requestAnimationFrame(find);
      };
      frame = requestAnimationFrame(find);
    } else {
      const from = cardOnLeaving?.current;
      frame = requestAnimationFrame(() => {
        if (from) setMorph({ from, to: phoneRect(true), out: false });
      });
    }
    const done = setTimeout(() => setMorph(null), MORPH_S * 1000);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(done);
    };
    // Only as sign-in opens or closes: where things stand is read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaving, still]);

  const boxPressed =
    (now >= AT.pressed && now < AT.sent) || (now >= AT.pillPressed && now < AT.vote);

  return (
    <div
      ref={stage}
      aria-hidden
      inert
      className="pointer-events-none relative h-full overflow-hidden"
    >
      {/* The colour shape, in a panel of its own: fixed, so it can spread over the whole screen. */}
      {scale > 0 && (
        <motion.div
          className="fixed overflow-hidden"
          initial={false}
          animate={
            leaving
              ? {
                  left: 0,
                  top: 0,
                  width: window.innerWidth,
                  // A little past the bottom: the keyboard and the bounce never show an edge.
                  height: window.innerHeight + 120,
                  borderRadius: 0,
                }
              : {
                  left: size.left + size.width * 0.05,
                  top: size.top + 12,
                  width: size.width * 0.9,
                  height: size.height - 12,
                  borderRadius: 28,
                }
          }
          transition={MORPH_SPRING}
        >
          <motion.div
            className="absolute inset-0"
            style={{ background: SHAPE_COLORS }}
            initial={false}
            animate={{ opacity: leaving ? 1 : 0 }}
            transition={{ duration: 0.45 }}
          />
          <motion.div
            className="absolute inset-x-[-30%] top-0"
            style={{ aspectRatio: "1 / 0.9" }}
            initial={still ? SHAPE.flat : { ...SHAPE.flat, y: "90%" }}
            animate={leaving ? SHAPE_FILL : still ? SHAPE.flat : shape}
            transition={POSE_SPRING}
          >
            <div className="absolute inset-0 rounded-[46%]" style={{ background: SHAPE_COLORS }} />
            <div
              className="absolute inset-x-[-6%] top-[52%] h-[70%] rounded-[50%]"
              style={{
                background:
                  "radial-gradient(circle at 20% 20%, #fbbf24 0, transparent 60%), linear-gradient(120deg, #f97316, #ec4899)",
              }}
            />
          </motion.div>
          <motion.div
            className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background to-transparent"
            initial={false}
            animate={{ opacity: leaving ? 0 : 1 }}
            transition={{ duration: 0.3 }}
          />
        </motion.div>
      )}
      {morph && (
        <motion.div
          className="fixed border bg-card shadow-2xl shadow-black/30"
          initial={morph.from}
          animate={morph.to}
          transition={MORPH_SPRING}
        >
          {/* The phone's metal edge, there only as long as it is still a phone. */}
          <motion.div
            className="absolute inset-0 rounded-[inherit]"
            style={{ boxShadow: "inset 0 0 0 3px #c4c6c9" }}
            initial={{ opacity: morph.out ? 1 : 0 }}
            animate={{ opacity: morph.out ? 0 : 1 }}
            transition={{ duration: 0.3 }}
          />
        </motion.div>
      )}
      <motion.div
        className="absolute inset-0"
        style={{ perspective: size.height * 1.9 }}
        initial={false}
        animate={{ opacity: leaving ? 0 : 1 }}
        transition={leaving ? { duration: 0.18 } : { delay: 0.42, duration: 0.22 }}
      >
        {/* The line over the phone, one giving way to the next in the same place. */}
        <p
          ref={ruler}
          className={`invisible absolute inset-x-4 ${HEADLINE_TEXT}`}
          style={{ top: HEADLINE_TOP }}
        >
          {t.welcome.voting.length > t.welcome.inEveryones.length
            ? t.welcome.voting
            : t.welcome.inEveryones}
        </p>
        <AnimatePresence>
          {headline && !still && (
            <motion.p
              key={headline}
              className={`absolute inset-x-4 ${HEADLINE_TEXT}`}
              style={{ top: HEADLINE_TOP }}
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
            initial={
              still ? false : fromIntro ? { ...place(POSE.flat), opacity: 0 } : place(POSE.below)
            }
            animate={{
              ...(still
                ? place(POSE.flat)
                : framedNow
                  ? { ...pose, ...framed }
                  : thud
                    ? { ...place(POSE.flat), scale: scale * 1.05 }
                    : place(pose)),
              opacity: growing ? 0 : 1,
            }}
            transition={still ? { duration: 0 } : POSE_SPRING}
          >
            <PhoneDevice
              over={
                !still && (
                  <>
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
                      dim={(listing && now < AT.back) || now >= AT.landing}
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
        {/* The friends, on the stage and outside the phone, so they can stay put as it changes. */}
        {scale > 0 && !still && (
          <Friends
            width={size.width}
            height={size.height}
            top={room}
            scale={scale}
            framed={framed}
            cell={zoomOn}
            day={agreedDay}
            states={friends}
            sent={AT.sends.map((at) => now >= at)}
            tiles={AT.arrived.map((at) => now >= at && now < AT.finaleOut)}
          />
        )}
      </motion.div>
    </div>
  );
}
