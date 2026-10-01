import { cn } from "@/lib/utils";

const SIZES = {
  md: { track: "h-5 w-9 p-0.5", knob: "h-4 w-4" },
  lg: { track: "h-[30px] w-[52px] p-[3px]", knob: "h-6 w-6" },
};

/** An on/off switch; `label` names it for screen readers. */
export default function Switch({
  checked,
  onChange,
  label,
  disabled = false,
  size = "md",
  className,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  size?: keyof typeof SIZES;
  /** Placement, e.g. a margin to line up with a label. */
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "flex shrink-0 items-center rounded-full transition-colors disabled:opacity-50",
        SIZES[size].track,
        checked ? "justify-end bg-primary" : "justify-start bg-zinc-300",
        className,
      )}
    >
      <span className={cn("rounded-full bg-white shadow", SIZES[size].knob)} />
    </button>
  );
}
