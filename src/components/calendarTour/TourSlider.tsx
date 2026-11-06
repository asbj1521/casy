import { useId } from "react";

import HelpButton from "@/components/ui/HelpButton";
import { TOUR_STOPS, type TourStop } from "@/lib/calendarTour";
import { haptic } from "@/lib/haptics";
import { useT } from "@/i18n/lang";

/** The thumb's width: a stop's place on the track leaves room for it at both ends. */
const THUMB_PX = 28;
const place = (share: number) => `calc(${THUMB_PX / 2}px + ${share} * (100% - ${THUMB_PX}px))`;

/**
 * A calendar's priority (#221): a real range input, so it is dragged and read out
 * as one, that snaps to the four stops with a small tick on each. Under it only
 * the stop's name; what each does in practice is behind the ?.
 */
export default function TourSlider({
  stop,
  onChange,
}: {
  stop: TourStop;
  onChange: (stop: TourStop) => void;
}) {
  const t = useT();
  const words = t.calendarTour;
  const names: Record<TourStop, string> = { off: words.off, ...words.levels };
  const helpId = useId();
  const at = TOUR_STOPS.indexOf(stop);
  const filled = place(at / (TOUR_STOPS.length - 1));
  return (
    <div id={helpId}>
      <div className="flex items-center gap-1.5 px-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {words.importance}
        </p>
        <HelpButton label={words.importanceHelp} anchorId={helpId}>
          {() => (
            <div className="space-y-2">
              <p>{words.levelsHelp}</p>
              <p>
                {words.off}: {words.effects.off}
              </p>
            </div>
          )}
        </HelpButton>
      </div>
      <div className="relative h-11">
        {/* The stops, on the track and under the thumb. */}
        {TOUR_STOPS.map((s, i) => (
          <span
            key={s}
            aria-hidden
            className={`absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ${
              i <= at ? "bg-primary" : "bg-muted-foreground/30"
            }`}
            style={{ left: place(i / (TOUR_STOPS.length - 1)) }}
          />
        ))}
        <input
          type="range"
          min={0}
          max={TOUR_STOPS.length - 1}
          step={1}
          value={at}
          aria-label={words.importance}
          aria-valuetext={names[stop]}
          onChange={(e) => {
            haptic("select");
            onChange(TOUR_STOPS[Number(e.target.value)]);
          }}
          className="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent outline-none [&::-moz-range-thumb]:h-7 [&::-moz-range-thumb]:w-7 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white [&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:[background:var(--track)] [&::-webkit-slider-thumb]:-mt-[11px] [&::-webkit-slider-thumb]:h-7 [&::-webkit-slider-thumb]:w-7 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-black/5 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_2px_8px_rgb(0_0_0/0.3)] focus-visible:[&::-webkit-slider-thumb]:ring-2 focus-visible:[&::-webkit-slider-thumb]:ring-primary"
          style={
            {
              "--track": `linear-gradient(to right, hsl(var(--primary)) ${filled}, hsl(var(--muted-foreground) / 0.2) ${filled})`,
            } as React.CSSProperties
          }
        />
      </div>
      <p className="px-1 text-center text-[0.9375rem] font-semibold text-foreground">
        {names[stop]}
      </p>
    </div>
  );
}
