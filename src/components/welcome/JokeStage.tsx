import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, MessageCircle } from "lucide-react";

import ChatScene from "@/components/chatScene/ChatScene";
import {
  ACTIVITIES,
  CUES,
  FOUND,
  FRIENDS,
  type Friend,
  GROUP,
  JOURNEY,
  JOURNEY_CHAT,
  JOURNEY_REPLIES,
  PACE,
  type Words,
} from "@/components/chatScene/script";
import TapHint from "@/components/chatScene/TapHint";
import PhoneDevice from "@/components/welcome/phone/PhoneDevice";
import { DEVICE, SCREEN } from "@/components/welcome/phone/geometry";
import { useLang } from "@/i18n/lang";
import { appRandom, oncePerLoad } from "@/lib/appRandom";

/** Room above the phone for the app's line, in px. */
const LINE_ROOM = 84;

/**
 * Where the welcome is: the chat until the link is sent, the app's groups, the
 * app finding the day, the found day waiting to be sent, the chat's notice
 * dropping in, and the chat again with the friends answering.
 */
type Step = "chat" | "finding" | "found" | "notice" | "replies";

const FACES = Object.keys(FRIENDS) as Friend[];

function Face({ who, size }: { who: Friend; size: number }) {
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full font-semibold text-white ring-2 ring-background"
      style={{ width: size, height: size, background: FRIENDS[who].color, fontSize: size * 0.44 }}
    >
      {FRIENDS[who].name[0]}
    </span>
  );
}

/** The soft colours drifting behind the phone: friendly, and never still for long. */
function Bubbles() {
  const still = useReducedMotion() ?? false;
  const blobs = [
    { color: "#FF4D00", size: "62%", left: "-18%", top: "4%", drift: [0, 26, -10, 0] },
    { color: "#FFB199", size: "54%", left: "58%", top: "-6%", drift: [0, -22, 14, 0] },
    { color: "#B06AF0", size: "46%", left: "62%", top: "52%", drift: [0, 18, -20, 0] },
    { color: "#4C8BF5", size: "50%", left: "-14%", top: "60%", drift: [0, -16, 22, 0] },
  ];
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden [mask-image:linear-gradient(to_bottom,black_72%,transparent)]"
    >
      {blobs.map((b, i) => (
        <motion.span
          key={b.color}
          className="absolute aspect-square rounded-full opacity-[0.22] blur-3xl dark:opacity-[0.28]"
          style={{ background: b.color, width: b.size, left: b.left, top: b.top }}
          animate={
            still ? undefined : { x: b.drift, y: [...b.drift].reverse(), scale: [1, 1.12, 0.94, 1] }
          }
          transition={{ duration: 14 + i * 3, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

/** The app at work, the whole screen: everyone's calendar looked through, one after the other. */
function Finding({ lang }: { lang: "da" | "en" }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-10 bg-[#FF4D00] px-8 text-white"
      style={{ width: SCREEN.width, height: SCREEN.height }}
    >
      <p className="text-balance text-center text-[34px] font-bold leading-tight">
        {JOURNEY.finding[lang]}
      </p>
      <div className="flex gap-3">
        {FACES.map((f, i) => (
          <motion.span
            key={f}
            animate={{ y: [0, -14, 0] }}
            transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.14 }}
          >
            <Face who={f} size={46} />
          </motion.span>
        ))}
      </div>
    </div>
  );
}

/** The day the app found, waiting to be sent to the group for a vote. */
function Found({
  lang,
  title,
  sending,
  onSend,
}: {
  lang: "da" | "en";
  title: Words;
  sending: boolean;
  onSend: () => void;
}) {
  return (
    <div
      className="flex flex-col bg-background px-5 pb-12 pt-[78px] text-foreground"
      style={{ width: SCREEN.width, height: SCREEN.height }}
    >
      <p className="text-[17px] font-semibold text-muted-foreground">{GROUP[lang]}</p>
      <div className="flex flex-1 items-center">
        <motion.div
          className="w-full rounded-[28px] bg-card p-6 shadow-lg ring-1 ring-border"
          initial={{ opacity: 0, scale: 0.85, y: 30 }}
          animate={sending ? { opacity: 0, y: -520, scale: 0.7 } : { opacity: 1, scale: 1, y: 0 }}
          transition={
            sending
              ? { duration: 0.55, ease: [0.5, 0, 0.9, 0.4] }
              : { type: "spring", stiffness: 260, damping: 20 }
          }
        >
          <p className="text-[15px] font-semibold uppercase tracking-wide text-[#E9560C]">
            {title[lang]} · {JOURNEY.foundLabel[lang]}
          </p>
          <p className="mt-2 text-[38px] font-bold leading-[1.05]">{FOUND.date[lang]}</p>
          <p className="mt-3 flex items-center gap-2 text-[17px] text-muted-foreground">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-everyone">
              <Check className="h-4 w-4 text-white" strokeWidth={3} aria-hidden />
            </span>
            {FOUND.detail[lang]}
          </p>
          <div className="mt-5 flex -space-x-2">
            {FACES.map((f) => (
              <Face key={f} who={f} size={36} />
            ))}
          </div>
        </motion.div>
      </div>
      <TapHint on={!sending}>
        <motion.button
          type="button"
          onClick={onSend}
          disabled={sending}
          className="flex h-[58px] w-[350px] items-center justify-center rounded-full bg-cta text-[19px] font-bold text-white"
          animate={sending ? { opacity: 0 } : { opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          {JOURNEY.send[lang]}
        </motion.button>
      </TapHint>
    </div>
  );
}

/**
 * The app's welcome (#275): the joke as something the person does, in three
 * taps. The group chat stalls at "Vi finder lige en dag" and they answer with
 * the app's link; the phone goes into the app, where they pick the group; the
 * app finds the day, and they send it for a vote; the chat's notice drops in,
 * and back in the chat the friends answer. So the first thing anyone does in
 * the app is what it is for, and why. The app's lines stand above the phone,
 * soft colours drift behind it, and Kom i gang is under it all the way
 * (AppWelcome). Which plan is drawn once per launch. `leaving` is sign-in
 * opening over it: it fades back.
 */
export default function JokeStage({
  leaving = false,
  onDone,
}: {
  leaving?: boolean;
  /** The journey has reached its end ("Og så fandt I den."): the way on can show. */
  onDone?: () => void;
}) {
  const { lang } = useLang();
  const box = useRef<HTMLDivElement>(null);
  const [room, setRoom] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setRoom({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const activity = oncePerLoad("welcome-joke", () => Math.floor(appRandom() * ACTIVITIES.length));
  const plan = ACTIVITIES[activity];
  const [step, setStep] = useState<Step>("chat");
  const [sending, setSending] = useState(false);
  const [chatCue, setChatCue] = useState<Words | null>(null);
  // The opening question and "send this" fill the phone in orange for their own
  // moment only, then step aside for the chat (and the send button) under them.
  const [shownCard, setShownCard] = useState<Words | null>(null);
  const cardTimer = useRef(0);
  const onChatCue = useCallback((next: Words | null) => {
    setChatCue(next);
    if (next !== CUES.familiar && next !== CUES.reply) return;
    window.clearTimeout(cardTimer.current);
    setShownCard(next);
    const beat = JOURNEY_CHAT.find((b) => b.kind === "cue" && b.text === next);
    cardTimer.current = window.setTimeout(() => setShownCard(null), (beat?.ms ?? 2400) * PACE);
  }, []);
  useEffect(() => () => window.clearTimeout(cardTimer.current), []);
  // After the friends' laugh, the sent link waits to be pressed (the second tap).
  const [linkReady, setLinkReady] = useState(false);
  const chatEnded = useCallback(() => {
    setChatCue(null);
    setLinkReady(true);
  }, []);
  // Where the pressed link stands on the phone's screen, for the app to grow out of.
  const screenRef = useRef<HTMLDivElement>(null);
  const [origin, setOrigin] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const openLink = () => {
    const host = screenRef.current;
    const card = host?.querySelector("[data-link-card]");
    if (host && card) {
      const h = host.getBoundingClientRect();
      const r = card.getBoundingClientRect();
      const k = h.width / SCREEN.width;
      setOrigin({
        x: (r.left - h.left) / k,
        y: (r.top - h.top) / k,
        w: r.width / k,
        h: r.height / k,
      });
    }
    setLinkReady(false);
    setStep("finding");
  };

  // The steps that move on by themselves.
  useEffect(() => {
    const after: Partial<Record<Step, [Step, number]>> = {
      finding: ["found", 2600],
      notice: ["replies", 2300],
    };
    const next = after[step];
    if (!next) return;
    const t = window.setTimeout(() => setStep(next[0]), next[1]);
    return () => window.clearTimeout(t);
  }, [step]);
  useEffect(() => {
    if (!sending) return;
    const t = window.setTimeout(() => {
      setSending(false);
      setStep("notice");
    }, 650);
    return () => window.clearTimeout(t);
  }, [sending]);

  // The opening question and "send this" fill the phone's screen in orange; the rest stand under it.
  const card = step === "chat" ? shownCard : null;
  const cue: Words | null =
    step === "chat" && linkReady
      ? JOURNEY.openLink
      : step === "found" && !sending
        ? JOURNEY.sendIt
        : step === "replies" ||
            (step === "chat" && chatCue !== CUES.familiar && chatCue !== CUES.reply)
          ? chatCue
          : null;
  const ended = step === "replies" && chatCue === CUES.found;
  useEffect(() => {
    if (ended) onDone?.();
  }, [ended, onDone]);

  const scale = Math.max(
    0.3,
    Math.min((room.height - LINE_ROOM - 8) / DEVICE.height, (room.width - 32) / DEVICE.width),
  );
  // The app grows out of the link that was pressed, and shrinks back into it.
  const inApp = step === "finding" || step === "found" || step === "notice";
  const fromLink = origin
    ? {
        x: origin.x,
        y: origin.y + origin.h / 2 - (SCREEN.height * origin.w) / SCREEN.width / 2,
        scale: origin.w / SCREEN.width,
        opacity: 0,
        borderRadius: 60,
      }
    : { opacity: 0, scale: 0.9, x: 0, y: 0, borderRadius: 60 };

  return (
    <motion.div
      ref={box}
      className="relative flex h-full flex-col items-center"
      initial={false}
      animate={leaving ? { opacity: 0, scale: 0.96 } : { opacity: 1, scale: 1 }}
      transition={{ duration: 0.25 }}
    >
      <Bubbles />
      <div style={{ height: "max(0.75rem, env(safe-area-inset-top))" }} />
      {room.height > 0 && (
        <div
          className="relative"
          style={{ width: DEVICE.width * scale, height: DEVICE.height * scale }}
        >
          <div
            className="relative origin-top-left"
            style={{ width: DEVICE.width, height: DEVICE.height, transform: `scale(${scale})` }}
          >
            <PhoneDevice>
              <div ref={screenRef} className="absolute inset-0">
                {step === "replies" ? (
                  <ChatScene
                    key="replies"
                    beats={JOURNEY_REPLIES}
                    activity={activity}
                    mode="auto"
                    onCue={setChatCue}
                  />
                ) : (
                  <ChatScene
                    key="chat"
                    beats={JOURNEY_CHAT}
                    activity={activity}
                    mode="tap"
                    onCue={onChatCue}
                    onEnd={chatEnded}
                    onLinkTap={linkReady ? openLink : undefined}
                  />
                )}
              </div>
              <AnimatePresence>
                {inApp && (
                  <motion.div
                    key="app"
                    className="absolute inset-0 z-10 origin-top-left overflow-hidden"
                    initial={fromLink}
                    animate={{ x: 0, y: 0, scale: 1, opacity: 1, borderRadius: 0 }}
                    exit={fromLink}
                    transition={{ type: "tween", ease: [0.2, 0.8, 0.2, 1], duration: 0.5 }}
                  >
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.div
                        key={step === "finding" ? "finding" : "found"}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.25 }}
                      >
                        {step === "finding" ? (
                          <Finding lang={lang} />
                        ) : (
                          <Found
                            lang={lang}
                            title={plan.title}
                            sending={sending || step === "notice"}
                            onSend={() => setSending(true)}
                          />
                        )}
                      </motion.div>
                    </AnimatePresence>
                  </motion.div>
                )}
              </AnimatePresence>
              {/* The app's two words to the person, the whole screen orange over the chat. */}
              <AnimatePresence>
                {card && (
                  <motion.div
                    key={card.da}
                    className="absolute inset-0 z-30 flex items-center justify-center bg-[#FF4D00] px-10"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.35 }}
                  >
                    <motion.p
                      className="text-balance text-center text-[44px] font-bold leading-[1.05] text-white"
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.15, type: "spring", stiffness: 260, damping: 22 }}
                    >
                      {card[lang]}
                    </motion.p>
                  </motion.div>
                )}
              </AnimatePresence>
              {/* The chat's notice, dropping in over the app: the friends have seen the vote. */}
              <AnimatePresence>
                {step === "notice" && (
                  <motion.div
                    key="notice"
                    className="absolute inset-x-3 top-[58px] z-20 flex items-center gap-3 rounded-[22px] bg-card/95 p-3 shadow-xl ring-1 ring-border backdrop-blur"
                    initial={{ y: -140, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -140, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 24 }}
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-[#0A7CFF] text-white">
                      <MessageCircle className="h-6 w-6 fill-current" aria-hidden />
                    </span>
                    <span className="flex min-w-0 flex-col leading-tight text-foreground">
                      <span className="text-[16px] font-semibold">{GROUP[lang]}</span>
                      <span className="truncate text-[15px]">{JOURNEY.notice[lang]}</span>
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </PhoneDevice>
          </div>
        </div>
      )}
      <div
        className="relative flex w-full items-start justify-center px-6 pt-3"
        style={{ height: LINE_ROOM }}
      >
        <AnimatePresence mode="wait">
          {cue && (
            <motion.p
              key={cue.da}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ type: "spring", stiffness: 380, damping: 28 }}
              className="text-balance text-center text-[1.5rem] font-bold leading-tight"
              aria-live="polite"
            >
              {cue[lang]}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
