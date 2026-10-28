import { useState } from "react";

import { useLang } from "@/i18n/lang";
import { capitalize, monthName } from "@/lib/format";
import { MONTH_LABEL_PX } from "@/lib/monthScroll";
import { APP_TIME_ZONE, localDate } from "@/lib/zone";
import { type Frame, TITLE_EDGE_PX, titleBand } from "./shared";

/** In place of the small month name over the 1st: an empty row, so the weeks still line up. */
export function NoShortName() {
  return <div aria-hidden style={{ height: MONTH_LABEL_PX }} />;
}

/**
 * The band at the top of the pile (titleBand), with the big month name drawn
 * exactly over My calendar's (#162). `opaque` hides the page's own name under
 * it, for when the two would differ.
 */
export default function PileTitle({
  frame,
  month,
  opaque = false,
}: {
  frame: Frame;
  /** The month named (its local midnight), or none for an empty band. */
  month: number | null;
  opaque?: boolean;
}) {
  const { lang } = useLang();
  const [thisYear] = useState(() => localDate(Date.now(), APP_TIME_ZONE).year);
  const band = titleBand(frame);
  if (!frame.title || band === 0) return null;
  const name = month === null ? null : capitalize(monthName(month, lang));
  const { year } = localDate(month ?? frame.month, APP_TIME_ZONE);
  return (
    <div
      aria-hidden
      className="relative shrink-0"
      style={{
        height: band,
        backgroundColor: opaque ? "rgb(var(--glass-tint))" : undefined,
      }}
    >
      {name && (
        // The page's own heading, to the pixel: the same classes, padding included.
        <span
          className="absolute whitespace-nowrap px-3 pb-1 pt-1 text-[30px] font-bold leading-tight tracking-tight text-foreground"
          style={{ top: TITLE_EDGE_PX, left: frame.title.left - frame.left }}
        >
          {year !== thisYear ? `${name} ${year}` : name}
        </span>
      )}
    </div>
  );
}
