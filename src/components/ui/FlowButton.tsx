import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * A phone screen's main button, full width and tall enough for a thumb: the
 * way on (Find dato, Foreslå), or a plain one beside it (`quiet`).
 */
export default function FlowButton({
  onClick,
  disabled = false,
  quiet = false,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  /** The second choice: a plain button rather than the coloured one. */
  quiet?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "h-12 w-full rounded-xl text-[15px] font-bold transition disabled:opacity-50",
        quiet
          ? "border bg-card text-foreground hover:bg-secondary"
          : "bg-cta text-white hover:bg-cta-hover",
      )}
    >
      {children}
    </button>
  );
}
