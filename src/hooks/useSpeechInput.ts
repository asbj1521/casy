/**
 * Talking instead of typing (#100). Danish or English as the site is, and
 * free: Casy itself only ever gets the text.
 *
 * On the website, the browser's own speech recognition: Chrome sends the
 * sound to Google to be written out, Edge to Microsoft, Safari to Apple (or
 * keeps it on the device). Safari offers it on secure pages only, and
 * Firefox not at all; there `supported` is false and the page shows no
 * microphone, while the keyboard's own dictation still works.
 *
 * In the iPhone app, whose web view has no speech recognition, Apple's own
 * through a native plugin (@capgo/capacitor-speech-recognition), loaded only
 * there so the website never downloads it. It stays on the phone where the
 * phone can do Danish (or English) by itself, and uses Apple's servers
 * otherwise. The privacy policy says all of this.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { PluginListenerHandle } from "@capacitor/core";

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

/** The app's speech recognition, loaded on first use. */
async function nativeSpeech() {
  const { SpeechRecognition } = await import("@capgo/capacitor-speech-recognition");
  return SpeechRecognition;
}

const SPEECH_LANG: Record<Lang, string> = { da: "da-DK", en: "en-GB" };

export type SpeechError = "denied" | "failed";

/** What was heard, tidied: one line, single spaces. */
const tidy = (text: string) => text.replace(/\s+/g, " ").trim();

/**
 * Listen and hand over what is said, as it is heard: `onText` gets the whole
 * transcript so far each time (words may still change until it stops).
 */
export function useSpeechInput(lang: Lang, onText: (text: string) => void) {
  // The website knows at once; the app asks the phone, and shows the
  // microphone once it has said yes.
  const [supported, setSupported] = useState(() => recognitionConstructor() !== null);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<SpeechError | null>(null);
  const recognition = useRef<Recognition | null>(null);
  const nativeListeners = useRef<PluginListenerHandle[]>([]);
  const latestOnText = useRef(onText);
  useEffect(() => {
    latestOnText.current = onText;
  }, [onText]);

  useEffect(() => {
    if (!isNativeApp) return;
    let live = true;
    nativeSpeech()
      .then((speech) => speech.available())
      .then(({ available }) => live && setSupported(available))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  /** The app's session is over: its listeners go, and the button turns back. */
  const endNative = useCallback(() => {
    const handles = nativeListeners.current;
    nativeListeners.current = [];
    for (const handle of handles) void handle.remove();
    setListening(false);
  }, []);

  const startNative = useCallback(async () => {
    setError(null);
    setListening(true);
    try {
      const speech = await nativeSpeech();
      let permission = await speech.checkPermissions();
      if (permission.speechRecognition !== "granted") {
        permission = await speech.requestPermissions();
      }
      if (permission.speechRecognition !== "granted") {
        setError("denied");
        setListening(false);
        return;
      }
      const language = SPEECH_LANG[lang];
      nativeListeners.current = await Promise.all([
        speech.addListener("partialResults", (event) => {
          const heard = event.accumulatedText ?? event.matches?.[0];
          if (heard) latestOnText.current(tidy(heard));
        }),
        speech.addListener("listeningState", (event) => {
          if ((event.state ?? event.status) === "stopped") endNative();
        }),
        speech.addListener("error", () => setError("failed")),
      ]);
      // Apple's long-standing recognizer, kept on the phone where it can be:
      // the newest one can end a session without a word on some iOS 26 phones.
      const { available: onDevice } = await speech
        .isOnDeviceRecognitionAvailable({ language, preferLegacyRecognizer: true })
        .catch(() => ({ available: false }));
      await speech.start({
        language,
        partialResults: true,
        addPunctuation: true,
        preferLegacyRecognizer: true,
        useOnDeviceRecognition: onDevice,
      });
    } catch {
      setError("failed");
      endNative();
    }
  }, [lang, endNative]);

  const stop = useCallback(() => {
    if (isNativeApp) {
      if (nativeListeners.current.length > 0) {
        void nativeSpeech()
          .then((speech) => speech.stop())
          .catch(() => {})
          .finally(endNative);
      }
      return;
    }
    recognition.current?.stop();
  }, [endNative]);

  const start = useCallback(() => {
    if (isNativeApp) {
      if (!listening) void startNative();
      return;
    }
    const Ctor = recognitionConstructor();
    if (!Ctor || recognition.current) return;
    const r = new Ctor();
    r.lang = SPEECH_LANG[lang];
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (event) => {
      const text = Array.from(event.results, (result) => result[0].transcript).join("");
      latestOnText.current(tidy(text));
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
  }, [lang, listening, startNative]);

  // Leaving the page stops the microphone.
  useEffect(
    () => () => {
      recognition.current?.abort();
      if (nativeListeners.current.length > 0) {
        void nativeSpeech()
          .then((speech) => speech.stop())
          .catch(() => {});
        for (const handle of nativeListeners.current) void handle.remove();
      }
    },
    [],
  );

  return { supported, listening, error, start, stop };
}
