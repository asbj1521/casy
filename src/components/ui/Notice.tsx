import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

const TONES = {
  error: { box: "border-red-200 bg-red-50 text-red-900", bare: "text-red-700", icon: XCircle },
  success: {
    box: "border-emerald-200 bg-emerald-50 text-emerald-900",
    bare: "text-emerald-800",
    icon: CheckCircle2,
  },
  warning: {
    box: "border-amber-200 bg-amber-50 text-amber-900",
    bare: "text-amber-800",
    icon: AlertTriangle,
  },
  info: { box: "bg-secondary/40 text-muted-foreground", bare: "text-muted-foreground", icon: Info },
} satisfies Record<string, { box: string; bare: string; icon: LucideIcon }>;

/**
 * A message after its icon: something failed, worked, needs care, or is
 * worth knowing. Boxed by default; `bare` is the same line without the box,
 * for a short result under the button that caused it. Errors are announced
 * to screen readers as they appear.
 */
export default function Notice({
  tone,
  icon: Icon = TONES[tone].icon,
  bare = false,
  id,
  className,
  children,
}: {
  tone: keyof typeof TONES;
  /** Replaces the tone's own icon. */
  icon?: LucideIcon;
  bare?: boolean;
  /** For a field to point at it (aria-describedby). */
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      id={id}
      role={tone === "error" ? "alert" : undefined}
      className={cn(
        "flex items-start gap-2 text-sm",
        bare ? TONES[tone].bare : cn("rounded-lg border p-3", TONES[tone].box),
        className,
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
