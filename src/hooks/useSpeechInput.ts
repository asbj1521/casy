/**
 * Talking instead of typing (#100), through the browser's own speech
 * recognition: free, and Danish or English as the site is. Chrome sends the
 * sound to Google to be written out, Safari to Apple (or keeps it on the
 * device); the privacy policy says so. Casy itself only ever gets the text.
 *
 * Not every browser has it: Firefox keeps it behind a setting, and the
 * iPhone app's web view doesn't offer it at all (that needs a native plugin,
 * later). There `supported` is false and the page shows no microphone; the
 * keyboard's own dictation still works in the text box.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import type { Lang } from "@/i18n/locale";
import { isNativeApp } from "@/lib/nativeApp";

/** The part of the Web Speech API used here (prefixed in Safari and Chrome). */
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface RecognitionEvent {
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}

type RecognitionConstructor = new () => Recognition;

function recognitionConstructor(): RecognitionConstructor | null {
  if (isNativeApp) return null;
  const w = window as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const SPEECH_LANG: Record<Lang, string> = { da: "da-DK", en: "en-GB" };

export type SpeechError = "denied" | "failed";

/**
 * Listen and hand over what is said, as it is heard: `onText` gets the whole
 * transcript so far each time (words may still change until `final`).
 */
export function useSpeechInput(lang: Lang, onText: (text: string) => void) {
  const [supported] = useState(() => recognitionConstructor() !== null);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<SpeechError | null>(null);
  const recognition = useRef<Recognition | null>(null);
  const latestOnText = useRef(onText);
  useEffect(() => {
    latestOnText.current = onText;
  }, [onText]);

  const stop = useCallback(() => recognition.current?.stop(), []);

  const start = useCallback(() => {
    const Ctor = recognitionConstructor();
    if (!Ctor || recognition.current) return;
    const r = new Ctor();
    r.lang = SPEECH_LANG[lang];
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (event) => {
      const text = Array.from(event.results, (result) => result[0].transcript).join("");
      latestOnText.current(text.replace(/\s+/g, " ").trim());
    };
    r.onerror = (event) => {
      // Silence or a stop is no failure; the rest are said once.
      if (event.error === "no-speech" || event.error === "aborted") return;
      setError(
        event.error === "not-allowed" || event.error === "service-not-allowed"
          ? "denied"
          : "failed",
      );
    };
    r.onend = () => {
      recognition.current = null;
      setListening(false);
    };
    recognition.current = r;
    setError(null);
    setListening(true);
    try {
      r.start();
    } catch {
      recognition.current = null;
      setListening(false);
      setError("failed");
    }
  }, [lang]);

  // Leaving the page stops the microphone.
  useEffect(() => () => recognition.current?.abort(), []);

  return { supported, listening, error, start, stop };
}
