/**
 * Today's colour in Apple's day view and week row: Apple's red, or Casy's
 * orange on the home page's day view (#176). The fill takes white text, so
 * it is `cta`, whose contrast with white is checked.
 */
export type TodayTone = "red" | "orange";

export const TODAY_TONE = {
  red: { fill: "bg-red-500", text: "text-red-500" },
  orange: { fill: "bg-cta", text: "text-primary" },
} as const;
