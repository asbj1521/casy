import { useRef } from "react";

import DateDeck from "@/components/swipe/DateDeck";
import { useFillViewport } from "@/hooks/useFillViewport";
import type { VoteEvent } from "@/lib/vote";

/**
 * A vote's cards on a computer (#74), filling the window below where they
 * start, so the date, the answers and your calendar fit on one screen:
 * the box's own padding, and a gap, are left below.
 */
export default function DeckBox({ event }: { event: VoteEvent }) {
  const box = useRef<HTMLDivElement>(null);
  const height = useFillViewport(box, { bottom: 40, min: 460 });
  return (
    <div ref={box} className="mt-3" style={{ height: height ?? undefined }}>
      {height !== null && <DateDeck event={event} variant="pane" />}
    </div>
  );
}
