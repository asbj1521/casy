import { type ReactNode } from "react";

import Popover from "@/components/Popover";
import WheelPicker from "@/components/WheelPicker";
import { cn } from "@/lib/utils";

/**
 * A small labelled dropdown that opens a looping wheel (type / duration /
 * start). No chevron: three of these share one line in a narrow panel, and
 * the icon already says what each one is. If the line is still too narrow
 * (the smallest phones), the label shortens with an ellipsis rather than
 * wrapping onto a second line.
 */
export default function Dropdown({
  icon,
  value,
  options,
  onChange,
  menuWidth = "w-32",
  className,
}: {
  icon: ReactNode;
  value: number;
  options: { label: string; value: number }[];
  onChange: (value: number) => void;
  /** Tailwind width class for the wheel popup (wider for long labels). */
  menuWidth?: string;
  /** Classes for the outer box, e.g. whether it may shrink in its row. */
  className?: string;
}) {
  const current = options.find((o) => o.value === value);

  return (
    <Popover
      className={cn("inline-block min-w-0", className)}
      triggerClassName="inline-flex max-w-full items-center gap-1 rounded-lg border bg-card px-2 py-1.5 text-sm font-medium text-foreground transition hover:bg-secondary"
      panelClassName={menuWidth}
      trigger={() => (
        <>
          {icon}
          <span className="truncate">{current?.label}</span>
        </>
      )}
    >
      {(close) => (
        <WheelPicker options={options} value={value} onChange={onChange} onPick={close} />
      )}
    </Popover>
  );
}
