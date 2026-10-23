import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * A phone screen's main button, a full-width capsule tall enough for a
 * thumb: the way on (Find dato, Foreslå, Næste), or a glass one beside it
 * (`quiet`). One per sheet or screen (CLAUDE.md, Design language).
 */
export default function FlowButton({
  onClick,
  type = "button",
  disabled = false,
  busy = false,
  quiet = false,
  children,
}: {
  onClick?: () => void;
  /** "submit" for the button of a sheet that is a form. */
  type?: "button" | "submit";
  disabled?: boolean;
  /** A request is running: a spinner before the label, and no second press. */
  busy?: boolean;
  /** The second choice: a glass capsule with orange text rather than the orange one. */
  quiet?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || busy}
      className={cn(
        "inline-flex h-12 w-full items-center justify-center gap-2 rounded-full text-[15px] font-bold transition disabled:opacity-50",
        quiet ? "glass-pill text-primary" : "bg-cta text-white hover:bg-cta-hover",
      )}
    >
      {busy && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}
