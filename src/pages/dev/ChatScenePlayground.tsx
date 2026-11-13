import { useState } from "react";

import ChatScene from "@/components/chatScene/ChatScene";
import PhoneDevice from "@/components/welcome/phone/PhoneDevice";
import { DEVICE } from "@/components/welcome/phone/geometry";
import { useLang } from "@/i18n/lang";

/**
 * Dev-only (/dev/chat, never in a production build; see App.tsx): the joke's
 * chat scene (#275, #270) on the welcome phone, to try before it goes into the
 * app's welcome screen and the computer's ad. English controls, since no
 * visitor ever sees it.
 */
export default function ChatScenePlayground() {
  const { lang, setLang } = useLang();
  const [mode, setMode] = useState<"ask" | "auto">("ask");
  const [run, setRun] = useState(0);
  const scale = Math.min(1, (window.innerHeight - 120) / DEVICE.height);

  return (
    <div className="flex min-h-screen flex-col items-center gap-4 bg-background p-4">
      <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
        <button className="glass-pill rounded-full px-4 py-2" onClick={() => setRun((r) => r + 1)}>
          Play again
        </button>
        <button
          className="glass-pill rounded-full px-4 py-2"
          onClick={() => {
            setMode(mode === "ask" ? "auto" : "ask");
            setRun((r) => r + 1);
          }}
        >
          {mode === "ask" ? "App: asks Ja / Nej" : "Computer ad: plays by itself"}
        </button>
        <button
          className="glass-pill rounded-full px-4 py-2"
          onClick={() => {
            setLang(lang === "da" ? "en" : "da");
            setRun((r) => r + 1);
          }}
        >
          {lang === "da" ? "Dansk" : "English"}
        </button>
      </div>
      <div style={{ width: DEVICE.width * scale, height: DEVICE.height * scale }}>
        <div
          className="relative origin-top-left"
          style={{ width: DEVICE.width, height: DEVICE.height, transform: `scale(${scale})` }}
        >
          <PhoneDevice>
            <ChatScene
              key={`${run}-${mode}-${lang}`}
              mode={mode}
              onEnd={mode === "auto" ? () => setRun((r) => r + 1) : undefined}
            />
          </PhoneDevice>
        </div>
      </div>
    </div>
  );
}
