import { useEffect, useRef } from "react";

import { takeStatusTap } from "@/lib/statusTap";

/**
 * Take the tap at the very top of the screen (#168, lib/statusTap.ts) while
 * this screen is open, instead of the page gliding up.
 */
export function useStatusTap(onTap: () => void) {
  const latest = useRef(onTap);
  useEffect(() => {
    latest.current = onTap;
  });
  useEffect(() => takeStatusTap(() => latest.current()), []);
}
