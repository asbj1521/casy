import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";

import { cn } from "@/lib/utils";

/**
 * The shell a menu needs: a trigger button, a click-away backdrop (Esc works
 * too), and a panel that fades in. Written once so the event-settings dropdown
 * and the group switcher can't drift apart in behaviour or timing.
 */
export default function Popover({
  className,
  triggerClassName,
  panelClassName,
  trigger,
  children,
}: {
  className?: string;
  triggerClassName?: string;
  panelClassName?: string;
  /** Trigger contents; `open` drives the chevron rotation. */
  trigger: (open: boolean) => ReactNode;
  /** Panel contents; call `close` to dismiss the menu. */
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  // How far the panel is moved sideways to stay on screen. It opens from its
  // trigger's left edge, which near the right edge of a phone (a chip at the
  // end of the scheduling sentence) would put part of it off screen.
  const panelRef = useRef<HTMLDivElement>(null);
  const [shift, setShift] = useState(0);

  useLayoutEffect(() => {
    if (!open || !panelRef.current) return;
    const margin = 8;
    const rect = panelRef.current.getBoundingClientRect();
    // Measured with the shift already applied, so take it back out first.
    const left = rect.left - shift;
    const right = rect.right - shift;
    const overflow = right - (window.innerWidth - margin);
    setShift(overflow > 0 ? Math.max(-overflow, margin - left) : 0);
    // Measured once per opening; the panel doesn't change width while open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className={cn("relative", className)}>
      <button onClick={() => setOpen((o) => !o)} className={triggerClassName}>
        {trigger(open)}
      </button>
      <AnimatePresence>
        {open && (
          <>
            {/* Click-away backdrop */}
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <motion.div
              ref={panelRef}
              style={{ x: shift }}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className={cn(
                "absolute left-0 z-20 mt-2 overflow-hidden rounded-xl border bg-card p-1 shadow-lg",
                panelClassName,
              )}
            >
              {children(() => setOpen(false))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
