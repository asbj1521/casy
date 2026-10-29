import { useState } from "react";

import { readStored, writeStored } from "@/lib/storage";

/** One day in view or two, as the person last chose: this device's own. */
const SPAN_KEY = "casy-day-span";

/**
 * The day view's 1/2-day choice (#176), kept on the device, starting at one:
 * the home page's toolbar switches it (#180), the day view draws it.
 */
export function useDaySpan(): { span: 1 | 2; toggle: () => void } {
  const [span, setSpan] = useState<1 | 2>(() => (readStored(SPAN_KEY) === "2" ? 2 : 1));
  const toggle = () => {
    const next = span === 1 ? 2 : 1;
    setSpan(next);
    writeStored(SPAN_KEY, String(next));
  };
  return { span, toggle };
}
