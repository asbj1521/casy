import { useState, type CSSProperties } from "react";

import { cn } from "@/lib/utils";

/** A stable palette, cycled by position in a list, so neighbours never match. */
const COLORS = [
  "bg-emerald-100 text-emerald-700",
  "bg-sky-100 text-sky-700",
  "bg-amber-100 text-amber-700",
  "bg-violet-100 text-violet-700",
  "bg-rose-100 text-rose-700",
];

const SIZES = {
  xs: "h-5 w-5 text-[10px]",
  sm: "h-6 w-6 text-[11px]",
  md: "h-8 w-8 text-xs",
  /** In front of a phone list row (ListRow). */
  row: "h-10 w-10 text-base",
  lg: "h-14 w-14 text-xl",
};

/**
 * Someone's profile picture (#187) in a circle, or, without one (or while it
 * can't be loaded), their first letter in a circle coloured by their place in
 * the list. Silent for screen readers when the name is written beside it; with
 * `labelled`, where only the letter shows, it carries the name (also as a
 * tooltip).
 */
export default function Avatar({
  name,
  index,
  size = "sm",
  labelled = false,
  className,
  style,
  src,
}: {
  name: string;
  index: number;
  size?: keyof typeof SIZES;
  labelled?: boolean;
  /** E.g. a ring for overlapping avatars, or other colours. */
  className?: string;
  style?: CSSProperties;
  /** Their profile picture's link, if they have one. */
  src?: string | null;
}) {
  // A link that has stopped working (they last a week) falls back to the letter.
  const [broken, setBroken] = useState<string | null>(null);
  const picture = src && src !== broken ? src : null;
  return (
    <span
      style={style}
      {...(labelled ? { role: "img", "aria-label": name, title: name } : { "aria-hidden": true })}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-semibold",
        SIZES[size],
        COLORS[index % COLORS.length],
        className,
      )}
    >
      {picture ? (
        <img
          src={picture}
          alt=""
          onError={() => setBroken(picture)}
          className="h-full w-full rounded-full object-cover"
        />
      ) : (
        name.trim().charAt(0).toUpperCase()
      )}
    </span>
  );
}
