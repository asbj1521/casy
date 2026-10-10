import { TriangleAlert } from "lucide-react";

import { useT } from "@/i18n/lang";
import type { ImportantClash } from "@/lib/eventWarnings";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Shown at most, the strongest first: a card has little room. */
const SHOWN = 2;

/**
 * What a date runs into among your important events (#114), said in plain
 * words on the card: "Eksamen dagen efter kl. 12:00: hold aftenen før fri
 * for sen aften og alkohol". Critical in red, the rest in amber. Your own
 * event's title, read on this phone; nothing for anyone else to see.
 */
export default function ImportantClashes({
  clashes,
  className,
}: {
  clashes: ImportantClash[];
  className?: string;
}) {
  const t = useT();
  const words = t.importantClash;
  if (clashes.length === 0) return null;

  const list = (items: string[]) =>
    items.length <= 1
      ? (items[0] ?? "")
      : `${items.slice(0, -1).join(", ")} ${words.and} ${items[items.length - 1]}`;

  return (
    <ul className={cn("space-y-1", className)}>
      {clashes.slice(0, SHOWN).map((c) => {
        const time = c.event.allDay ? "" : formatTime(new Date(c.event.start).toISOString());
        const when = words.when(c.daysAfter, time);
        const text =
          c.kind === "nightBefore"
            ? words.nightBefore(c.event.title, when, list(c.avoid.map((a) => words.avoid[a])))
            : c.kind === "prepDayBefore"
              ? words.prepDayBefore(c.event.title, when)
              : c.kind === "prep"
                ? words.prep(c.event.title, when)
                : words.recovery(c.event.title, when);
        return (
          <li
            key={`${c.event.title}-${c.event.start}`}
            className={cn(
              "flex items-start gap-1.5 text-sm font-medium",
              c.severity === "critical" ? "text-red-700" : "text-amber-800",
            )}
          >
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>{text}</span>
          </li>
        );
      })}
    </ul>
  );
}
