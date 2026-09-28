import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight, Laptop, Pause, Play, RotateCcw, Smartphone } from "lucide-react";

import IphoneScreen from "@/components/appleWalkthrough/IphoneScreen";
import MacScreen from "@/components/appleWalkthrough/MacScreen";
import { at, BLUE, SCENES, SIZE, type Device, type SceneId } from "@/components/appleWalkthrough/layout";
import { useLang } from "@/i18n/lang";
import { cn } from "@/lib/utils";

/**
 * Making an app-specific password at Apple, acted out: a drawing of Apple's
 * account pages on a Mac or an iPhone, with a pointer (or a fingertip) that
 * goes through them in order and a caption for each step. The iCloud setup
 * shows it before it hands out the link to Apple, so people have seen every
 * screen before they meet it.
 *
 * The drawings (MacScreen, IphoneScreen) were made from screenshots of
 * account.apple.com. Two things those showed shape the route acted out here.
 * Signing in with Face ID, Touch ID or a passkey is not enough: Apple then
 * refuses to make the password and asks for a password sign-in. So the
 * pointer declines the biometric sign-in and leaves the passkey button alone.
 * And the final box has no copy button, so the password is selected by hand,
 * which on a phone means dragging iOS's selection handles out to both ends.
 *
 * The timeline is a list of beats per device: where the pointer is, whether
 * it clicks (or presses and holds), and which state the screen is in. Anyone
 * whose system asks for less motion gets no autoplay and no gliding, just the
 * same frames to step through.
 */

interface Beat {
  scene: SceneId;
  /** Which state the scene is drawn in: typed text, scrolled, selected. */
  phase: number;
  /** Where the pointer is, in the drawing's coordinates. */
  at: [number, number];
  click?: boolean;
  /** A long press (iPhone), which gets a slower ripple than a tap. */
  press?: boolean;
  /** How long this beat lasts before the next one. */
  ms: number;
  /** The beat shown when someone steps to this scene by hand. */
  key?: boolean;
}

// Coordinates follow the layouts in MacScreen.tsx and IphoneScreen.tsx.
const BEATS: Record<Device, Beat[]> = {
  mac: [
    { scene: "landing", phase: 0, at: [560, 260], ms: 900 },
    { scene: "landing", phase: 0, at: [360, 377], ms: 1100, key: true },
    { scene: "landing", phase: 0, at: [360, 377], ms: 700, click: true },

    { scene: "biometric", phase: 0, at: [360, 377], ms: 900 },
    { scene: "biometric", phase: 0, at: [454, 123], ms: 1200, key: true },
    { scene: "biometric", phase: 0, at: [454, 123], ms: 700, click: true },

    { scene: "signIn", phase: 0, at: [360, 198], ms: 1000 },
    { scene: "signIn", phase: 1, at: [360, 198], ms: 900 },
    { scene: "signIn", phase: 2, at: [360, 232], ms: 1000 },
    { scene: "signIn", phase: 2, at: [452, 232], ms: 800, key: true },
    { scene: "signIn", phase: 2, at: [452, 232], ms: 700, click: true },

    { scene: "code", phase: 0, at: [360, 200], ms: 900 },
    { scene: "code", phase: 1, at: [360, 200], ms: 1300, key: true },

    { scene: "security", phase: 0, at: [470, 250], ms: 1100 },
    { scene: "security", phase: 1, at: [470, 250], ms: 900 },
    { scene: "security", phase: 2, at: [346, 321], ms: 1000, key: true },
    { scene: "security", phase: 2, at: [346, 321], ms: 700, click: true },

    // The tip rests on the corner of the +, so the arrow doesn't hide it.
    { scene: "list", phase: 0, at: [346, 321], ms: 800 },
    { scene: "list", phase: 0, at: [512, 244], ms: 1100, key: true },
    { scene: "list", phase: 0, at: [512, 244], ms: 700, click: true },

    { scene: "generate", phase: 0, at: [360, 215], ms: 1000 },
    { scene: "generate", phase: 1, at: [360, 215], ms: 900 },
    { scene: "generate", phase: 1, at: [360, 253], ms: 800, key: true },
    { scene: "generate", phase: 1, at: [360, 253], ms: 700, click: true },

    { scene: "confirm", phase: 0, at: [360, 219], ms: 1000 },
    { scene: "confirm", phase: 1, at: [360, 219], ms: 900 },
    { scene: "confirm", phase: 1, at: [360, 255], ms: 800, key: true },
    { scene: "confirm", phase: 1, at: [360, 255], ms: 700, click: true },

    { scene: "reveal", phase: 0, at: [360, 180], ms: 1100 },
    { scene: "reveal", phase: 1, at: [360, 180], ms: 800, click: true },
    { scene: "reveal", phase: 2, at: [360, 180], ms: 1300, key: true },
    { scene: "reveal", phase: 2, at: [360, 259], ms: 900 },
    { scene: "reveal", phase: 2, at: [360, 259], ms: 1000, click: true },
  ],
  iphone: [
    { scene: "landing", phase: 0, at: [270, 520], ms: 900 },
    { scene: "landing", phase: 0, at: [180, 414], ms: 1100, key: true },
    { scene: "landing", phase: 0, at: [180, 414], ms: 700, click: true },

    { scene: "biometric", phase: 0, at: [180, 414], ms: 900 },
    { scene: "biometric", phase: 0, at: [319, 405], ms: 1200, key: true },
    { scene: "biometric", phase: 0, at: [319, 405], ms: 700, click: true },

    { scene: "signIn", phase: 0, at: [180, 260], ms: 1000 },
    { scene: "signIn", phase: 1, at: [180, 260], ms: 900 },
    { scene: "signIn", phase: 1, at: [93, 366], ms: 800 },
    { scene: "signIn", phase: 1, at: [93, 366], ms: 600, click: true },
    { scene: "signIn", phase: 2, at: [180, 310], ms: 1000 },
    { scene: "signIn", phase: 2, at: [93, 366], ms: 800, key: true },
    { scene: "signIn", phase: 2, at: [93, 366], ms: 600, click: true },

    { scene: "code", phase: 0, at: [180, 218], ms: 900 },
    { scene: "code", phase: 1, at: [180, 218], ms: 1300, key: true },

    // A long scroll: the tile needed is the last of seven.
    { scene: "security", phase: 0, at: [240, 300], ms: 1100 },
    { scene: "security", phase: 1, at: [240, 300], ms: 1600 },
    { scene: "security", phase: 2, at: [180, 422], ms: 1000, key: true },
    { scene: "security", phase: 2, at: [180, 422], ms: 700, click: true },

    { scene: "list", phase: 0, at: [180, 422], ms: 800 },
    { scene: "list", phase: 0, at: [329, 251], ms: 1100, key: true },
    { scene: "list", phase: 0, at: [329, 251], ms: 700, click: true },

    { scene: "generate", phase: 0, at: [180, 338], ms: 1000 },
    { scene: "generate", phase: 1, at: [180, 338], ms: 900 },
    { scene: "generate", phase: 1, at: [180, 393], ms: 800, key: true },
    { scene: "generate", phase: 1, at: [180, 393], ms: 700, click: true },

    { scene: "confirm", phase: 0, at: [180, 332], ms: 1000 },
    { scene: "confirm", phase: 1, at: [180, 332], ms: 900 },
    { scene: "confirm", phase: 1, at: [180, 385], ms: 800, key: true },
    { scene: "confirm", phase: 1, at: [180, 385], ms: 700, click: true },

    // Press and hold selects one group; drag both handles out; Kopier; OK.
    { scene: "reveal", phase: 0, at: [157, 291], ms: 1100 },
    { scene: "reveal", phase: 1, at: [157, 291], ms: 1400, press: true },
    { scene: "reveal", phase: 2, at: [94, 291], ms: 900 },
    { scene: "reveal", phase: 3, at: [266, 291], ms: 1000, key: true },
    { scene: "reveal", phase: 3, at: [52, 327], ms: 900 },
    { scene: "reveal", phase: 4, at: [52, 327], ms: 700, click: true },
    { scene: "reveal", phase: 4, at: [180, 407], ms: 900 },
    { scene: "reveal", phase: 4, at: [180, 407], ms: 1000, click: true },
  ],
};

function keyBeat(beats: Beat[], scene: SceneId): number {
  return beats.findIndex((b) => b.scene === scene && b.key);
}

type Captions = Record<Device, Record<SceneId, string>>;

const da = {
  captions: {
    mac: {
      landing: "Klik på Log ind.",
      biometric:
        "Tilbyder din Mac Touch ID, så klik på Annuller. Apple skal have din adgangskode, ikke dit fingeraftryk.",
      signIn: "Log ind med din e-mail og din Apple-adgangskode.",
      code: "Skriv den kode, Apple sender til din iPhone.",
      security: "Rul ned, og klik på App-specifikke adgang…",
      list: "Klik på +.",
      generate: "Skriv Casy, og klik på Opret.",
      confirm: "Beder Apple om din adgangskode igen? Skriv den, og klik på Fortsæt.",
      reveal: "Markér koden ved at klikke tre gange på den, kopiér den med ⌘C, og klik på OK.",
    },
    iphone: {
      landing: "Tryk på Log ind.",
      biometric: "Brug ikke Face ID her. Tryk på krydset for at lukke boksen. Apple skal have din adgangskode.",
      signIn:
        "Skriv din e-mail, og tryk på Fortsæt, ikke på Log ind med loginnøgle. Skriv så din adgangskode, og tryk på Fortsæt.",
      code: "Skriv den kode, Apple sender dig.",
      security: "Rul langt ned, og tryk på App-specifikke adgang…",
      list: "Tryk på +.",
      generate: "Skriv Casy, og tryk på Opret.",
      confirm: "Beder Apple om din adgangskode igen? Skriv den, og tryk på Fortsæt.",
      reveal:
        "Hold fingeren på koden, og træk de blå prikker ud til hver sin ende, så hele koden er markeret. Tryk på Kopier og så på OK.",
    },
  } satisfies Captions,
  controls: {
    previous: "Forrige",
    next: "Næste",
    pause: "Pause",
    play: "Afspil",
    replay: "Se igen",
    goTo: (n: number) => `Gå til ${n}`,
    showFor: "Vis for",
  },
};

const en: typeof da = {
  captions: {
    mac: {
      landing: "Click Sign In.",
      biometric:
        "If your Mac offers Touch ID, click Cancel. Apple needs your password, not your fingerprint.",
      signIn: "Sign in with your email and your Apple password.",
      code: "Type the code Apple sends to your iPhone.",
      security: "Scroll down and click App-Specific Passwo…",
      list: "Click +.",
      generate: "Type Casy and click Create.",
      confirm: "If Apple asks for your password again, type it and click Continue.",
      reveal: "Select the code by clicking it three times, copy it with ⌘C, and click OK.",
    },
    iphone: {
      landing: "Tap Sign In.",
      biometric: "Don't use Face ID here. Tap the X to close the box. Apple needs your password.",
      signIn:
        "Type your email and tap Continue, not Sign in with Passkey. Then type your password and tap Continue.",
      code: "Type the code Apple sends you.",
      security: "Scroll a long way down and tap App-Specific Passwo…",
      list: "Tap +.",
      generate: "Type Casy and tap Create.",
      confirm: "If Apple asks for your password again, type it and tap Continue.",
      reveal:
        "Press and hold the code, then drag the blue dots out to either end so the whole code is selected. Tap Copy, then OK.",
    },
  },
  controls: {
    previous: "Previous",
    next: "Next",
    pause: "Pause",
    play: "Play",
    replay: "Watch again",
    goTo: (n: number) => `Go to ${n}`,
    showFor: "Show for",
  },
};

function useCopy() {
  const { lang } = useLang();
  return lang === "da" ? da : en;
}

/** macOS's arrow pointer, tip at the element's top left. */
function Pointer() {
  return (
    <svg width="14" height="20" viewBox="0 0 14 20" style={{ filter: "drop-shadow(0 1px 1.5px rgba(0,0,0,0.35))" }}>
      <path
        d="M1 1 L1 16 L4.8 12.4 L7.6 18.6 L10 17.6 L7.3 11.5 L12.5 11.5 Z"
        fill="#000"
        stroke="#fff"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** A fingertip on the phone: a soft circle centred on the spot it touches. */
function Fingertip() {
  return <span className="block h-7 w-7 rounded-full border-2 border-white/90 bg-black/25 shadow-[0_1px_4px_rgba(0,0,0,0.3)]" />;
}

export default function AppleWalkthrough({ device }: { device: Device }) {
  const c = useCopy();
  const reduceMotion = useReducedMotion();
  const beats = BEATS[device];
  const { w, h } = SIZE[device];
  const [beat, setBeat] = useState(() => (reduceMotion ? keyBeat(beats, "landing") : 0));
  const [playing, setPlaying] = useState(!reduceMotion);
  const current = beats[beat];
  const sceneIndex = SCENES.indexOf(current.scene);
  const finished = !playing && beat === beats.length - 1;

  // Scaled to whatever width the page gives it; the drawing keeps its layout.
  const frameRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.8);
  useLayoutEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / w));
    observer.observe(el);
    return () => observer.disconnect();
  }, [w]);

  // The clock: each beat hands over to the next when its time is up, and the
  // last one stops the show rather than looping, so it ends on the password.
  useEffect(() => {
    if (!playing) return;
    const timer = setTimeout(() => {
      if (beat + 1 < beats.length) setBeat(beat + 1);
      else setPlaying(false);
    }, beats[beat].ms);
    return () => clearTimeout(timer);
  }, [playing, beat, beats]);

  function showScene(index: number) {
    setPlaying(false);
    setBeat(keyBeat(beats, SCENES[index]));
  }

  function togglePlay() {
    if (finished) {
      setBeat(0);
      setPlaying(true);
    } else {
      setPlaying((p) => !p);
    }
  }

  const isPhone = device === "iphone";
  // The phone's bezel, both sides together, which the height must allow for.
  const frameBorder = isPhone ? 14 : 0;
  const pointerOffset = isPhone ? 14 : 1;
  const tapping = current.click || current.press;
  const iconButton =
    "flex h-9 w-9 items-center justify-center rounded-full border bg-card text-foreground transition hover:bg-secondary disabled:pointer-events-none disabled:opacity-30";

  return (
    <div>
      <div
        ref={frameRef}
        aria-hidden="true"
        className={cn(
          "relative w-full overflow-hidden bg-white",
          isPhone
            ? "mx-auto max-w-[300px] rounded-[34px] border-[7px] border-neutral-900 shadow-md"
            : "rounded-xl border shadow-sm",
        )}
        style={{ height: h * scale + frameBorder }}
      >
        <div style={{ width: w, height: h, transform: `scale(${scale})`, transformOrigin: "top left" }} className="relative">
          {isPhone ? (
            <IphoneScreen scene={current.scene} phase={current.phase} />
          ) : (
            <MacScreen scene={current.scene} phase={current.phase} />
          )}
          {tapping && !reduceMotion && (
            <motion.span
              key={beat}
              initial={{ scale: 0.2, opacity: 0.55 }}
              animate={{ scale: current.press ? 2.2 : 1.6, opacity: 0 }}
              transition={{ duration: current.press ? 1.1 : 0.55 }}
              style={{ ...at(current.at[0] - 12, current.at[1] - 12, 24, 24), background: BLUE }}
              className="rounded-full"
            />
          )}
          <motion.div
            style={at(0, 0)}
            initial={false}
            animate={{ x: current.at[0] - pointerOffset, y: current.at[1] - pointerOffset, scale: tapping ? 0.85 : 1 }}
            transition={{ duration: reduceMotion ? 0 : 0.65, ease: "easeInOut" }}
          >
            {isPhone ? <Fingertip /> : <Pointer />}
          </motion.div>
        </div>
      </div>

      {/* Spoken only when someone steps by hand; read aloud every few
          seconds while it plays, it would talk over everything else. */}
      <p aria-live={playing ? "off" : "polite"} className="mt-3 min-h-[2.75rem] text-sm leading-relaxed text-foreground">
        <span className="mr-1.5 font-semibold tabular-nums text-primary">{sceneIndex + 1}.</span>
        {c.captions[device][current.scene]}
      </p>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => showScene(sceneIndex - 1)} disabled={sceneIndex === 0} aria-label={c.controls.previous} className={iconButton}>
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={togglePlay}
            aria-label={playing ? c.controls.pause : finished ? c.controls.replay : c.controls.play}
            className={cn(iconButton, finished && "w-auto gap-1.5 px-3 text-sm font-medium")}
          >
            {playing ? (
              <Pause className="h-4 w-4" />
            ) : finished ? (
              <>
                <RotateCcw className="h-4 w-4" />
                {c.controls.replay}
              </>
            ) : (
              <Play className="h-4 w-4" />
            )}
          </button>
          <button
            type="button"
            onClick={() => showScene(sceneIndex + 1)}
            disabled={sceneIndex === SCENES.length - 1}
            aria-label={c.controls.next}
            className={iconButton}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center">
          {SCENES.map((s, i) => (
            <button key={s} type="button" onClick={() => showScene(i)} aria-label={c.controls.goTo(i + 1)} className="p-1">
              <span className={cn("block h-2 w-2 rounded-full transition-colors", i === sceneIndex ? "bg-primary" : "bg-border")} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Mac or iPhone: which drawing and which words (click or tap) to show. The
 * page picks a default from the screen it's on; this lets someone reading on
 * one device follow along for the other.
 */
export function DevicePicker({ device, onChange }: { device: Device; onChange: (device: Device) => void }) {
  const c = useCopy();
  const options: { id: Device; label: string; Icon: typeof Laptop }[] = [
    { id: "mac", label: "Mac", Icon: Laptop },
    { id: "iphone", label: "iPhone", Icon: Smartphone },
  ];
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">{c.controls.showFor}</span>
      <div role="group" aria-label={c.controls.showFor} className="inline-flex rounded-full border bg-secondary/60 p-0.5">
        {options.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            aria-pressed={device === id}
            onClick={() => onChange(id)}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium transition",
              device === id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * The same steps as plain text, for the step where people go and do it: what
 * they glance back at between tabs, word for word what the animation said.
 */
export function AppleWalkthroughChecklist({ device }: { device: Device }) {
  const c = useCopy();
  return (
    <ol className="space-y-2">
      {SCENES.map((s, i) => (
        <li key={s} className="flex gap-3 text-sm text-foreground">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold tabular-nums text-primary">
            {i + 1}
          </span>
          <span className="pt-0.5 leading-relaxed">{c.captions[device][s]}</span>
        </li>
      ))}
    </ol>
  );
}
