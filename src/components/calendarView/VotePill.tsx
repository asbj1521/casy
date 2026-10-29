import { ChevronRight, Vote } from "lucide-react";

import { useT } from "@/i18n/lang";
import { cn } from "@/lib/utils";

/**
 * Votes waiting for your answer, on the home page (#172): a glass capsule
 * just above the bottom buttons that starts answering over the month. One
 * vote is named; several say how many, and it opens the soonest.
 */
export default function VotePill({
  title,
  count,
  hidden,
  onOpen,
}: {
  /** The soonest waiting vote's title. */
  title: string;
  count: number;
  hidden: boolean;
  onOpen: () => void;
}) {
  const t = useT();
  return (
    <div
      aria-hidden={hidden}
      inert={hidden}
      className={cn(
        "fixed inset-x-0 z-20 flex justify-center px-4 transition-opacity duration-200",
        // Over the bottom buttons (HomeBar), which are 3rem tall.
        "bottom-[calc(max(env(safe-area-inset-bottom),0.75rem)+3.75rem)]",
        hidden && "pointer-events-none opacity-0",
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        className="glass-pill flex h-11 min-w-0 max-w-full items-center gap-2 rounded-full pl-4 pr-3 text-[15px] font-semibold text-primary"
      >
        <Vote className="h-5 w-5 shrink-0" />
        <span className="truncate">
          {count > 1 ? t.homeVote.waiting(count) : t.homeVote.answer(title)}
        </span>
        <ChevronRight className="h-4 w-4 shrink-0" />
      </button>
    </div>
  );
}
