import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  type FormEvent,
  type ReactNode,
  type RefObject,
} from "react";

import { motion, usePresence, useReducedMotion } from "framer-motion";
import { ChevronLeft } from "lucide-react";

import Modal from "@/components/ui/Modal";
import { cn } from "@/lib/utils";

/**
 * The sheet slides up from below the screen, as iOS sheets do. Animated as
 * one `transform` string rather than Framer Motion's `y`, so the browser runs
 * it on the compositor (Web Animations): `y` is stepped from JavaScript every
 * frame, and on an iPhone busy drawing the page under it (My calendar's
 * months, #104) it moved in two or three visible jumps.
 */
const SHEET_MOTION = {
  initial: { transform: "translateY(100%)" },
  animate: { transform: "translateY(0%)" },
  exit: { transform: "translateY(100%)" },
  transition: { duration: 0.32, ease: [0.32, 0.72, 0, 1] },
} as const;

/** iOS's sheet curve, for a sheet growing out of its button (#169) too. */
const EASE = "cubic-bezier(0.32, 0.72, 0, 1)";
const SLIDE_MS = 320;
const MORPH_MS = 420;
/** How far along the shrinking (on its eased curve, so late in time) the sheet starts to fade, so the button under it shows through. */
const SHRUNK_AT = 0.9;

/** Which edge of the screen a sheet stands on. */
type Edge = "bottom" | "top";

/** The sheet's corners once open: round on the side away from its edge. */
const OPEN_RADIUS: Record<Edge, string> = {
  bottom: "28px 28px 0px 0px / 28px 28px 0px 0px",
  top: "0px 0px 28px 28px / 0px 0px 28px 28px",
};
const OPEN_FRAME = { transform: "translate(0px, 0px) scale(1, 1)" };

/**
 * The sheet drawn as the button it grows out of: moved onto it and scaled to
 * its size (from the top left corner), its corners rounded so that once
 * scaled they are the button's own, a circle or a capsule. Elliptical radii,
 * since the sheet is scaled by a different amount each way.
 */
function asButton(button: DOMRect, sheet: DOMRect): Keyframe {
  const sx = button.width / sheet.width;
  const sy = button.height / sheet.height;
  const rx = button.height / 2 / sx;
  const ry = button.height / 2 / sy;
  return {
    transform: `translate(${button.left - sheet.left}px, ${button.top - sheet.top}px) scale(${sx}, ${sy})`,
    borderRadius: `${rx}px ${rx}px ${rx}px ${rx}px / ${ry}px ${ry}px ${ry}px ${ry}px`,
  };
}

/** Off the screen past its edge: where a sheet with no button slides from. */
const offScreen = (edge: Edge) => (edge === "bottom" ? "translateY(100%)" : "translateY(-100%)");

/**
 * A sheet rising from the bottom of a phone's screen (or dropping from its
 * top), over everything, the home page's buttons included: its title on the
 * left, one text action on the right, and what is being chosen under them.
 * Always glass, the page behind showing through (#126, #153: the `glass`
 * class in index.css), and barely dimmed. The phone's scheduling flow (#101)
 * opens its pickers here rather than in a menu under their button, which
 * near the bottom of the screen would land behind the bar pinned there. Esc
 * and a tap outside close it too.
 *
 * Given the button that opens it (`origin`), the sheet grows out of that
 * button and shrinks back into it as it closes (#169): Aftaler, Planlæg and
 * the profile from the bottom of the home page, Kalendere from its top.
 */
export default function BottomSheet({
  open,
  onClose,
  title,
  doneLabel,
  footer,
  onSubmit,
  busy = false,
  origin,
  edge = "bottom",
  onClosed,
  arrived = false,
  stacked = false,
  back,
  accessory,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  doneLabel: string;
  /**
   * The sheet's way on, pinned along its bottom while the rest scrolls
   * (My calendar's Planlæg sheet, #126). Without one, the whole sheet scrolls.
   */
  footer?: ReactNode;
  /** The sheet as a form: Enter in a field, or a submit button in the footer, sends it. */
  onSubmit?: (e: FormEvent<HTMLFormElement>) => void;
  /** A request is running: a tap outside doesn't close it. */
  busy?: boolean;
  /**
   * The button the sheet grows out of and shrinks back into (#169), read as
   * it opens and again as it closes: empty then, the sheet slides instead.
   */
  origin?: RefObject<HTMLElement | null>;
  /** The edge it stands on: the bottom, or the top for a button up there (#169). */
  edge?: Edge;
  /** Once it has finished closing (shrunk back into its button, or slid away). */
  onClosed?: () => void;
  /**
   * Open already as the page appears (back from one of its screens, #169):
   * shown in place, as it was never closed. Still closes the usual way.
   */
  arrived?: boolean;
  /**
   * Screens pushed inside the sheet (#174, the profile): the header stays put,
   * the children scroll by themselves, each screen its own scroller, and the
   * sheet keeps one height, so a screen only slides in from the side.
   */
  stacked?: boolean;
  /** A way back to the screen before, left of the title, iOS's "‹ Profil" (#174). */
  back?: { label: string; onBack: () => void };
  /** A small capsule beside the title (Planlæg's Genveje, #175), never with `back`. */
  accessory?: ReactNode;
  children: ReactNode;
}) {
  const titleId = useId();
  useEffect(() => {
    if (!open || busy) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  const header = (
    <div className="relative mb-3 flex items-center justify-between gap-3">
      {back && (
        <button
          type="button"
          onClick={back.onBack}
          className="-ml-1.5 flex shrink-0 items-center text-[17px] text-primary"
        >
          <ChevronLeft className="h-6 w-6" />
          {back.label}
        </button>
      )}
      {/* With a way back, the title sits in the middle, as iOS draws it. */}
      <h3
        id={titleId}
        className={cn(
          "min-w-0 break-words text-[17px] font-bold text-foreground",
          back && "pointer-events-none absolute inset-x-24 truncate text-center",
        )}
      >
        {title}
      </h3>
      {accessory && !back && <span className="mr-auto shrink-0">{accessory}</span>}
      <button
        type="button"
        onClick={onClose}
        disabled={busy}
        className="shrink-0 rounded-lg px-2 py-1 text-[15px] font-semibold text-primary disabled:opacity-50"
      >
        {doneLabel}
      </button>
    </div>
  );

  // Round on the side away from its edge, clear of the clock or the home
  // indicator on the side it stands on.
  const top = edge === "top";
  const shape = top
    ? "rounded-b-[28px] pt-[calc(1rem+env(safe-area-inset-top))]"
    : "rounded-t-[28px]";
  const content =
    footer || stacked ? (
      <>
        <div className={cn("px-4", top ? "pt-[calc(1rem+env(safe-area-inset-top))]" : "pt-4")}>
          {header}
        </div>
        {stacked ? (
          <div className="relative flex min-h-0 flex-auto flex-col overflow-hidden">{children}</div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
            {children}
          </div>
        )}
        {footer && (
          <div
            className={cn(
              "px-4 pt-3",
              top ? "pb-3" : "pb-[calc(0.75rem+env(safe-area-inset-bottom))]",
            )}
          >
            {footer}
          </div>
        )}
      </>
    ) : (
      <>
        {header}
        {children}
      </>
    );
  const className =
    footer || stacked
      ? cn(
          "glass relative z-10 flex w-full flex-col",
          top ? "rounded-b-[28px]" : "rounded-t-[28px]",
          // Screens inside it (#174) never change its height.
          stacked ? "h-[85dvh]" : "max-h-[85dvh]",
        )
      : cn(
          "glass relative z-10 max-h-[85dvh] w-full overflow-y-auto p-4",
          shape,
          top ? "pb-4" : "pb-[calc(1rem+env(safe-area-inset-bottom))]",
        );

  const aria = { role: "dialog", "aria-modal": true, "aria-labelledby": titleId } as const;

  return (
    <Modal
      open={open}
      placement={edge}
      lightBackdrop
      busy={busy}
      onClose={onClose}
      onClosed={onClosed}
      arrived={arrived}
    >
      {origin ? (
        <GrowingPanel
          origin={origin}
          edge={edge}
          column={!!footer || stacked}
          arrived={arrived}
          aria={aria}
          onSubmit={onSubmit}
          className={className}
        >
          {content}
        </GrowingPanel>
      ) : onSubmit ? (
        // A form only when asked: inside one, any button without a type would send it.
        <motion.form {...SHEET_MOTION} {...aria} onSubmit={onSubmit} className={className}>
          {content}
        </motion.form>
      ) : (
        <motion.div {...SHEET_MOTION} {...aria} className={className}>
          {content}
        </motion.div>
      )}
    </Modal>
  );
}

/**
 * The sheet that grows out of its button (#169). The browser's own animation
 * engine moves it (transform and corners, the content fading in over the
 * second half so nothing is seen squashed), as the send flight is
 * (sendFlightPlay.ts): measured before the first frame is drawn, so it never
 * shows full size first. Kept on the page until it has shrunk back
 * (usePresence). Without its button at either end, it slides from its edge;
 * with reduced motion it simply appears and goes.
 */
function GrowingPanel({
  origin,
  edge,
  column,
  arrived,
  aria,
  onSubmit,
  className,
  children,
}: {
  origin: RefObject<HTMLElement | null>;
  edge: Edge;
  /** A column, the footer pinned under content that scrolls. */
  column: boolean;
  /** Open already as the page appears: no growing, only the shrinking back. */
  arrived: boolean;
  aria: Record<string, unknown>;
  onSubmit?: (e: FormEvent<HTMLFormElement>) => void;
  className: string;
  children: ReactNode;
}) {
  const panel = useRef<HTMLElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [isPresent, safeToRemove] = usePresence();
  const still = useReducedMotion() ?? false;

  useLayoutEffect(() => {
    const sheet = panel.current;
    if (!sheet || still || arrived) return;
    const button = origin.current;
    const timing = { easing: EASE, fill: "backwards" } as const;
    const moves = button
      ? [
          sheet.animate(
            [
              asButton(button.getBoundingClientRect(), sheet.getBoundingClientRect()),
              { ...OPEN_FRAME, borderRadius: OPEN_RADIUS[edge] },
            ],
            { ...timing, duration: MORPH_MS },
          ),
          ...(inner.current
            ? [
                inner.current.animate(
                  [{ opacity: 0 }, { opacity: 0, offset: 0.45 }, { opacity: 1 }],
                  {
                    duration: MORPH_MS,
                    fill: "backwards",
                  },
                ),
              ]
            : []),
        ]
      : [
          sheet.animate([{ transform: offScreen(edge) }, { transform: "translateY(0%)" }], {
            ...timing,
            duration: SLIDE_MS,
          }),
        ];
    // Held at the start (the button, or off the screen) until that has been
    // drawn, then played: a new glass sheet's first frame (its blur, over a
    // screen of months) can be slow to draw, and the growing should start
    // from the button on screen, not partway through.
    moves.forEach((move) => move.pause());
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => moves.forEach((move) => move.play()));
    });
    // Cancelled when the effect is cleaned up: in development React runs it
    // twice (StrictMode), and the second run would otherwise measure the sheet
    // already shrunk to the button by the first, and barely grow it at all.
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
      moves.forEach((move) => move.cancel());
    };
    // Only as it opens: the sheet opens afresh each time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isPresent) return;
    const sheet = panel.current;
    if (!sheet || still) {
      safeToRemove?.();
      return;
    }
    // Measured again: the sheet may have grown since, and the button moved.
    const button = origin.current;
    sheet.getAnimations().forEach((a) => a.cancel());
    // Into the button, fading out over the last of it: the button is on the
    // page under it by then, so it shows through as the glass goes, rather
    // than the glass lying over its icon until the sheet is gone.
    const going = button
      ? sheet.animate(
          [
            { ...OPEN_FRAME, borderRadius: OPEN_RADIUS[edge], opacity: 1 },
            { opacity: 1, offset: SHRUNK_AT },
            {
              ...asButton(button.getBoundingClientRect(), sheet.getBoundingClientRect()),
              opacity: 0,
            },
          ],
          { duration: MORPH_MS, easing: EASE, fill: "forwards" },
        )
      : sheet.animate([{ transform: "translateY(0%)" }, { transform: offScreen(edge) }], {
          duration: SLIDE_MS,
          easing: EASE,
          fill: "forwards",
        });
    if (button) {
      inner.current?.animate([{ opacity: 1 }, { opacity: 0, offset: 0.5 }, { opacity: 0 }], {
        duration: MORPH_MS,
        fill: "forwards",
      });
    }
    going.onfinish = () => safeToRemove?.();
    going.oncancel = () => safeToRemove?.();
  }, [isPresent, safeToRemove, still, origin, edge]);

  // The content's own box, so it can fade on its own; laid out as the panel's
  // children would be (a column when the footer is pinned).
  const body = (
    <div ref={inner} className={column ? "flex min-h-0 flex-1 flex-col" : undefined}>
      {children}
    </div>
  );
  const style = { transformOrigin: "0 0" } as const;
  return onSubmit ? (
    <form
      ref={panel as RefObject<HTMLFormElement>}
      {...aria}
      onSubmit={onSubmit}
      className={className}
      style={style}
    >
      {body}
    </form>
  ) : (
    <div ref={panel as RefObject<HTMLDivElement>} {...aria} className={className} style={style}>
      {body}
    </div>
  );
}
