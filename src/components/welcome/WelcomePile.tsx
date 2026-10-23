import { useEffect, useMemo, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { CalendarCheck } from "lucide-react";

import { MonthLayer } from "@/components/swipe/MonthView";
import { LOCALE, useLang, useT } from "@/i18n/lang";
import { capitalize } from "@/lib/format";
import type { GridItem } from "@/lib/monthGrid";
import { layerAlpha, sheetTilt, throwSide } from "@/lib/paperPile";
import { addDays, APP_TIME_ZONE, startOfMonth } from "@/lib/zone";

const TZ = APP_TIME_ZONE;

/** You and three made-up friends, in Apple Calendar's colours, each busy on a few days. */
const YOU = { id: "you", color: "0, 122, 255", busy: [2, 3, 9, 10, 16, 17] };
const FRIENDS = [
  { id: "freja", name: "Freja", color: "52, 199, 89", busy: [1, 4, 8, 11, 15, 18] },
  { id: "oliver", name: "Oliver", color: "175, 82, 222", busy: [3, 5, 10, 12, 17, 19] },
  { id: "sara", name: "Sara", color: "255, 149, 0", busy: [2, 6, 9, 13, 16, 20] },
];
/** The days of the month nobody above is busy on: what lights up. */
const FREE = [7, 14, 21];

/** One round, from the first throw to the fade, then it starts over. */
const CYCLE_MS = 8_000;
const FIRST_THROW = 0.5;
const THROW_GAP = 0.85;
const FALL = 0.7;
const IMPACT = 0.3;
/** All landed: the pile is pressed into line, so the days lie on top of each other. */
const PRESS_AT = FIRST_THROW + THROW_GAP * (FRIENDS.length - 1) + FALL + IMPACT + 0.3;
const SHINE_AT = PRESS_AT + 0.5;
const CARD_AT = SHINE_AT + 0.8;

/**
 * The app's welcome screen picture (#151): Planlæg's paper pile in small,
 * made up. Next month on your calendar, three friends' calendars tossed onto
 * it one after the other, pressed into line, the days free for everyone lighting up green, and
 * the first of them lifting out as a card. Then it fades and starts over.
 * Still, in its finished state, under reduced motion.
 */
export default function WelcomePile() {
  const t = useT();
  const { lang } = useLang();
  const still = useReducedMotion() ?? false;
  const [round, setRound] = useState(0);
  // Pressed into line once all have landed, in each round (from the start when still).
  const [pressedIn, setPressedIn] = useState(-1);
  const pressed = still || pressedIn === round;
  useEffect(() => {
    if (still) return;
    const press = setTimeout(() => setPressedIn(round), PRESS_AT * 1000);
    const next = setTimeout(() => setRound((r) => r + 1), CYCLE_MS);
    return () => {
      clearTimeout(press);
      clearTimeout(next);
    };
  }, [round, still]);

  // Next month, fixed for as long as the screen is open.
  const [month] = useState(() => startOfMonth(Date.now(), TZ, 1));
  const day = (d: number) => addDays(month, d - 1, TZ);
  const itemsOf = (who: { id: string; busy: number[] }): GridItem[] =>
    who.busy.map((d) => ({ calendarId: who.id, start: day(d), end: day(d + 1), label: "" }));
  const colors = useMemo(() => new Map([YOU, ...FRIENDS].map((w) => [w.id, w.color] as const)), []);
  const colorOf = (id: string) => colors.get(id) ?? "";
  const shine = useMemo(() => new Set(FREE.map((d) => addDays(month, d - 1, TZ))), [month]);
  const alpha = layerAlpha(FRIENDS.length);
  const picked = capitalize(
    new Date(day(FREE[0])).toLocaleDateString(LOCALE[lang], {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: TZ,
    }),
  );

  // Each round fades out at its end, before the next begins.
  const fade = {
    animate: still ? undefined : { opacity: [1, 1, 0] },
    transition: { duration: CYCLE_MS / 1000, times: [0, 0.9, 1] },
  };

  return (
    <div aria-hidden className="pointer-events-none relative h-full overflow-hidden">
      {/* The calendars, fading out at the bottom rather than cut off. */}
      <div
        className="absolute inset-0"
        style={{
          maskImage: "linear-gradient(to bottom, black calc(100% - 90px), transparent)",
          WebkitMaskImage: "linear-gradient(to bottom, black calc(100% - 90px), transparent)",
        }}
      >
        {/* Your calendar, the table the others land on. */}
        <div className="absolute inset-x-3 top-6 overflow-hidden rounded-[28px] border bg-card shadow-sm">
          <MonthLayer month={month} items={itemsOf(YOU)} colorOf={colorOf} />
        </div>

        <motion.div key={round} className="absolute inset-0" {...fade}>
          {FRIENDS.map((friend, k) => (
            <Thrown key={friend.id} k={k} still={still} pressed={pressed}>
              <div
                className="relative rounded-[28px] border"
                style={{
                  backgroundColor: `rgb(var(--glass-tint) / ${alpha})`,
                  borderColor: "rgb(var(--glass-edge))",
                  boxShadow:
                    "inset 0 1px 0 rgb(var(--glass-edge)), 0 18px 40px -18px rgb(0 0 0 / 0.45)",
                }}
              >
                <MonthLayer month={month} items={itemsOf(friend)} colorOf={colorOf} />
                {/* Whose it is, until the pile is pressed into one. */}
                <motion.span
                  className="glass absolute right-3 top-3 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-foreground"
                  animate={{ opacity: pressed ? 0 : 1 }}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: `rgb(${friend.color})` }}
                  />
                  {friend.name}
                </motion.span>
              </div>
            </Thrown>
          ))}

          {/* The days free for everyone, shining through the pile. */}
          <motion.div
            className="absolute inset-x-3 top-6"
            initial={still ? false : { opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: SHINE_AT, duration: 0.5, ease: "easeOut" }}
          >
            <MonthLayer month={month} items={[]} colorOf={colorOf} shine={shine} />
          </motion.div>
        </motion.div>
      </div>

      {/* The first of them, lifted out, clear of the fade. */}
      <motion.div key={`card-${round}`} className="absolute inset-0" {...fade}>
        <motion.div
          className="glass absolute inset-x-8 bottom-6 flex items-center gap-3 rounded-2xl px-4 py-3"
          initial={still ? false : { opacity: 0, y: 40, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: CARD_AT, type: "spring", stiffness: 260, damping: 22 }}
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
            <CalendarCheck className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[15px] font-semibold text-foreground">
              {picked}
            </span>
            <span className="block text-[13px] text-muted-foreground">
              {t.welcome.allCan(FRIENDS.length + 1)}
            </span>
          </span>
        </motion.div>
      </motion.div>
    </div>
  );
}

/**
 * One friend's calendar thrown onto the pile as Planlæg throws it
 * (PileScreen's ThrownLayer, simplified): from high above and to the side,
 * falling faster into the hit, a small skid and hop, settling crooked;
 * pressed, straight into line without a bounce.
 */
function Thrown({
  k,
  still,
  pressed,
  children,
}: {
  k: number;
  still: boolean;
  pressed: boolean;
  children: ReactNode;
}) {
  const tilt = sheetTilt(k + 1);
  const side = throwSide(k);
  const from = side * 220;
  const hit = FALL / (FALL + IMPACT);
  return (
    <motion.div
      className="absolute inset-x-3 top-6"
      style={{ transformOrigin: "50% 35%" }}
      initial={still ? false : { x: from, y: -160, rotate: side * -14, scale: 1.5, opacity: 0 }}
      animate={
        pressed
          ? { x: 0, y: 0, rotate: 0, scale: 1, opacity: 1 }
          : {
              x: [from, tilt.x - side * 7, tilt.x + side * 2, tilt.x],
              y: [-160, tilt.y + 3, tilt.y - 8, tilt.y],
              rotate: [side * -14, tilt.rotate - side * 1.5, tilt.rotate + side * 0.6, tilt.rotate],
              scale: [1.5, 0.975, 1.012, 1],
              opacity: [0, 1, 1, 1],
            }
      }
      transition={
        pressed
          ? { type: "spring", stiffness: 170, damping: 26 }
          : {
              delay: FIRST_THROW + k * THROW_GAP,
              duration: FALL + IMPACT,
              times: [0, hit, hit + (1 - hit) * 0.4, 1],
              ease: [[0.55, 0, 1, 0.45], "easeOut", "easeInOut"],
            }
      }
    >
      {children}
    </motion.div>
  );
}
