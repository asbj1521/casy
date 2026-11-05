import { AnimatePresence, motion } from "framer-motion";

import { CAPTION_HEIGHT, CAPTION_RADIUS } from "./demo";

/**
 * The step under way, numbered, over the bottom of the picture, where there is
 * room and where the eye already is: big enough to be read at a glance. CSS
 * glass: Apple's real Liquid Glass comes back with the Swift rebuild (#192).
 */
export default function Caption({
  scene,
  text,
}: {
  scene: "pile" | "list" | "swipe" | "added";
  text: string;
}) {
  const n = { pile: 1, list: 2, swipe: 3, added: 4 }[scene];

  return (
    <div className="absolute inset-x-4 bottom-8 z-20" style={{ height: CAPTION_HEIGHT }}>
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
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-[1.375rem] font-bold text-primary-foreground">
            {n}
          </span>
          <span className="text-[1.25rem] font-semibold leading-snug text-foreground">{text}</span>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
