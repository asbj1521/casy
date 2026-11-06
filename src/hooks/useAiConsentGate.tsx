import { useRef, useState } from "react";

import AiConsentSheet from "@/components/ai/AiConsentSheet";
import { useAiContent } from "@/hooks/useAiAllowed";

/**
 * Asks before an AI button does anything (#147). `guard` runs what was pressed
 * at once for someone who has said yes; anyone else gets the question, and it
 * runs on their yes. "Not now" leaves everything as it was, and the next press
 * asks again. Render `sheet` beside what it guards, not inside another sheet.
 */
export function useAiConsentGate() {
  const allowed = useAiContent();
  const [asking, setAsking] = useState(false);
  // A new sheet for each question, so it opens on its first page.
  const [asks, setAsks] = useState(0);
  const waiting = useRef<(() => void) | null>(null);

  function guard(run: () => void) {
    if (allowed) {
      run();
      return;
    }
    waiting.current = run;
    setAsks((n) => n + 1);
    setAsking(true);
  }

  const sheet =
    asks > 0 ? (
      <AiConsentSheet
        key={asks}
        open={asking}
        onClose={() => setAsking(false)}
        onYes={() => {
          setAsking(false);
          waiting.current?.();
          waiting.current = null;
        }}
      />
    ) : null;

  return { guard, sheet };
}
