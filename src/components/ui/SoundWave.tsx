import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";

/**
 * The waveform people know from voice assistants (#106): the speak button's
 * face. At rest its bars rise and fall slowly with a soft ring spreading
 * behind them, which says "talk to me" before anything is pressed; while
 * listening the bars move faster and taller. Plain CSS animation on
 * `transform` and `opacity` (index.css), so it runs off the main thread, and
 * with reduced motion it stands still as a drawn waveform.
 */

/** How tall each bar is at rest, as a share of the icon's height: a wave that peaks in the middle. */
const REST = [0.4, 0.7, 1, 0.65, 0.35];

export default function SoundWave({
  listening = false,
  className,
}: {
  listening?: boolean;
  className?: string;
}) {
  return (
    <span aria-hidden className={cn("flex h-6 items-center justify-center gap-[3px]", className)}>
      {REST.map((rest, i) => (
        <span
          key={i}
          className="sound-wave-bar block h-full w-[3px] rounded-full bg-current"
          style={
            {
              "--wave-rest": rest,
              // Resting: a gentle breath around its height. Listening: from nearly flat to full.
              "--wave-low": listening ? 0.2 : rest * 0.55,
              "--wave-high": listening ? Math.min(1, rest + 0.3) : rest,
              "--wave-speed": listening ? "0.7s" : "1.8s",
              "--wave-delay": `${i * (listening ? -0.15 : -0.35)}s`,
            } as CSSProperties
          }
        />
      ))}
    </span>
  );
}
