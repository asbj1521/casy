import { CalendarOff, ChevronRight, Loader2 } from "lucide-react";

import { useLang, useT } from "@/i18n/lang";
import type { EventSettings } from "@/lib/eventSearch";
import { formatHeadline } from "@/lib/format";
import type { AnswerReview } from "@/lib/scheduler";
import { cn } from "@/lib/utils";
import type { TimeSlot } from "@/types";

/**
 * The answer in one line, above the flow's button while the event is set up
 * (#101): the first date the settings on screen give, as they change, so a
 * setting nobody can make is plain at once rather than at the end. A tap
 * jumps to the dates.
 */
export default function LiveAnswer({
  waiting,
  review,
  search,
  slot,
  onOpen,
}: {
  waiting: { text: string; loading: boolean } | null;
  review: AnswerReview;
  search: EventSettings;
  slot: TimeSlot | null;
  onOpen: () => void;
}) {
  const t = useT();
  const { lang } = useLang();

  if (waiting) {
    return (
      <p className="flex min-h-11 items-center gap-2 text-sm text-muted-foreground">
        {waiting.loading ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
        ) : (
          <CalendarOff className="h-4 w-4 shrink-0" />
        )}
        <span className="min-w-0">{waiting.text}</span>
      </p>
    );
  }
  if (!slot) {
    return (
      <p role="status" className="flex min-h-11 items-center text-sm font-medium text-rose-800">
        {t.schedulerFlow.noDate}
      </p>
    );
  }

  const { lines, time } = formatHeadline(search, slot, lang, t);
  const { tone } = review;
  return (
    <button
      type="button"
      onClick={onOpen}
      title={t.schedulerFlow.seeAnswer}
      className="flex min-h-11 w-full items-center gap-3 text-left"
    >
      {/* No live region in here: it would take over the button's name. */}
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block truncate text-xs font-bold uppercase tracking-wider",
            tone === "clean" && "text-orange-700",
            (tone === "approve" || tone === "skip") && "text-amber-800",
            tone === "review" && "text-sky-800",
          )}
        >
          {tone === "approve"
            ? t.scheduler.needsApproval
            : tone === "review"
              ? t.scheduler.underReview
              : tone === "skip"
                ? t.scheduler.worksIfSkipping
                : t.schedulerFlow.firstDate}
        </span>
        {/* A trip's two dates may take a second line, never a third. */}
        <span className="line-clamp-2 text-[15px] font-bold leading-snug text-foreground">
          {lines.join(" ")} · {time}
        </span>
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
    </button>
  );
}
