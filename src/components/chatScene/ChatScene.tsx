import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BatteryFull,
  Camera,
  Check,
  ChevronLeft,
  Image as ImageIcon,
  Mic,
  Phone,
  Plus,
  SendHorizontal,
  Signal,
  Smile,
  Video,
  Wifi,
} from "lucide-react";

import Wordmark from "@/components/ui/Wordmark";
import { SCREEN } from "@/components/welcome/phone/geometry";
import { APP_NAME } from "@/i18n/brand";
import { useLang } from "@/i18n/lang";
import {
  ACTIVITIES,
  type Beat,
  CLOCK,
  CUE_TARGETS,
  CUES,
  FOUND,
  FRIENDS,
  type Friend,
  GROUP,
  LINK_DETAIL,
  PACE,
  SCENES,
  type SceneName,
  type Words,
} from "./script";

/**
 * A group chat's own colours, light and dark as the phone is: a picture of a
 * chat app rather than a page of ours, so not the site's theme colours.
 */
const C = {
  screen: "bg-white text-[#050505] dark:bg-black dark:text-[#F2F2F2]",
  ring: "shadow-[0_0_0_2px_#fff] dark:shadow-[0_0_0_2px_#000]",
  theirs: "bg-[#EFEFF1] dark:bg-[#303030]",
  dim: "text-[#8A8D91] dark:text-[#8E8E93]",
  accent: "text-[#0A7CFF]",
  field: "bg-[#F0F2F5] dark:bg-[#242426]",
  pill: "bg-white dark:bg-[#2C2C2E]",
  card: "bg-[#F5F5F7] dark:bg-[#1C1C1E]",
};

/** A message arriving, and the others making room: a calm slide, no bounce, as a chat does. */
const SLIDE = { type: "tween", ease: [0.2, 0.8, 0.2, 1], duration: 0.32 } as const;

function Face({ who, size = 30 }: { who: Friend; size?: number }) {
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, background: FRIENDS[who].color, fontSize: size * 0.44 }}
    >
      {FRIENDS[who].name[0]}
    </span>
  );
}

/** Three dots, one after the other, as a chat shows someone typing. */
function Dots() {
  return (
    <span className="flex items-center gap-[5px] px-1 py-[4px]" aria-hidden>
      {[0, 1, 2].map((i) => (
        <motion.i
          key={i}
          className="block h-[7px] w-[7px] rounded-full bg-[#8A8D91]"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1, repeat: Infinity, delay: i * 0.18 }}
        />
      ))}
    </span>
  );
}

/**
 * When each reaction comes, after the one before (the first after the
 * message): uneven, as friends picking up their phones are.
 */
const REACT_GAPS_MS = [900, 1300, 1900, 1100];

/**
 * A message's reactions, arriving one friend at a time: the first pops on,
 * each next one bumps the count and may add its own emoji (up to three shown,
 * as a chat does). Already all there for a message that was in the chat before
 * the scene opened.
 */
function Reactions({ list, instant }: { list: string[]; instant: boolean }) {
  const [n, setN] = useState(instant ? list.length : 0);
  useEffect(() => {
    if (n >= list.length) return;
    const t = window.setTimeout(() => setN((k) => k + 1), REACT_GAPS_MS[n % REACT_GAPS_MS.length]);
    return () => window.clearTimeout(t);
  }, [n, list.length]);
  if (n === 0) return null;
  const emojis = [...new Set(list.slice(0, n))].slice(0, 3);
  return (
    <motion.span
      initial={instant ? false : { scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 500, damping: 18 }}
      className={`absolute -bottom-[14px] right-2 flex h-[26px] items-center gap-1 rounded-full px-[7px] text-[15px] leading-none ${C.pill} ${C.ring}`}
    >
      <span>{emojis.join("")}</span>
      {n > 1 && (
        <motion.span
          key={n}
          initial={{ scale: 1.5 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 20 }}
          className={`text-[13px] font-medium ${C.dim}`}
        >
          {n}
        </motion.span>
      )}
    </motion.span>
  );
}

/** The day the app found, as a friend sends it: the app's own card, in the chat. */
function FoundCard({ title, lang }: { title: Words; lang: "da" | "en" }) {
  return (
    <span className={`block w-[240px] overflow-hidden rounded-[18px] ${C.card}`}>
      <span className="flex items-center bg-[#FF4D00] px-3 py-2">
        <Wordmark className="text-[15px] text-white" />
      </span>
      <span className="flex flex-col gap-1 px-3 pb-3 pt-2">
        <span className="text-[13px] font-semibold uppercase tracking-wide text-[#E9560C]">
          {title[lang]}
        </span>
        <span className="text-[21px] font-bold leading-tight">{FOUND.date[lang]}</span>
        <span className={`flex items-center gap-1.5 text-[14px] ${C.dim}`}>
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-everyone">
            <Check className="h-3 w-3 text-white" strokeWidth={3} aria-hidden />
          </span>
          {FOUND.detail[lang]}
        </span>
      </span>
    </span>
  );
}

type Item =
  | {
      id: number;
      kind: "text";
      who: Friend;
      text: string;
      key: boolean;
      react?: string[];
      history: boolean;
    }
  | { id: number; kind: "gap"; text: string }
  | { id: number; kind: "link" }
  | { id: number; kind: "found"; who: Friend; react?: string[] };

/**
 * The joke, played on the welcome phone's screen (#275, #270): one of the
 * scenes in `script.ts`, beat by beat, as a group chat in the phone's own
 * light or dark. The phone shows only the chat; each cue (what the app says to
 * the person) goes to `onCue`, for its holder to show outside the phone, and
 * the chat waits while it stands. `mode="tap"` waits for the person to press
 * send (the app's welcome); `"auto"` sends by itself (the computer's ad, where
 * nobody holds the phone). Drawn at the phone's own 390 × 844 and scaled by its
 * parent. Under reduced motion the same beats come in as fades (MotionConfig).
 */
export default function ChatScene({
  scene = "idea",
  activity = 0,
  mode = "tap",
  onCue,
  onEnd,
}: {
  scene?: SceneName;
  /** Which of ACTIVITIES the plan is about. */
  activity?: number;
  mode?: "tap" | "auto";
  onCue?: (cue: Words | null) => void;
  onEnd?: () => void;
}) {
  const { lang } = useLang();
  const beats: Beat[] = SCENES[scene];
  const plan = ACTIVITIES[activity % ACTIVITIES.length];
  // What was said before the scene opens is simply there.
  const history = beats.findIndex((b) => !(b.kind === "text" && b.history));
  const [at, setAt] = useState(Math.max(0, history));
  const [pressed, setPressed] = useState(false);
  const beat = beats[at];

  useEffect(() => {
    if (!beat) {
      onEnd?.();
      return;
    }
    if (pressed) return;
    if (beat.kind === "send" && mode === "tap") return;
    const t = window.setTimeout(() => setAt((n) => n + 1), beat.ms * PACE);
    return () => window.clearTimeout(t);
  }, [beat, mode, pressed, onEnd]);

  // A tap on send: the link goes straight away, just after the button's press.
  const sendAt = beats.findIndex((b) => b.kind === "send");
  useEffect(() => {
    if (!pressed) return;
    const t = window.setTimeout(() => {
      setAt(sendAt + 1);
      setPressed(false);
    }, 180);
    return () => window.clearTimeout(t);
  }, [pressed, sendAt]);

  const played = useMemo(() => beats.slice(0, at + 1).map((b, i) => ({ b, i })), [beats, at]);
  // The cue stands from its beat until the next cue, or until the link is sent.
  const cue = useMemo(() => {
    let c: Words | null = null;
    for (const { b, i } of played) {
      if (b.kind === "cue") c = b.text;
      if (b.kind === "send" && i < at) c = null;
    }
    return c;
  }, [played, at]);
  const cueRef = useRef<Words | null>(null);
  useEffect(() => {
    if (cueRef.current === cue) return;
    cueRef.current = cue;
    onCue?.(cue);
  }, [cue, onCue]);

  const sent = played.some(({ b, i }) => b.kind === "send" && i < at);
  const offering = played.some(({ b }) => b.kind === "cue" && b.text === CUES.reply) && !sent;
  const familiar = beat?.kind === "cue" && !offering && !sent;
  // What the standing cue is about gets an orange ring, so it is plain what is meant.
  const highlight = cue ? CUE_TARGETS.get(cue) : undefined;
  const RING = "ring-2 ring-[#FF4D00] ring-offset-2 ring-offset-white dark:ring-offset-black";
  const typing = beat?.kind === "typing" ? beat.who : null;
  // From the moment the link is in the field, a tap sends it (early taps count).
  const waiting = offering && mode === "tap" && !pressed;

  const items: Item[] = [];
  for (const { b, i } of played) {
    if (b.kind === "text") {
      const words = b.text === "propose" ? plan.propose : b.text === "again" ? plan.again : b.text;
      items.push({
        id: i,
        kind: "text",
        who: b.who,
        text: words[lang],
        key: !!b.key,
        react: b.react,
        history: !!b.history,
      });
    } else if (b.kind === "gap") items.push({ id: i, kind: "gap", text: b.text[lang] });
    else if (b.kind === "send" && i < at) items.push({ id: i, kind: "link" });
    else if (b.kind === "found") items.push({ id: i, kind: "found", who: b.who, react: b.react });
  }
  const from = (it: Item | undefined) =>
    it && (it.kind === "text" || it.kind === "found") ? it.who : null;

  const press = () => {
    if (waiting) setPressed(true);
  };

  return (
    <div
      className={`relative flex flex-col font-sans ${C.screen}`}
      style={{ width: SCREEN.width, height: SCREEN.height }}
    >
      {/* The status bar, either side of the Dynamic Island. */}
      <div className="flex h-[54px] items-center justify-between px-[38px] pt-[6px]">
        <span className="text-[17px] font-semibold">{CLOCK}</span>
        <span className="flex items-center gap-[6px]" aria-hidden>
          <Signal className="h-[17px] w-[17px]" strokeWidth={2.6} />
          <Wifi className="h-[17px] w-[17px]" strokeWidth={2.6} />
          <BatteryFull className="h-[22px] w-[22px]" strokeWidth={2} />
        </span>
      </div>

      {/* The chat's head. */}
      <div className={`flex items-center gap-2 px-3 pb-2 pt-1 ${C.accent}`}>
        <ChevronLeft className="h-8 w-8" aria-hidden />
        <span className="relative h-[40px] w-[44px]">
          <span className="absolute right-0 top-0">
            <Face who="ida" size={28} />
          </span>
          <span className={`absolute bottom-0 left-0 rounded-full ${C.ring}`}>
            <Face who="mads" size={28} />
          </span>
        </span>
        <span className="min-w-0 flex-1 truncate text-[19px] font-bold text-[#050505] dark:text-[#F2F2F2]">
          {GROUP[lang]}
        </span>
        <Phone className="mr-4 h-6 w-6 fill-current" aria-hidden />
        <Video className="mr-1 h-7 w-7 fill-current" aria-hidden />
      </div>

      {/* The messages, from the bottom up: the oldest go off the top. */}
      <div className="flex flex-1 flex-col justify-end gap-[3px] overflow-hidden px-3 pb-2">
        <AnimatePresence initial={false}>
          {items.map((it, n) => {
            const prev = items[n - 1];
            const next = items[n + 1];
            if (it.kind === "gap") {
              return (
                <motion.div
                  key={it.id}
                  layout="position"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={SLIDE}
                  className={`shrink-0 py-4 text-center text-[13px] font-medium uppercase tracking-wide ${C.dim}`}
                >
                  {it.text}
                </motion.div>
              );
            }
            if (it.kind === "link") {
              return (
                <motion.div
                  key={it.id}
                  layout="position"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={SLIDE}
                  className="relative mb-4 mt-2 w-[250px] shrink-0 origin-bottom-right self-end"
                >
                  <span className={`block overflow-hidden rounded-[18px] ${C.theirs}`}>
                    <img
                      src="/og-image.png"
                      alt=""
                      className="block h-[131px] w-full object-cover"
                    />
                    <span className="flex flex-col px-3 py-2 leading-tight">
                      <span className="text-[15px] font-semibold">{APP_NAME}</span>
                      <span className={`text-[13px] ${C.dim}`}>{LINK_DETAIL[lang]}</span>
                    </span>
                  </span>
                  <Reactions list={["😂", "😆", "😂"]} instant={false} />
                </motion.div>
              );
            }
            const first = from(prev) !== it.who;
            const last = from(next) !== it.who && typing !== it.who;
            const dim = familiar && !(it.kind === "text" && it.key);
            return (
              <motion.div
                key={it.id}
                layout="position"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: dim ? 0.3 : 1, y: 0 }}
                transition={SLIDE}
                className={`flex shrink-0 origin-bottom-left items-end gap-2 ${first ? "mt-2" : ""} ${it.react ? "mb-4" : ""}`}
              >
                <span className="w-[30px] shrink-0">{last && <Face who={it.who} />}</span>
                <span className="flex min-w-0 flex-col">
                  {first && (
                    <span className={`px-3 pb-1 text-[13px] ${C.dim}`}>{FRIENDS[it.who].name}</span>
                  )}
                  <span className="relative">
                    {it.kind === "text" ? (
                      <span
                        data-cue-target={it.key ? "key" : undefined}
                        className={`block max-w-[270px] rounded-[18px] px-[13px] py-[8px] text-[17px] leading-snug transition-shadow ${C.theirs} ${it.key && highlight === "key" ? RING : ""}`}
                      >
                        {it.text}
                      </span>
                    ) : (
                      <span
                        data-cue-target="found"
                        className={`block rounded-[18px] transition-shadow ${highlight === "found" ? RING : ""}`}
                      >
                        <FoundCard title={plan.title} lang={lang} />
                      </span>
                    )}
                    {it.react && (
                      <Reactions list={it.react} instant={it.kind === "text" && it.history} />
                    )}
                  </span>
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {/* The typing dots: gone the moment the message takes their place, no fade out. */}
        {typing && (
          <motion.div
            key={`typing-${at}`}
            layout="position"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={SLIDE}
            className="mt-2 flex shrink-0 items-end gap-2"
          >
            <Face who={typing} />
            <span className={`rounded-[18px] px-[13px] py-[10px] ${C.theirs}`}>
              <Dots />
            </span>
          </motion.div>
        )}
        {/* Who has seen the last message, as small faces at the end. */}
        {items.length > 0 && (
          <span
            className="mt-1 flex shrink-0 justify-end gap-[3px] transition-opacity"
            style={{ opacity: typing ? 0 : 1 }}
            aria-hidden
          >
            {(Object.keys(FRIENDS) as Friend[]).map((f) => (
              <Face key={f} who={f} size={15} />
            ))}
          </span>
        )}
      </div>

      {/* The field. Before the person's turn it is empty; then the link is in it. */}
      <div className={`flex items-center gap-[14px] px-3 pb-[30px] pt-2 ${C.accent}`}>
        <Plus className="h-7 w-7 shrink-0" strokeWidth={2.4} aria-hidden />
        <Camera className="h-7 w-7 shrink-0" aria-hidden />
        <ImageIcon className="h-7 w-7 shrink-0" aria-hidden />
        <Mic className="h-7 w-7 shrink-0" aria-hidden />
        <span
          data-cue-target="field"
          className={`flex h-[40px] min-w-0 flex-1 items-center gap-2 rounded-full px-3 text-[17px] transition-shadow ${C.field} ${C.dim} ${highlight === "field" ? RING : ""}`}
        >
          {offering ? (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex min-w-0 flex-1 items-center gap-2"
            >
              <span className="h-6 w-6 shrink-0 rounded-[6px] bg-[#FF4D00]" />
              <span className="truncate text-[#050505] dark:text-[#F2F2F2]">casy.app</span>
            </motion.span>
          ) : (
            <>
              <span className="flex-1">Aa</span>
              <Smile className={`h-6 w-6 ${C.accent}`} aria-hidden />
            </>
          )}
        </span>
        <motion.button
          type="button"
          onClick={press}
          aria-label="Send"
          disabled={!waiting}
          className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${offering ? C.accent : C.dim}`}
          animate={
            waiting
              ? { scale: [1, 1.2, 1] }
              : pressed || (offering && mode === "auto" && beat?.kind === "send")
                ? { scale: [1, 0.8, 1] }
                : { scale: 1 }
          }
          transition={
            waiting
              ? { duration: 1.1, repeat: Infinity }
              : { duration: 0.35, delay: mode === "auto" ? 0.6 : 0 }
          }
        >
          <SendHorizontal className="h-7 w-7" fill="currentColor" aria-hidden />
        </motion.button>
      </div>
    </div>
  );
}
