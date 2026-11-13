import { useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import ChatScene from "@/components/chatScene/ChatScene";
import { ACTIVITIES, type SceneName, type Words } from "@/components/chatScene/script";
import PhoneDevice from "@/components/welcome/phone/PhoneDevice";
import { DEVICE } from "@/components/welcome/phone/geometry";
import { useLang } from "@/i18n/lang";
import { oncePerLoad, appRandom } from "@/lib/appRandom";

/** Room above the phone for the app's line, in px. */
const LINE_ROOM = 84;

/**
 * The app's welcome (#275): the joke played on a phone, with the app's lines
 * above it. The person taps send themselves, so the first thing they ever do in
 * the app is the thing it is for: answer "Vi finder lige en dag" with it. Which
 * story and plan is drawn once per launch; after the ending, the other story
 * plays, with the next plan. `leaving` is sign-in opening over it: it fades back.
 */
export default function JokeStage({ leaving = false }: { leaving?: boolean }) {
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

  const first = oncePerLoad("welcome-joke", () => Math.floor(appRandom() * 8));
  const [round, setRound] = useState(first);
  const [cue, setCue] = useState<Words | null>(null);
  const scene: SceneName = round % 2 === 0 ? "idea" : "again";
  const scale = Math.max(
    0.3,
    Math.min((room.height - LINE_ROOM - 8) / DEVICE.height, (room.width - 32) / DEVICE.width),
  );

  return (
    <motion.div
      ref={box}
      className="flex h-full flex-col items-center"
      initial={false}
      animate={leaving ? { opacity: 0, scale: 0.96 } : { opacity: 1, scale: 1 }}
      transition={{ duration: 0.25 }}
    >
      <div
        className="flex w-full items-end justify-center px-6"
        style={{ height: LINE_ROOM, paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
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
      {room.height > 0 && (
        <div style={{ width: DEVICE.width * scale, height: DEVICE.height * scale }}>
          <div
            className="relative origin-top-left"
            style={{ width: DEVICE.width, height: DEVICE.height, transform: `scale(${scale})` }}
          >
            <PhoneDevice>
              <ChatScene
                key={round}
                scene={scene}
                activity={round % ACTIVITIES.length}
                mode="tap"
                onCue={setCue}
                onEnd={() => {
                  setCue(null);
                  setRound((r) => r + 1);
                }}
              />
            </PhoneDevice>
          </div>
        </div>
      )}
    </motion.div>
  );
}
