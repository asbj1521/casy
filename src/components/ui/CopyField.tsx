import { Check, Copy } from "lucide-react";

import { useCopy } from "@/hooks/useCopy";
import { useT } from "@/i18n/lang";
import { cn } from "@/lib/utils";

/** A link to pass on: read-only, all selected on focus, with a Copy button beside it. */
export default function CopyField({
  value,
  label,
  className,
}: {
  value: string;
  /** What the field holds, for screen readers. */
  label: string;
  className?: string;
}) {
  const t = useT();
  const [copied, copy] = useCopy();
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <input
        readOnly
        value={value}
        aria-label={label}
        onFocus={(e) => e.currentTarget.select()}
        className="min-w-0 flex-1 rounded-lg border bg-background px-3 py-2 font-mono text-xs text-foreground outline-none"
      />
      <button
        type="button"
        onClick={() => copy(value)}
        className={cn(
          "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition",
          copied
            ? "bg-primary/10 text-primary"
            : "bg-primary text-primary-foreground hover:opacity-90",
        )}
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {copied ? t.common.copied : t.common.copy}
      </button>
    </div>
  );
}
