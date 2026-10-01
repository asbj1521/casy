import { useCallback, useEffect, useRef, useState } from "react";

/** How long "Copied" shows after a copy. */
const COPIED_MS = 2000;

/**
 * Copy text to the clipboard, and say so for a moment: `[copied, copy]`.
 * "Copied" only shows if it worked: the clipboard can be refused, and then
 * the text is still on screen to copy by hand.
 */
export function useCopy(): [boolean, (text: string) => void] {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = useCallback((text: string) => {
    navigator.clipboard?.writeText(text).then(
      () => {
        setCopied(true);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), COPIED_MS);
      },
      () => undefined,
    );
  }, []);

  return [copied, copy];
}
