import { useState, type RefObject } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Mic, Sparkles } from "lucide-react";

import { MAX_NAME_LENGTH } from "@/components/schedulerSettings/options";
import SoundWave from "@/components/ui/SoundWave";
import { FIELD, FIELD_LABEL } from "@/components/ui/field";
import { useSpeechInput } from "@/hooks/useSpeechInput";
import { useLang, useT } from "@/i18n/lang";
import { cn } from "@/lib/utils";

/** How much a description for Casy's AI may hold (the plan-ai box's limit). */
const MAX_DESCRIPTION = 500;

/**
 * The Planlæg sheet's name field (#173), which is also where Casy's AI is
 * asked: for someone the AI is on for, its right end holds a microphone
 * while it is empty and ✨ once something is written or said. ✨ sends the
 * text as it stands, and Casy fills in the sheet. Without the AI it is the
 * plain name field, as long as a title may be.
 */
export default function NameField({
  value,
  onChange,
  ai,
  fieldRef,
  lit,
  label,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  /** Casy's AI, for those it is on for. */
  ai: { pending: boolean; error: string | null; onAsk: () => void } | null;
  /** The field's box, which Casy's questions drop from. */
  fieldRef: RefObject<HTMLDivElement | null>;
  /** Casy is typing in it right now. */
  lit: boolean;
  /** Another label and example, for a genvej's name (#175). */
  label?: string;
  placeholder?: string;
}) {
  const t = useT();
  const words = t.aiPlan;
  const { lang } = useLang();
  // What was typed before the microphone went on; speech is added after it.
  const [before, setBefore] = useState("");
  const speech = useSpeechInput(lang, (heard) => onChange(before ? `${before} ${heard}` : heard));
  const written = value.trim() !== "";

  const ask = () => {
    speech.stop();
    if (ai && written && !ai.pending) ai.onAsk();
  };

  return (
    <div className="mt-4">
      <label className="block">
        <span className={FIELD_LABEL}>{label ?? t.scheduler.name}</span>
        <div ref={fieldRef} className="relative">
          <input
            type="text"
            value={value}
            maxLength={ai ? MAX_DESCRIPTION : MAX_NAME_LENGTH}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (ai && e.key === "Enter" && !e.nativeEvent.isComposing) {
                e.preventDefault();
                ask();
              }
            }}
            enterKeyHint={ai ? "go" : undefined}
            readOnly={ai?.pending}
            placeholder={
              speech.listening ? words.listening : (placeholder ?? t.scheduler.namePlaceholder)
            }
            className={cn(
              FIELD,
              ai && "pr-14",
              (lit || speech.listening) && "border-primary ring-2 ring-primary/20",
            )}
          />
          {ai && (
            <div className="absolute inset-y-0 right-1.5 flex items-center">
              <AnimatePresence mode="popLayout" initial={false}>
                {ai.pending ? (
                  <motion.span
                    key="pending"
                    {...POP}
                    role="status"
                    aria-label={words.thinking}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary"
                  >
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </motion.span>
                ) : written || !speech.supported ? (
                  <motion.button
                    key="ai"
                    {...POP}
                    type="button"
                    onClick={ask}
                    disabled={!written}
                    aria-label={words.start}
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-full transition-colors",
                      written
                        ? "bg-primary/10 text-primary active:bg-primary/20"
                        : "text-muted-foreground/50",
                    )}
                  >
                    <Sparkles className="h-5 w-5" />
                  </motion.button>
                ) : (
                  <motion.button
                    key="mic"
                    {...POP}
                    type="button"
                    onClick={() => {
                      if (speech.listening) speech.stop();
                      else {
                        setBefore(value.trim());
                        speech.start();
                      }
                    }}
                    aria-pressed={speech.listening}
                    aria-label={speech.listening ? words.stopSpeaking : words.speak}
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-full transition-colors",
                      speech.listening ? "bg-red-600 text-white" : "text-primary",
                    )}
                  >
                    {speech.listening ? (
                      <SoundWave listening className="scale-75" />
                    ) : (
                      <Mic className="h-5 w-5" />
                    )}
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </label>
      {speech.error && (
        <p className="mt-1.5 px-1 text-xs text-red-700">
          {speech.error === "denied" ? words.micDenied : words.micFailed}
        </p>
      )}
      {ai?.error && <p className="mt-1.5 px-1 text-xs text-red-700">{ai.error}</p>}
    </div>
  );
}

/** ✨ pops in as something is written, and the microphone pops back. */
const POP = {
  initial: { scale: 0.4, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  exit: { scale: 0.4, opacity: 0 },
  transition: { type: "spring", stiffness: 500, damping: 28 },
} as const;
