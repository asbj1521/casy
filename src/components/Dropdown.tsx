import { useState, type ReactNode } from "react";

import Popover from "@/components/Popover";
import BottomSheet from "@/components/ui/BottomSheet";
import WheelPicker from "@/components/WheelPicker";

/**
 * A button showing the chosen option that opens a looping wheel to pick
 * another: the scheduling settings' start time, length, days and start day.
 * The label shortens with an ellipsis rather than wrap when its row is too
 * narrow (the smallest phones). With `sheet`, the wheel opens in a sheet
 * from the bottom of the screen instead of under the button (the phone's
 * scheduling flow, #101).
 */
export default function Dropdown({
  value,
  options,
  onChange,
  menuWidth = "w-32",
  className = "inline-block min-w-0",
  triggerClassName,
  suffix,
  sheet,
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
  /** Open in a bottom sheet with this title and Done label, rather than a menu. */
  sheet?: { title: string; doneLabel: string };
}) {
  const current = options.find((o) => o.value === value);
  const [open, setOpen] = useState(false);
  const label = (
    <>
      <span className="truncate">{current?.label}</span>
      {suffix}
    </>
  );

  if (sheet) {
    return (
      <div className={className}>
        <button type="button" onClick={() => setOpen(true)} className={triggerClassName}>
          {label}
        </button>
        <BottomSheet
          open={open}
          onClose={() => setOpen(false)}
          title={sheet.title}
          doneLabel={sheet.doneLabel}
        >
          <WheelPicker
            options={options}
            value={value}
            onChange={onChange}
            onPick={() => setOpen(false)}
          />
        </BottomSheet>
      </div>
    );
  }

  return (
    <Popover
      className={className}
      triggerClassName={triggerClassName}
      panelClassName={menuWidth}
      trigger={() => label}
    >
      {(close) => (
        <WheelPicker options={options} value={value} onChange={onChange} onPick={close} />
      )}
    </Popover>
  );
}
