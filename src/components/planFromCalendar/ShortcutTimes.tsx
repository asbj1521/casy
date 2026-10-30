import { Plus, X } from "lucide-react";

import { useT } from "@/i18n/lang";
import { MAX_TIMES, timeLabel, type ShortcutTime } from "@/lib/shortcuts";
import { cn } from "@/lib/utils";

/**
 * A genvej's times (#175), in its editor where the group would be: "Tid 1"
 * alone at first with a plus beside it, then halves, then thirds once there
 * are three and no plus. The one picked is the one the rows under it
 * (Tidspunkt, Fleksibel) show and change; the second and third can be taken
 * away again with the cross on the one picked.
 */
export default function ShortcutTimes({
  times,
  durationMinutes,
  current,
  onPick,
  onAdd,
  onRemove,
}: {
  times: ShortcutTime[];
  /** The genvej's length, the same for every time. */
  durationMinutes: number;
  current: number;
  onPick: (index: number) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}) {
  const t = useT();
  const words = t.shortcuts;
  return (
    <div className="flex gap-2">
      {times.map((time, i) => {
        const on = i === current;
        return (
          <div key={i} className="relative min-w-0 flex-1">
            <button
              type="button"
              aria-pressed={on}
              onClick={() => onPick(i)}
              className={cn(
                "flex h-14 w-full flex-col items-center justify-center rounded-2xl border bg-card transition-colors",
                on ? "border-primary text-primary" : "text-muted-foreground active:bg-secondary",
              )}
            >
              <span className="text-[13px] font-medium">{words.time(i + 1)}</span>
              <span
                className={cn("text-[15px] font-semibold", on ? "text-primary" : "text-foreground")}
              >
                {timeLabel(time, durationMinutes, words.anyTime)}
              </span>
            </button>
            {on && i > 0 && (
              <button
                type="button"
                aria-label={words.removeTime(i + 1)}
                onClick={() => onRemove(i)}
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        );
      })}
      {times.length < MAX_TIMES && (
        <button
          type="button"
          aria-label={words.addTime}
          onClick={onAdd}
          className="flex h-14 w-12 shrink-0 items-center justify-center rounded-2xl border bg-card text-primary transition-colors active:bg-secondary"
        >
          <Plus className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
