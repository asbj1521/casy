import { useState, type ReactNode } from "react";
import { ChevronDown, Sparkles } from "lucide-react";

import Collapse from "@/components/ui/Collapse";
import { cn } from "@/lib/utils";

/**
 * What Casy's AI made of something, folded away behind one small line with
 * its sparkle, so it is there for whoever looks and out of the way for
 * everyone else: a headline, a few short facts, the AI's own line on why,
 * and room underneath for what can be done about it. Shared by the labels on
 * your own events (#112) and the profile of a planned event (#113), so the
 * two read alike and improve together.
 */
export default function AiReadout({
  toggle,
  dot,
  headline,
  facts,
  reason,
  footer,
  beside,
  className,
}: {
  /** The folded line's words. */
  toggle: string;
  /** A Tailwind background for the dot beside it, or none. */
  dot?: string;
  headline: string;
  facts: string[];
  reason: string;
  footer?: ReactNode;
  /** Something at the start of the folded line, the line then right-aligned (a vote's countdown). */
  beside?: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={className}>
      <div className={cn(beside && "flex items-center justify-between gap-3")}>
        {beside}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex items-center gap-1 text-xs font-medium text-muted-foreground"
        >
          <Sparkles className="h-3 w-3 text-amber-500" aria-hidden />
          {toggle}
          {dot && <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />}
          <ChevronDown
            className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")}
            aria-hidden
          />
        </button>
      </div>
      <Collapse open={open}>
        <div className="mt-1.5 space-y-1.5 rounded-lg bg-muted/60 p-2.5 text-xs">
          <p className="font-medium text-foreground">{headline}</p>
          {facts.length > 0 && (
            <ul className="flex flex-wrap gap-1">
              {facts.map((fact) => (
                <li key={fact} className="rounded-full bg-background px-2 py-0.5 text-foreground">
                  {fact}
                </li>
              ))}
            </ul>
          )}
          {reason && <p className="italic text-muted-foreground">{reason}</p>}
          {footer}
        </div>
      </Collapse>
    </div>
  );
}
