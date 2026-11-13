import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronLeft } from "lucide-react";

import { APP_NAME } from "@/i18n/brand";
import { useLang } from "@/i18n/lang";
import { SCREEN } from "@/components/welcome/phone/geometry";
import {
  AFTER,
  ANSWERS,
  type Beat,
  FOUND,
  FRIENDS,
  type Friend,
  GROUP,
  LINK_DETAIL,
  MEMBERS,
  NO,
  OPENING,
  QUESTION,
  YES,
} from "./script";

const POP = { type: "spring", stiffness: 420, damping: 30 } as const;

function Face({ who, size = 26 }: { who: Friend; size?: number }) {
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, background: FRIENDS[who].color, fontSize: size * 0.46 }}
    >
      {FRIENDS[who].name[0]}
    </span>
  );
}

/** Three dots, one after the other, as a chat shows someone typing. */
function Dots() {
  return (
    <span className="flex items-center gap-[5px] px-1 py-[3px]" aria-hidden>
      {[0, 1, 2].map((i) => (
        <motion.i
          key={i}
          className="block h-[7px] w-[7px] rounded-full bg-muted-foreground"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1, repeat: Infinity, delay: i * 0.18 }}
        />
      ))}
    </span>
  );
}

/**
 * The joke, played on the welcome phone's screen (#275, #270): the scene in
 * `script.ts`, beat by beat. `mode="ask"` stops at Jonas's message and asks
 * (the app's welcome); `"auto"` answers yes by itself (the computer's ad, where
 * nobody is holding the phone). Drawn at the phone's own 390 × 844 and scaled
 * by its parent, like the rest of the welcome phone. Under reduced motion the
 * same beats come in as fades (MotionConfig in App.tsx).
 */
export default function ChatScene({
  mode = "ask",
  onEnd,
}: {
  mode?: "ask" | "auto";
  onEnd?: () => void;
}) {
  const { lang } = useLang();
  const [answer, setAnswer] = useState<"yes" | "no" | null>(null);
  const [at, setAt] = useState(0);

  const beats = useMemo<Beat[]>(() => {
    const ask = OPENING.findIndex((b) => b.kind === "ask");
    if (!answer) return OPENING;
    return [
      ...OPENING.slice(0, ask),
      { kind: "caption", text: ANSWERS[answer], ms: 1100 },
      ...AFTER,
    ];
  }, [answer]);

  const beat = beats[at];
  useEffect(() => {
    if (!beat) {
      onEnd?.();
      return;
    }
    if (beat.kind === "ask") {
      if (mode !== "auto") return;
      const t = window.setTimeout(() => setAnswer("yes"), 600);
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(() => setAt((n) => n + 1), beat.ms);
    return () => window.clearTimeout(t);
  }, [beat, mode, onEnd]);

  const played = beats.slice(0, at + 1);
  const shown = played
    .map((b, i) => ({ b, i }))
    .filter(({ b }) => b.kind === "text" || b.kind === "link" || b.kind === "found");
  const typing = beat?.kind === "typing" ? beat.who : null;
  const caption = [...played].reverse().find((b) => b.kind === "caption");
  const asking = beat?.kind === "ask" && mode === "ask";

  const choose = (a: "yes" | "no") => {
    setAnswer(a);
    // The question's beat is where the answer's caption now stands.
    setAt(OPENING.findIndex((b) => b.kind === "ask"));
  };

  return (
    <div
      className="relative flex h-full flex-col bg-background text-foreground"
      style={{ width: SCREEN.width, height: SCREEN.height }}
    >
      {/* The chat's head, under the Dynamic Island. */}
      <div className="flex items-center gap-3 border-b border-border/60 px-4 pb-3 pt-[62px]">
        <ChevronLeft className="h-6 w-6 text-primary" aria-hidden />
        <span className="flex -space-x-2">
          {(Object.keys(FRIENDS) as Friend[]).map((f) => (
            <span key={f} className="rounded-full ring-2 ring-background">
              <Face who={f} size={30} />
            </span>
          ))}
        </span>
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-[17px] font-semibold">{GROUP[lang]}</span>
          <span className="text-[13px] text-muted-foreground">{MEMBERS[lang]}</span>
        </span>
      </div>

      {/* The messages, from the bottom up, as a chat fills: the oldest go off the top. */}
      <div className="flex flex-1 flex-col justify-end gap-2 overflow-hidden px-3 pb-3">
        <AnimatePresence initial={false}>
          {shown.map(({ b, i }) => {
            if (b.kind === "text") {
              const dim = asking && !b.key;
              return (
                <motion.div
                  key={i}
                  layout
                  initial={{ opacity: 0, y: 14, scale: 0.96 }}
                  animate={{ opacity: dim ? 0.35 : 1, y: 0, scale: asking && b.key ? 1.06 : 1 }}
                  transition={POP}
                  className="flex max-w-[80%] shrink-0 origin-bottom-left items-end gap-2"
                >
                  <Face who={b.who} />
                  <span className="flex flex-col">
                    <span className="px-3 pb-0.5 text-[12px] text-muted-foreground">
                      {FRIENDS[b.who].name}
                    </span>
                    <span
                      className={`rounded-[20px] bg-secondary px-[14px] py-[9px] text-[17px] leading-snug ${
                        asking && b.key ? "ring-2 ring-primary" : ""
                      }`}
                    >
                      {b.text[lang]}
                    </span>
                  </span>
                </motion.div>
              );
            }
            if (b.kind === "link") {
              return (
                <motion.div
                  key={i}
                  layout
                  initial={{ opacity: 0, y: 20, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={POP}
                  className="w-[250px] shrink-0 origin-bottom-right self-end overflow-hidden rounded-[20px] border border-border bg-card"
                >
                  <img src="/og-image.png" alt="" className="block h-[131px] w-full object-cover" />
                  <span className="flex flex-col px-3 py-2 leading-tight">
                    <span className="text-[15px] font-semibold">{APP_NAME}</span>
                    <span className="text-[13px] text-muted-foreground">{LINK_DETAIL[lang]}</span>
                  </span>
                </motion.div>
              );
            }
            return (
              <motion.div
                key={i}
                layout
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 18 }}
                className="my-2 flex shrink-0 items-center gap-3 self-center rounded-2xl bg-card px-4 py-3 shadow-lg ring-1 ring-border"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-everyone text-white">
                  <Check className="h-5 w-5" strokeWidth={3} aria-hidden />
                </span>
                <span className="flex flex-col leading-tight">
                  <span className="text-[17px] font-semibold">{FOUND.title[lang]}</span>
                  <span className="text-[13px] text-muted-foreground">{FOUND.detail[lang]}</span>
                </span>
              </motion.div>
            );
          })}
          {typing && (
            <motion.div
              key={`typing-${at}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex shrink-0 items-end gap-2"
            >
              <Face who={typing} />
              <span className="rounded-[20px] bg-secondary px-[14px] py-[11px]">
                <Dots />
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Under the chat: the question, or what the app says. */}
      <div className="flex min-h-[176px] flex-col items-center justify-start px-5 pb-10 pt-4">
        <AnimatePresence mode="wait">
          {asking ? (
            <motion.div
              key="ask"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={POP}
              className="flex w-full flex-col items-center gap-4"
            >
              <span className="text-center text-[20px] font-semibold">{QUESTION[lang]}</span>
              <span className="flex w-full gap-3">
                <button
                  type="button"
                  onClick={() => choose("yes")}
                  className="glass-pill h-12 flex-1 rounded-full text-[17px] font-bold text-primary"
                >
                  {YES[lang]}
                </button>
                <button
                  type="button"
                  onClick={() => choose("no")}
                  className="glass-pill h-12 flex-1 rounded-full text-[17px] font-semibold"
                >
                  {NO[lang]}
                </button>
              </span>
            </motion.div>
          ) : caption ? (
            <motion.p
              key={caption.text.da}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={POP}
              className="text-center text-[20px] font-semibold"
              aria-live="polite"
            >
              {caption.text[lang]}
            </motion.p>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
