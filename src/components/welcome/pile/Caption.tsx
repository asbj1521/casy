import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { hideGlass, nativeGlassAvailable, showGlass } from "@/lib/nativeGlass";
import { CAPTION_HEIGHT, CAPTION_RADIUS } from "./demo";

/**
 * The step under way, numbered, over the bottom of the picture, where there is
 * room and where the eye already is: big enough to be read at a glance. In the
 * app on iOS 26 it is Apple's real Liquid Glass (nativeGlass.ts), bending the
 * animation under it; the page then only keeps its place and says where it is.
 * Elsewhere the page's own glass.
 */
export default function Caption({
  scene,
  text,
}: {
  scene: "pile" | "list" | "swipe" | "added";
  text: string;
}) {
  const n = { pile: 1, list: 2, swipe: 3, added: 4 }[scene];
  const place = useRef<HTMLDivElement>(null);
  const accent = useRef<HTMLSpanElement>(null);
  const [native, setNative] = useState(false);
  useEffect(() => {
    let live = true;
    void nativeGlassAvailable().then((yes) => live && setNative(yes));
    return () => {
      live = false;
    };
  }, []);
  // The native card follows the place the page keeps for it, and its words.
  useEffect(() => {
    const el = place.current;
    if (!native || !el) return;
    const send = () => {
      const r = el.getBoundingClientRect();
      const rgb = getComputedStyle(accent.current ?? el).backgroundColor.match(/\d+/g) ?? [];
      void showGlass({
        x: r.left,
        y: r.top,
        width: r.width,
        height: r.height,
        radius: CAPTION_RADIUS,
        number: String(n),
        text,
        accent: [Number(rgb[0] ?? 234), Number(rgb[1] ?? 88), Number(rgb[2] ?? 12)],
      });
    };
    send();
    const observer = new ResizeObserver(send);
    observer.observe(el);
    return () => observer.disconnect();
  }, [native, n, text]);
  useEffect(() => (native ? () => void hideGlass() : undefined), [native]);

  return (
    <div
      ref={place}
      className="absolute inset-x-4 bottom-8 z-20"
      style={{ height: CAPTION_HEIGHT }}
    >
      {/* Casy's orange, read here and handed to the native badge. */}
      <span ref={accent} className="hidden bg-primary" />
      {!native && (
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={scene}
            className="glass-caption flex h-full items-center gap-4 px-5"
            style={{ borderRadius: CAPTION_RADIUS }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-[22px] font-bold text-primary-foreground">
              {n}
            </span>
            <span className="text-[20px] font-semibold leading-snug text-foreground">{text}</span>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}
