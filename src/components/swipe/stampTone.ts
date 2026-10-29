import type { EventResponse } from "@/api/events";

/** A vote's answer stamped into its day (#172) or onto its date (#176): the answer buttons' own colour. */
export const STAMP_TONE: Record<EventResponse, string> = {
  accepted: "bg-emerald-500",
  maybe: "bg-amber-400",
  declined: "bg-rose-500",
};
