import { Check, X } from "lucide-react";

import type { EventResponse } from "@/api/events";
import { useT } from "@/i18n/lang";
import { cn } from "@/lib/utils";

/**
 * Your answer to one date, as a tick and a cross: filled for the one you
 * gave. "Can, but rather not" from swiping shows as an amber tick: you can.
 * On an opened vote in My events, a phone's (VoteSummary) and a computer's
 * (VoteTallies) alike (#103).
 */
export default function YourAnswer({
  yours,
  label,
  disabled,
  onAnswer,
}: {
  yours: EventResponse | undefined;
  /** The date, for screen readers: "Jeg kan: fre. 16. okt. ..." */
  label: string;
  disabled: boolean;
  onAnswer: (response: EventResponse) => void;
}) {
  const t = useT();
  const base =
    "flex h-8 w-8 items-center justify-center rounded-full border transition disabled:opacity-60";
  return (
    <span className="flex shrink-0 gap-1.5">
      <button
        type="button"
        onClick={() => onAnswer("declined")}
        disabled={disabled}
        aria-pressed={yours === "declined"}
        aria-label={`${t.swipe.answerLong.declined}: ${label}`}
        className={cn(
          base,
          yours === "declined"
            ? "border-rose-600 bg-rose-600 text-white"
            : "bg-card text-muted-foreground",
        )}
      >
        <X className="h-4 w-4" strokeWidth={2.5} />
      </button>
      <button
        type="button"
        onClick={() => onAnswer("accepted")}
        disabled={disabled}
        aria-pressed={yours === "accepted" || yours === "maybe"}
        aria-label={`${t.swipe.answerLong.accepted}: ${label}`}
        className={cn(
          base,
          yours === "accepted"
            ? "border-emerald-600 bg-emerald-600 text-white"
            : yours === "maybe"
              ? "border-amber-400 bg-amber-100 text-amber-700"
              : "bg-card text-muted-foreground",
        )}
      >
        <Check className="h-4 w-4" strokeWidth={2.5} />
      </button>
    </span>
  );
}
