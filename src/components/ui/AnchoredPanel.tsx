import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";

/** Room kept between the panel and the button, and from the screen's edges. */
const GAP = 6;
const EDGE = 12;
/** The least height worth opening into: less room than this below, and it opens upward. */
const MIN_HEIGHT = 160;

interface Place {
  left: number;
  width: number;
  /** Measured from the top of the screen when it opens downward, else from the bottom. */
  down: boolean;
  offset: number;
  maxHeight: number;
}

/** Where the panel goes for the button `anchorId` names, or null while it isn't on screen. */
function placeFor(anchorId: string, natural: number): Place | null {
  const anchor = document.getElementById(anchorId);
  if (!anchor) return null;
  const r = anchor.getBoundingClientRect();
  const viewport = window.visualViewport?.height ?? window.innerHeight;
  const below = viewport - r.bottom - GAP - EDGE;
  const above = r.top - GAP - EDGE;
  // Downward when what it holds fits below, or below is the roomier side.
  const down = below >= Math.min(natural, MIN_HEIGHT) && (below >= natural || below >= above);
  const width = Math.min(r.width, window.innerWidth - 2 * EDGE);
  return {
    left: Math.max(EDGE, Math.min(r.left, window.innerWidth - EDGE - width)),
    width,
    down,
    offset: down ? r.bottom + GAP : viewport - r.top + GAP,
    maxHeight: Math.max(MIN_HEIGHT, down ? below : above),
  };
}

/**
 * A picker that grows out of the button it belongs to (#175), as an
 * extension of it rather than a sheet from the bottom of the screen: just
 * under the button when there is room below it, just over it when there
 * isn't (where it stands after scrolling), as wide as the button, glass like
 * the sheet it opens over. A tap outside or Esc closes it, and only it, not
 * the sheet under it; what it holds scrolls when it is taller than the room.
 * The button is named by its element id (`anchorId`; a ListRow's `id`).
 */
export default function AnchoredPanel({
  open,
  onClose,
  anchorId,
  label,
  className,
  children,
}: {
  open: boolean;
  onClose: () => void;
  anchorId: string;
  /** Its name for screen readers, the button's label. */
  label: string;
  className?: string;
  children: ReactNode;
}) {
  const reduce = useReducedMotion();
  const box = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<Place | null>(null);

  // Measured as it opens, from what it holds, and again when the screen
  // changes under it (a keyboard, a turn, the sheet scrolling).
  useLayoutEffect(() => {
    if (!open) return;
    const measure = () => setPlace(placeFor(anchorId, box.current?.scrollHeight ?? MIN_HEIGHT));
    measure();
    window.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("resize", measure);
    document.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("resize", measure);
      document.removeEventListener("scroll", measure, true);
    };
  }, [open, anchorId]);

  // Esc closes the panel alone: caught before the sheet's own listener hears it.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70]">
          {/* A tap anywhere else closes it, and goes no further. */}
          <div aria-hidden className="absolute inset-0" onPointerDown={onClose} />
          <motion.div
            ref={box}
            role="dialog"
            aria-label={label}
            initial={
              reduce
                ? { opacity: 0 }
                : { opacity: 0, scaleY: 0.7, y: place?.down === false ? 8 : -8 }
            }
            animate={{ opacity: 1, scaleY: 1, y: 0 }}
            exit={
              reduce
                ? { opacity: 0 }
                : { opacity: 0, scaleY: 0.7, y: place?.down === false ? 8 : -8 }
            }
            transition={{ duration: reduce ? 0.12 : 0.24, ease: [0.32, 0.72, 0, 1] }}
            style={{
              left: place?.left ?? EDGE,
              width: place?.width,
              maxHeight: place?.maxHeight,
              ...(place?.down === false ? { bottom: place.offset } : { top: place?.offset ?? 0 }),
              transformOrigin: place?.down === false ? "bottom" : "top",
              // Hidden for the one frame before it knows where it goes.
              visibility: place ? "visible" : "hidden",
            }}
            className={cn(
              "glass absolute overflow-y-auto overscroll-contain rounded-2xl p-2",
              className,
            )}
          >
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
