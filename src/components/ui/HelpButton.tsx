import { useState, type ReactNode } from "react";
import { CircleHelp } from "lucide-react";

import AnchoredPanel from "@/components/ui/AnchoredPanel";

/**
 * A small orange ? that keeps a promise or an explanation out of the way
 * (#224, #227). Its panel grows out of `anchorId`, an element around the
 * button as wide as the panel should be, since the ? itself is tiny.
 */
export default function HelpButton({
  label,
  anchorId,
  children,
}: {
  label: string;
  anchorId: string;
  /** What it holds; `close` for a button in it that opens something else. */
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <>
      <button
        type="button"
        aria-label={label}
        onClick={() => setOpen(true)}
        className="hit normal-case text-primary"
      >
        <CircleHelp aria-hidden className="h-5 w-5" />
      </button>
      <AnchoredPanel
        open={open}
        onClose={close}
        anchorId={anchorId}
        label={label}
        className="p-4 text-left text-[0.9375rem] font-normal normal-case tracking-normal text-foreground"
      >
        {children(close)}
      </AnchoredPanel>
    </>
  );
}
