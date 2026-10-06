import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

/** Casy's own colours: the coral accent, the "everyone" green, amber and a sky blue. */
const COLORS = ["hsl(20 90% 48%)", "hsl(150 48% 40%)", "hsl(38 92% 50%)", "hsl(199 89% 48%)"];
const PIECES = 36;

/**
 * A burst of confetti for the moment a date is settled (#74): the answer
 * that completed it, or the first look at it afterwards. Drawn with Framer
 * Motion rather than a Lottie file, so it costs no extra library or
 * download, follows the site's colours, and passes the Content-Security-
 * Policy (no eval). Nothing at all with reduced motion: the words say it.
 */
export default function Celebration() {
  const reduceMotion = useReducedMotion();
  // Made once, so a re-render never reshuffles pieces in flight.
  const [pieces] = useState(() =>
    Array.from({ length: PIECES }, (_, i) => {
      const angle = (i / PIECES) * Math.PI * 2 + Math.random() * 0.4;
      const distance = 120 + Math.random() * 160;
      return {
        x: Math.cos(angle) * distance,
        // Up and out, then falling a little, as paper does.
        y: Math.sin(angle) * distance * 0.7 + 140,
        rotate: (Math.random() - 0.5) * 720,
        delay: Math.random() * 0.12,
        color: COLORS[i % COLORS.length],
        round: i % 3 === 0,
      };
    }),
  );
  if (reduceMotion) return null;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[80] overflow-hidden">
      <div className="absolute left-1/2 top-1/3">
        {pieces.map((p, i) => (
          <motion.span
            key={i}
            className="absolute block"
            style={{
              width: p.round ? 8 : 6,
              height: p.round ? 8 : 12,
              borderRadius: p.round ? 999 : 2,
              background: p.color,
            }}
            initial={{ x: 0, y: 0, rotate: 0, opacity: 1, scale: 0.6 }}
            animate={{ x: p.x, y: p.y, rotate: p.rotate, opacity: 0, scale: 1 }}
            transition={{ duration: 1.6, delay: p.delay, ease: [0.15, 0.7, 0.4, 1] }}
          />
        ))}
      </div>
    </div>
  );
}
