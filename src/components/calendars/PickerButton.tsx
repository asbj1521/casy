import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/** A calendar's small choice on a phone (category, priority), opening its list rows. */
export default function PickerButton({
  label,
  disabled,
  onClick,
  children,
}: {
  /** For screen readers: what it chooses, and for which calendar. */
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="hit flex h-7 min-w-0 max-w-full items-center gap-1 rounded-full bg-secondary px-2.5 text-xs font-medium text-foreground disabled:opacity-50"
    >
      {children}
      <ChevronDown aria-hidden className="h-3 w-3 shrink-0 text-muted-foreground" />
    </button>
  );
}
