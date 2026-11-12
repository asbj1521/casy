import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

import { useLang, useT } from "@/i18n/lang";
import { capitalize, monthName } from "@/lib/format";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { daysSooner, type CountOption } from "@/lib/widen";
import { APP_TIME_ZONE } from "@/lib/zone";

/** Over this many steps, only the two ends are numbered under the track. */
const MAX_LABELS = 9;

/**
 * "Hvor mange skal kunne" as a slider (#259): a step per count, the lowest
 * (lowestCount, #263) on the left and everyone on the right. The knob
 * follows the finger, a tick is felt at each step it crosses, and let go it springs onto the nearest (a
 * slight overshoot, so it feels pulled in). Over it rides what the step
 * buys (#255): everyone's month, and below everyone how much sooner, never
 * the date itself, which the pile reveals. So what one fewer buys
 * is felt while sliding. The count is picked as the finger lifts, not while
 * it moves, so the plan behind searches again once. Arrow keys step it.
 */
export default function HowManySlider({
  options,
  loading = false,
  count,
  onPick,
}: {
  /** Every count, as firstDateByCount gives them: everyone first. */
  options: CountOption[];
  /** The group's calendars still on their way: the steps, without dates yet. */
  loading?: boolean;
  count: number;
  onPick: (count: number) => void;
}) {
  const t = useT();
  const { lang } = useLang();
  const words = t.planFromCalendar.howMany;
  const steps = [...options].reverse();
  const last = steps.length - 1;
  const picked = Math.max(
    0,
    steps.findIndex((o) => o.count === count),
  );
  // Where the knob is, in steps; a fraction while it is dragged.
  const [drag, setDrag] = useState<number | null>(null);
  const track = useRef<HTMLDivElement>(null);
  const pos = drag ?? picked;
  const step = Math.round(pos);
  const shown = steps[step];
  const everyone = steps[last];

  function at(e: PointerEvent): number {
    const r = track.current!.getBoundingClientRect();
    const x = Math.min(Math.max(e.clientX - r.left, 0), r.width);
    return (x / r.width) * last;
  }
  function move(next: number) {
    if (Math.round(next) !== step) haptic("select");
    setDrag(next);
  }
  function release() {
    if (drag === null) return;
    const to = Math.round(drag);
    setDrag(null);
    if (steps[to].count !== count) onPick(steps[to].count);
  }
  function key(e: KeyboardEvent) {
    const to =
      e.key === "ArrowLeft" || e.key === "ArrowDown"
        ? picked - 1
        : e.key === "ArrowRight" || e.key === "ArrowUp"
          ? picked + 1
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? last
              : null;
    if (to === null) return;
    e.preventDefault();
    const clamped = Math.min(Math.max(to, 0), last);
    if (clamped !== picked) {
      haptic("select");
      onPick(steps[clamped].count);
    }
  }

  if (!shown || last < 1) return null;
  const pct = (pos / last) * 100;
  // Never the date itself, which the pile reveals: everyone's month, and
  // below everyone how much sooner; a step gaining nothing (or with nothing
  // to compare to) says its month too.
  const sooner =
    shown.first && everyone.first && shown !== everyone
      ? daysSooner(shown.first.slot.start, everyone.first.slot.start, APP_TIME_ZONE)
      : 0;
  const date = loading
    ? "…"
    : !shown.first
      ? words.none
      : sooner > 0
        ? words.sooner(sooner)
        : capitalize(monthName(Date.parse(shown.first.slot.start), lang));
  const countText =
    shown.count === shown.of ? words.all(shown.of) : words.some(shown.count, shown.of);

  return (
    <div className="px-4 pb-2 pt-1">
      {/* What the step buys rides over the knob, kept inside the card at the ends. */}
      <div className="relative h-[3.25rem]">
        <div
          aria-live="polite"
          className={cn(
            "absolute bottom-2 w-max min-w-[7.5rem] -translate-x-1/2 rounded-2xl border bg-background px-3 py-1.5 text-center shadow-sm",
            drag === null && "transition-[left] duration-300 ease-[cubic-bezier(.34,1.56,.64,1)]",
          )}
          style={{ left: `clamp(3.75rem, ${pct}%, calc(100% - 3.75rem))` }}
        >
          <span
            key={date}
            className={cn(
              "animate-date-pop block text-[0.9375rem] font-bold",
              sooner > 0 ? "text-primary" : "text-foreground",
            )}
          >
            {date}
          </span>
        </div>
      </div>

      <div
        ref={track}
        className="relative h-11 touch-none select-none"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          move(at(e));
        }}
        onPointerMove={(e) => drag !== null && move(at(e))}
        onPointerUp={release}
        onPointerCancel={release}
      >
        {/* The track, orange up to the knob. */}
        <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-secondary" />
        <div
          className={cn(
            "absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-cta",
            drag === null && "transition-[width] duration-300 ease-[cubic-bezier(.34,1.56,.64,1)]",
          )}
          style={{ width: `${pct}%` }}
        />
        {/* A dot per step, lit once the knob is past it. */}
        {steps.map((o, i) => (
          <span
            key={o.count}
            aria-hidden
            className={cn(
              "absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full",
              i <= pos ? "bg-cta" : "bg-muted-foreground/30",
            )}
            style={{ left: `${(i / last) * 100}%` }}
          />
        ))}
        <span
          role="slider"
          tabIndex={0}
          aria-label={words.label}
          aria-valuemin={steps[0].count}
          aria-valuemax={everyone.count}
          aria-valuenow={shown.count}
          aria-valuetext={`${countText}, ${date}`}
          onKeyDown={key}
          className={cn(
            "absolute top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border border-black/5 bg-white shadow-md outline-none focus-visible:ring-2 focus-visible:ring-primary",
            drag !== null
              ? "scale-110"
              : "transition-[left,transform] duration-300 ease-[cubic-bezier(.34,1.56,.64,1)]",
          )}
          style={{ left: `${pct}%` }}
        />
      </div>

      {/* The counts under their steps; with many, only the ends. */}
      <div aria-hidden className="relative h-5 text-[0.75rem] font-medium text-muted-foreground">
        {steps.map((o, i) =>
          steps.length <= MAX_LABELS || i === 0 || i === last ? (
            <span
              key={o.count}
              className={cn(
                "absolute -translate-x-1/2 whitespace-nowrap",
                i === 0 && "translate-x-0",
                i === last && "-translate-x-full",
                i === step && "font-bold text-foreground",
              )}
              style={{ left: `${(i / last) * 100}%` }}
            >
              {i === last ? words.all(o.of) : o.count}
            </span>
          ) : null,
        )}
      </div>
    </div>
  );
}
