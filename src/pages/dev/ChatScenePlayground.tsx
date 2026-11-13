import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import ChatScene from "@/components/chatScene/ChatScene";
import { ACTIVITIES, SCENES, type SceneName, type Words } from "@/components/chatScene/script";
import PhoneDevice from "@/components/welcome/phone/PhoneDevice";
import { DEVICE } from "@/components/welcome/phone/geometry";
import { useLang } from "@/i18n/lang";

/**
 * Dev-only (/dev/chat, never in a production build; see App.tsx): the joke's
 * chat scenes (#275, #270) on the welcome phone, with their cues shown above
 * it as the welcome screen and the computer's ad will, to try before they go
 * in. English controls, since no visitor ever sees them.
 */
export default function ChatScenePlayground() {
  const { lang, setLang } = useLang();
  const [scene, setScene] = useState<SceneName>("idea");
  const [activity, setActivity] = useState(0);
  const [mode, setMode] = useState<"tap" | "auto">("tap");
  const [run, setRun] = useState(0);
  const [cue, setCue] = useState<Words | null>(null);
  const scale = Math.min(1, (window.innerHeight - 190) / DEVICE.height);
  const restart = () => {
    setCue(null);
    setRun((r) => r + 1);
  };
  const button = "glass-pill rounded-full px-4 py-2";

  return (
    <div className="flex min-h-screen flex-col items-center gap-3 bg-background p-4">
      <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
        <button className={button} onClick={restart}>
          Play again
        </button>
        <button
          className={button}
          onClick={() => {
            setScene(scene === "idea" ? "again" : "idea");
            restart();
          }}
        >
          Story: {scene === "idea" ? "a new idea" : "did we ever?"}
        </button>
        <button
          className={button}
          onClick={() => {
            setActivity((a) => (a + 1) % ACTIVITIES.length);
            restart();
          }}
        >
          Plan: {ACTIVITIES[activity].title.en}
        </button>
        <button
          className={button}
          onClick={() => {
            setMode(mode === "tap" ? "auto" : "tap");
            restart();
          }}
        >
          {mode === "tap" ? "App: you tap send" : "Computer: sends by itself"}
        </button>
        <button
          className={button}
          onClick={() => {
            setLang(lang === "da" ? "en" : "da");
            restart();
          }}
        >
          {lang === "da" ? "Dansk" : "English"}
        </button>
      </div>
      {/* The cue, outside the phone: what the app says, while the chat waits. */}
      <div className="flex h-12 items-center">
        <AnimatePresence mode="wait">
          {cue && (
            <motion.p
              key={cue.da}
              initial={{ opacity: 0, y: 10, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ type: "spring", stiffness: 380, damping: 28 }}
              className="text-center text-2xl font-bold"
              aria-live="polite"
            >
              {cue[lang]}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
      <div style={{ width: DEVICE.width * scale, height: DEVICE.height * scale }}>
        <div
          className="relative origin-top-left"
          style={{ width: DEVICE.width, height: DEVICE.height, transform: `scale(${scale})` }}
        >
          <PhoneDevice>
            <ChatScene
              key={`${run}-${scene}-${activity}-${mode}-${lang}`}
              scene={scene}
              activity={activity}
              mode={mode}
              onCue={setCue}
              onEnd={
                mode === "auto"
                  ? () => {
                      // On the computer, the next story and plan, round and round.
                      setScene((s) => (s === "idea" ? "again" : "idea"));
                      setActivity((a) => (a + 1) % ACTIVITIES.length);
                      restart();
                    }
                  : undefined
              }
            />
          </PhoneDevice>
        </div>
      </div>
      <p className="sr-only">{Object.keys(SCENES).length} stories</p>
    </div>
  );
}
