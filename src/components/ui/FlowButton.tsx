import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * A phone screen's main button, a full-width glass capsule tall enough for a
 * thumb, in orange: the way on (Find dato, Foreslå, Næste). `quiet` is the
 * second choice beside it, the same glass in the text's own colour. One per
 * sheet or screen (CLAUDE.md, Design language).
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
  /** The second choice: the same glass capsule, its text not orange. */
  quiet?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || busy}
      className={cn(
        "glass-pill inline-flex h-12 w-full items-center justify-center gap-2 rounded-full text-[17px] transition active:scale-[0.98] disabled:opacity-50",
        quiet ? "font-semibold text-foreground" : "font-bold text-primary",
      )}
    >
      {busy && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}
