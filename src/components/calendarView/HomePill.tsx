import type { ReactNode, Ref } from "react";
import { ChevronRight, type LucideIcon } from "lucide-react";

import { ZOOM } from "@/components/swipe/morph";
import { cn } from "@/lib/utils";

/**
 * The glass capsule just above the home page's bottom buttons: what is
 * waiting for you (VotePill) or the next step (HomeNextStep). Never both.
 * `raised`: a second, for the one case with two next steps (someone with no
 * group may make one or have an invitation, #237), standing over the first.
 */
export default function HomePill({
  icon: Icon,
  hidden,
  zoomingOut = false,
  raised = false,
  onClick,
  buttonRef,
  children,
}: {
  icon: LucideIcon;
  hidden: boolean;
  /** A day is zooming back into the month: the fade-in takes as long as the zoom. */
  zoomingOut?: boolean;
  raised?: boolean;
  onClick: () => void;
  buttonRef?: Ref<HTMLButtonElement>;
  children: ReactNode;
}) {
  return (
    <div
      aria-hidden={hidden}
      inert={hidden}
      className={cn(
        "fixed inset-x-0 z-20 flex justify-center px-4 transition-opacity duration-200",
        // Over the bottom buttons (HomeBar), which are 3rem tall.
        raised
          ? "bottom-[calc(max(env(safe-area-inset-bottom),0.75rem)+7rem)]"
          : "bottom-[calc(max(env(safe-area-inset-bottom),0.75rem)+3.75rem)]",
        hidden && "pointer-events-none opacity-0",
      )}
      style={zoomingOut ? { transitionDuration: `${ZOOM.outMs}ms` } : undefined}
    >
      <button
        ref={buttonRef}
        type="button"
        onClick={onClick}
        className="glass-pill flex h-11 min-w-0 max-w-full items-center gap-2 rounded-full pl-4 pr-3 text-[0.9375rem] font-semibold text-primary"
      >
        <Icon className="h-5 w-5 shrink-0" />
        <span className="truncate">{children}</span>
        <ChevronRight className="h-4 w-4 shrink-0" />
      </button>
    </div>
  );
}
