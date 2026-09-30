import { Hourglass, Moon } from "lucide-react";

import type { EdgeWarning } from "@/lib/earlyMorning";
import { cn } from "@/lib/utils";

const ICONS = { backToBack: Hourglass, earlyMorning: Moon };

/**
 * A meeting's edge warnings (lib/earlyMorning.ts), each after its icon: an
 * hourglass for coming straight from something, a moon for an early start
 * after a late night. Said, never blocking: the date still stands.
 */
export default function EdgeWarningList({
  warnings,
  className,
}: {
  warnings: EdgeWarning[];
  /** Added to each warning, e.g. its spacing. */
  className?: string;
}) {
  return warnings.map(({ kind, text }) => {
    const Icon = ICONS[kind];
    return (
      <p key={kind} className={cn("flex items-start gap-2 text-sm text-amber-900", className)}>
        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
        {text}
      </p>
    );
  });
}
