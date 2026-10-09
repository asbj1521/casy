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

/** `promise`, or a failure naming `step`: what it said, or that it never answered within `ms`. */
function within<T>(promise: Promise<T>, ms: number, step: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${step}: no answer in ${ms / 1000} s`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(new Error(`${step}: ${err instanceof Error ? err.message : String(err)}`));
      },
    );
  });
}

/** What was heard, tidied: one line, single spaces. */
const tidy = (text: string) => text.replace(/\s+/g, " ").trim();

/**
 * Listen and hand over what is said, as it is heard: `onText` gets the whole
 * transcript so far each time (words may still change until it stops).
 */
export function useSpeechInput(lang: Lang, onText: (text: string) => void) {
  // The app always has it (Apple's, through the plugin); a browser only
  // where it offers it. In the app the plugin's own availability check isn't
  // used: without a language it asks about the phone's locale, which Apple
  // may not recognise ("en_DK"), and would hide the button for no reason. A
  // real failure shows when the button is tapped.
  const [supported] = useState(() => isNativeApp || recognitionConstructor() !== null);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<SpeechError | null>(null);
  // In the app: which step failed, and how Apple put it.
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const recognition = useRef<Recognition | null>(null);
  const nativeListeners = useRef<PluginListenerHandle[]>([]);
  const latestOnText = useRef(onText);
  useEffect(() => {
    latestOnText.current = onText;
  }, [onText]);

  /** The app's session is over: its listeners go, and the button turns back. */
  const endNative = useCallback(() => {
    const handles = nativeListeners.current;
    nativeListeners.current = [];
    for (const handle of handles) void handle.remove();
    setListening(false);
  }, []);

  /** Which start is the latest: Stop, or leaving, makes an earlier one give up. */
  const attempt = useRef(0);

  const startNative = useCallback(async () => {
    const run = ++attempt.current;
    const current = () => attempt.current === run;
    setError(null);
    setErrorDetail(null);
    setListening(true);
    try {
      const speech = await within(nativeSpeech(), 5_000, "load");
      let permission = await within(speech.checkPermissions(), 5_000, "checkPermissions");
      if (!current()) return;
      if (permission.speechRecognition !== "granted") {
        // A minute to answer iOS's two questions (microphone, speech recognition).
        permission = await within(speech.requestPermissions(), 60_000, "requestPermissions");
      }
      if (!current()) return;
      if (permission.speechRecognition !== "granted") {
        setError("denied");
        setListening(false);
        return;
      }
      const language = SPEECH_LANG[lang];
      const handles = await within(
        Promise.all([
          speech.addListener("partialResults", (event) => {
            const heard = event.accumulatedText ?? event.matches?.[0];
            if (heard) latestOnText.current(tidy(heard));
          }),
          speech.addListener("listeningState", (event) => {
            if ((event.state ?? event.status) === "stopped") endNative();
          }),
          speech.addListener("error", (event) => {
            setError("failed");
            setErrorDetail(`${event.code}: ${event.message}`);
          }),
        ]),
        5_000,
        "addListener",
      );
      if (!current()) {
        for (const handle of handles) void handle.remove();
        return;
      }
      nativeListeners.current = handles;
      // Apple's long-standing recognizer, kept on the phone where it can be:
      // the newest one can end a session without a word on some iOS 26 phones.
      const { available: onDevice } = await within(
        speech.isOnDeviceRecognitionAvailable({ language, preferLegacyRecognizer: true }),
        5_000,
        "isOnDeviceRecognitionAvailable",
      ).catch(() => ({ available: false }));
      if (!current()) return;
      await within(
        speech.start({
          language,
          partialResults: true,
          addPunctuation: true,
          preferLegacyRecognizer: true,
          useOnDeviceRecognition: onDevice,
        }),
        10_000,
        "start",
      );
    } catch (err) {
      if (!current()) return;
      // Said under the box, with the step and Apple's own words, so a phone
      // that can't do it says why.
      const detail = err instanceof Error ? err.message : String(err);
      console.error("speech recognition failed", detail);
      setError("failed");
      setErrorDetail(detail);
      endNative();
    }
  }, [lang, endNative]);

  const stop = useCallback(() => {
    if (isNativeApp) {
      // Whatever the start had got to: it gives up, the phone stops listening,
      // and the button turns back at once.
      attempt.current++;
      void nativeSpeech()
        .then((speech) => speech.stop())
        .catch(() => {});
      endNative();
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
      attempt.current++;
      if (nativeListeners.current.length > 0) {
        void nativeSpeech()
          .then((speech) => speech.stop())
          .catch(() => {});
        for (const handle of nativeListeners.current) void handle.remove();
      }
    },
    [],
  );

  return { supported, listening, error, errorDetail, start, stop };
}
