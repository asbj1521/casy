import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * A small native select as wide as the option chosen, not its longest one
 * (which is how wide a browser draws it): the chosen label, unseen, sets the
 * box, and the select is laid over it. My calendar's category and priority
 * then sit side by side in a narrow sidebar.
 *
 * `leading` is drawn inside the box before the text (an icon), with room
 * made for it.
 */
export default function FitSelect<T extends string>({
  value,
  options,
  onChange,
  leading,
  label,
  title,
  disabled,
}: {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  leading?: ReactNode;
  /** The accessible name. */
  label: string;
  title?: string;
  disabled?: boolean;
}) {
  // The unseen label reserves the browser's own arrow (pr-7); the select
  // itself keeps plain padding and draws its arrow in that room.
  const box = cn("border py-1 text-xs", leading ? "pl-6" : "pl-2");
  return (
    <span className="relative inline-grid">
      <span aria-hidden className={cn("invisible whitespace-nowrap pr-7", box)}>
        {options.find((o) => o.value === value)?.label ?? ""}
      </span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as T)}
        aria-label={label}
        title={title}
        className={cn(
          "absolute inset-0 w-full rounded-lg bg-background pr-2 text-foreground outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60",
          box,
        )}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {leading && (
        <span className="pointer-events-none absolute left-2 top-1/2 flex -translate-y-1/2">
          {leading}
        </span>
      )}
    </span>
  );
}
