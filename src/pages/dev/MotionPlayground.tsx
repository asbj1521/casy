import { useMemo, useState } from "react";
import { motion, type Transition } from "framer-motion";

/**
 * Dev-only (/dev/motion, never in a production build; see App.tsx): tune an
 * animation by feel. Pick what moves, drag the sliders, replay, slow it down,
 * then copy the `transition` it prints into the component. English only, since
 * no visitor ever sees it.
 */

type Kind = "spring" | "bouncy" | "tween";
type Subject = "pop" | "sheet" | "slide" | "list";

type Tuning = {
  kind: Kind;
  stiffness: number;
  damping: number;
  mass: number;
  visualDuration: number;
  bounce: number;
  duration: number;
  ease: [number, number, number, number];
  delay: number;
  stagger: number;
};

const DEFAULTS: Tuning = {
  kind: "spring",
  stiffness: 300,
  damping: 26,
  mass: 1,
  visualDuration: 0.4,
  bounce: 0.2,
  duration: 0.32,
  ease: [0.32, 0.72, 0, 1],
  delay: 0,
  stagger: 0.06,
};

/**
 * The transition for the current tuning, slowed by `slow` (1 = real time).
 * A physical spring slowed k times keeps its shape with stiffness / k² and
 * damping / k; the duration-based kinds just stretch their duration.
 */
function toTransition(t: Tuning, slow: number): Transition {
  const delay = t.delay * slow;
  if (t.kind === "spring") {
    return {
      type: "spring",
      stiffness: t.stiffness / (slow * slow),
      damping: t.damping / slow,
      mass: t.mass,
      delay,
    };
  }
  if (t.kind === "bouncy") {
    return { type: "spring", visualDuration: t.visualDuration * slow, bounce: t.bounce, delay };
  }
  return { type: "tween", duration: t.duration * slow, ease: t.ease, delay };
}

/** The same transition at real speed, as code to paste. */
function toCode(t: Tuning): string {
  const n = (v: number) => String(Math.round(v * 1000) / 1000);
  const delay = t.delay ? `, delay: ${n(t.delay)}` : "";
  if (t.kind === "spring") {
    return `transition={{ type: "spring", stiffness: ${n(t.stiffness)}, damping: ${n(t.damping)}, mass: ${n(t.mass)}${delay} }}`;
  }
  if (t.kind === "bouncy") {
    return `transition={{ type: "spring", visualDuration: ${n(t.visualDuration)}, bounce: ${n(t.bounce)}${delay} }}`;
  }
  return `transition={{ duration: ${n(t.duration)}, ease: [${t.ease.map(n).join(", ")}]${delay} }}`;
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="grid grid-cols-[7rem_1fr_3.5rem] items-center gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="text-right tabular-nums">{value}</span>
    </label>
  );
}

function Choice<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={`rounded-full border px-3 py-1 text-sm ${
            value === o.id ? "border-transparent bg-black text-white" : "border-neutral-300"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const ROWS = ["Weekend in Aarhus", "Dinner at Jonas'", "Board games", "Ski trip"];

/** What moves. `run` changes on every replay, so the animation starts over. */
function Stage({
  subject,
  transition,
  stagger,
  run,
}: {
  subject: Subject;
  transition: Transition;
  stagger: number;
  run: number;
}) {
  if (subject === "pop") {
    return (
      <motion.div
        key={run}
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={transition}
        className="h-40 w-40 rounded-3xl bg-orange-500 shadow-lg"
      />
    );
  }
  if (subject === "slide") {
    return (
      <motion.div
        key={run}
        initial={{ x: -140 }}
        animate={{ x: 140 }}
        transition={transition}
        className="h-24 w-24 rounded-2xl bg-sky-500 shadow-lg"
      />
    );
  }
  if (subject === "sheet") {
    return (
      <div className="relative h-80 w-56 overflow-hidden rounded-3xl border border-neutral-300">
        <motion.div
          key={run}
          initial={{ y: "100%" }}
          animate={{ y: "30%" }}
          transition={transition}
          className="absolute inset-x-0 bottom-0 h-full rounded-t-3xl bg-white shadow-2xl"
        >
          <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-neutral-300" />
        </motion.div>
      </div>
    );
  }
  return (
    <div key={run} className="flex w-64 flex-col gap-2">
      {ROWS.map((row, i) => (
        <motion.div
          key={row}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...transition, delay: ((transition.delay as number) ?? 0) + i * stagger }}
          className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm shadow-sm"
        >
          {row}
        </motion.div>
      ))}
    </div>
  );
}

export default function MotionPlayground() {
  const [tuning, setTuning] = useState<Tuning>(DEFAULTS);
  const [subject, setSubject] = useState<Subject>("pop");
  const [slow, setSlow] = useState(1);
  const [run, setRun] = useState(0);
  const [copied, setCopied] = useState(false);

  const set = <K extends keyof Tuning>(key: K, value: Tuning[K]) => {
    setTuning((t) => ({ ...t, [key]: value }));
    setRun((r) => r + 1);
  };

  const transition = useMemo(() => toTransition(tuning, slow), [tuning, slow]);
  const code = toCode(tuning);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // Clipboard blocked: the code is on screen to copy by hand.
    }
  };

  return (
    <main className="mx-auto grid max-w-5xl gap-8 px-4 py-8 md:grid-cols-2">
      <section className="flex flex-col items-center gap-4">
        <div className="flex h-[26rem] w-full items-center justify-center overflow-hidden rounded-3xl bg-neutral-100">
          <Stage
            subject={subject}
            transition={transition}
            stagger={tuning.stagger * slow}
            run={run}
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setRun((r) => r + 1)}
            className="rounded-full bg-black px-5 py-2 text-sm text-white"
          >
            Replay
          </button>
          <Choice
            value={String(slow)}
            options={[
              { id: "1", label: "1x" },
              { id: "3", label: "3x slower" },
              { id: "8", label: "8x slower" },
            ]}
            onChange={(v) => {
              setSlow(Number(v));
              setRun((r) => r + 1);
            }}
          />
        </div>
      </section>

      <section className="flex flex-col gap-5">
        <h1 className="text-xl font-semibold">Motion playground</h1>
        <Choice
          value={subject}
          options={[
            { id: "pop", label: "Pop in" },
            { id: "sheet", label: "Sheet" },
            { id: "slide", label: "Slide" },
            { id: "list", label: "List" },
          ]}
          onChange={(v) => {
            setSubject(v);
            setRun((r) => r + 1);
          }}
        />
        <Choice
          value={tuning.kind}
          options={[
            { id: "spring", label: "Spring (physics)" },
            { id: "bouncy", label: "Spring (duration + bounce)" },
            { id: "tween", label: "Tween (curve)" },
          ]}
          onChange={(v) => set("kind", v)}
        />

        {tuning.kind === "spring" && (
          <>
            <Slider
              label="Stiffness"
              value={tuning.stiffness}
              min={20}
              max={1000}
              step={10}
              onChange={(v) => set("stiffness", v)}
            />
            <Slider
              label="Damping"
              value={tuning.damping}
              min={2}
              max={80}
              step={1}
              onChange={(v) => set("damping", v)}
            />
            <Slider
              label="Mass"
              value={tuning.mass}
              min={0.2}
              max={4}
              step={0.1}
              onChange={(v) => set("mass", v)}
            />
          </>
        )}
        {tuning.kind === "bouncy" && (
          <>
            <Slider
              label="Duration (s)"
              value={tuning.visualDuration}
              min={0.1}
              max={1.5}
              step={0.05}
              onChange={(v) => set("visualDuration", v)}
            />
            <Slider
              label="Bounce"
              value={tuning.bounce}
              min={0}
              max={0.9}
              step={0.05}
              onChange={(v) => set("bounce", v)}
            />
          </>
        )}
        {tuning.kind === "tween" && (
          <>
            <Slider
              label="Duration (s)"
              value={tuning.duration}
              min={0.05}
              max={1.5}
              step={0.01}
              onChange={(v) => set("duration", v)}
            />
            {(["x1", "y1", "x2", "y2"] as const).map((name, i) => (
              <Slider
                key={name}
                label={`Curve ${name}`}
                value={tuning.ease[i]}
                min={i % 2 === 0 ? 0 : -1}
                max={i % 2 === 0 ? 1 : 2}
                step={0.01}
                onChange={(v) => {
                  const ease = [...tuning.ease] as Tuning["ease"];
                  ease[i] = v;
                  set("ease", ease);
                }}
              />
            ))}
          </>
        )}
        <Slider
          label="Delay (s)"
          value={tuning.delay}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) => set("delay", v)}
        />
        {subject === "list" && (
          <Slider
            label="Stagger (s)"
            value={tuning.stagger}
            min={0}
            max={0.3}
            step={0.01}
            onChange={(v) => set("stagger", v)}
          />
        )}

        <div className="rounded-xl bg-neutral-900 p-4 text-sm text-neutral-100">
          <code className="break-all">{code}</code>
          <button
            type="button"
            onClick={copy}
            className="mt-3 block rounded-full border border-neutral-500 px-3 py-1 text-xs"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </section>
    </main>
  );
}
