import { type ReactNode } from "react";

import Popover from "@/components/Popover";
import WheelPicker from "@/components/WheelPicker";

/**
 * A button showing the chosen option that opens a looping wheel to pick
 * another: the scheduling settings' start time, length, days and start day.
 * The label shortens with an ellipsis rather than wrap when its row is too
 * narrow (the smallest phones).
 */
export default function Dropdown({
  value,
  options,
  onChange,
  menuWidth = "w-32",
  className = "inline-block min-w-0",
  triggerClassName,
  suffix,
}: {
  /** The wrapper's layout: inline by default, `block` to fill a cell. */
  className?: string;
  value: number;
  options: { label: string; value: number }[];
  onChange: (value: number) => void;
  /** Tailwind width class for the wheel popup (wider for long labels). */
  menuWidth?: string;
  /** The button's look: a field in the settings bar, a chip in the sentence. */
  triggerClassName: string;
  /** Shown after the label, e.g. a chevron. */
  suffix?: ReactNode;
}) {
  const current = options.find((o) => o.value === value);

  return (
    <Popover
      className={className}
      triggerClassName={triggerClassName}
      panelClassName={menuWidth}
      trigger={() => (
        <>
          <span className="truncate">{current?.label}</span>
          {suffix}
        </>
      )}
    >
      {(close) => (
        <WheelPicker options={options} value={value} onChange={onChange} onPick={close} />
      )}
    </Popover>
  );
}
