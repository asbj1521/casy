import { TriangleAlert } from "lucide-react";

import Collapse from "@/components/ui/Collapse";
import { useLang, useT } from "@/i18n/lang";
import { clashKey, clashSentence, type ImportantClash } from "@/lib/eventWarnings";
import { dayLabel, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Shown at most, the strongest first: a card has little room. */
const SHOWN = 2;

/**
 * What a date runs into among your important events (#114), said vaguely on
 * the card ("Det ligner, at du har en eksamen dagen efter: hold aftenen før
 * fri for sen aften og alkohol"), critical in red, the rest in amber. "Vis
 * mig" says which event, and when, and has your calendar under the card go
 * to it (`onShow`, the deck's to do). Your own event, read on this phone;
 * nothing anyone else sees.
 */
export default function ImportantClashes({
  clashes,
  shown,
  onShow,
  className,
}: {
  clashes: ImportantClash[];
  /** The warning shown (clashKey), or null. */
  shown?: string | null;
  /** Show this warning's event, or none (null). Without it, no "Vis mig". */
  onShow?: (clash: ImportantClash | null) => void;
  className?: string;
}) {
  const t = useT();
  const { lang } = useLang();
  const words = t.importantClash;
  if (clashes.length === 0) return null;

  return (
    <ul className={cn("space-y-1.5", className)}>
      {clashes.slice(0, SHOWN).map((c) => {
        const key = clashKey(c);
        const open = shown === key;
        const text = clashSentence(c, words);
        const iso = new Date(c.event.start).toISOString();
        const day = dayLabel(c.event.start, lang);
        return (
          <li
            key={key}
            className={cn(
              "text-sm font-medium",
              c.severity === "critical" ? "text-red-700" : "text-amber-800",
            )}
          >
            <p className="flex items-start gap-1.5">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>
                {text}
                {onShow && (
                  <>
                    {" "}
                    <button
                      type="button"
                      // The card is dragged by its whole face: a tap here
                      // mustn't start a swipe.
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => onShow(open ? null : c)}
                      aria-expanded={open}
                      className="whitespace-nowrap font-semibold underline underline-offset-2"
                    >
                      {open ? words.hide : words.show}
                    </button>
                  </>
                )}
              </span>
            </p>
            <Collapse open={open}>
              <p className="pl-[22px] pt-0.5 font-normal text-foreground">
                {words.detail(c.event.title, day, c.event.allDay ? "" : formatTime(iso))}
              </p>
            </Collapse>
          </li>
        );
      })}
    </ul>
  );
}
