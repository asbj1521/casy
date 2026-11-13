import { memo, useMemo, type ReactNode } from "react";
import { motion } from "framer-motion";

import { LOCALE, useLang, useT } from "@/i18n/lang";
import { buildMonthLayout } from "@/lib/calendarOverview";
import { LANE_PX, layoutWeek, weekRowPx, type GridItem } from "@/lib/monthGrid";
import { addDays, localDate } from "@/lib/zone";
import { colorOf, TZ } from "./demo";
import { HEADER_PX, SCREEN } from "./geometry";

const LANES = 3;
/** Where the bars start under a week's line: the line and the number (MonthSection). */
const NUMBER_PX = 41;
const PAPER = "#fbf8f0";
const INK = "#2b2926";
const WEEKEND_INK = "#b3362b";

/** Three pen scribbles, like a word written fast; a day picks one, so no two lines match. */
const SCRIBBLES = [
  "M2 11c3-9 5-9 6-1s3 7 6 0 5-8 7 0 3 7 6 1 4-7 7-1 3 5 8 0",
  "M2 8c2 5 4 6 7 1s4-6 6 0 3 6 6 0 4-5 7 1 5 4 10-2",
  "M3 10c4-8 6-7 7 0s4 5 6-1 5-7 6 1 4 6 8-1 3-3 8-1",
];

/** A strip of the sheet that goes when the paper dissolves: the middle first, and outward. */
function Piece({
  dissolve,
  delay,
  className,
  style,
  children,
}: {
  dissolve: boolean | undefined;
  delay: number;
  className?: string;
  style?: React.CSSProperties;
  children?: ReactNode;
}) {
  return (
    <motion.div
      className={className}
      style={{ background: PAPER, ...style }}
      initial={false}
      animate={{ opacity: dissolve ? 0 : 1 }}
      transition={{ delay: dissolve ? delay : 0, duration: 0.6, ease: "easeInOut" }}
    >
      {children}
    </motion.div>
  );
}

/**
 * A real paper calendar, printed and written on (#228): it hangs from its
 * binding, says whose it is at the top, its numbers are in a printed serif, and
 * someone's busy days are in their own pen, each scribble exactly where the
 * phone's month draws that person's bar. With no `who`, everyone's pen is on it:
 * the calendars become one, which then dissolves (`dissolve`) a week at a time
 * into the real month lying under it. The same in dark mode: paper is paper.
 */
const PaperCalendar = memo(function PaperCalendar({
  month,
  items,
  who,
  title,
  color,
  dissolve,
}: {
  month: number;
  /** Everyone's, laid out as the month will lay them out. */
  items: GridItem[];
  /** Whose pen marks show; none for everyone's. */
  who?: string;
  title: string;
  color?: string;
  dissolve?: boolean;
}) {
  const t = useT();
  const { lang } = useLang();
  const { year, month: m } = localDate(month, TZ);
  const weeks = useMemo(() => {
    const layout = buildMonthLayout(year, m, TZ, LOCALE[lang]);
    return layout.weeks.map((week) => {
      const days = week.map((d) => d.date.getTime());
      const { placed } = layoutWeek(items, days, addDays(days[6], 1, TZ), LANES);
      return { week, placed: who ? placed.filter((p) => p.item.calendarId === who) : placed };
    });
  }, [year, m, lang, items, who]);
  const rowPx = weekRowPx(LANES);
  const middle = (weeks.length - 1) / 2;
  const STEP = 0.16;
  const last = (middle + 1) * STEP;

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{
        color: INK,
        fontFamily: 'Georgia, "Times New Roman", serif',
        borderRadius: who ? undefined : SCREEN.radius,
      }}
    >
      {/* The top of the sheet: the binding, whose it is, the weekdays. */}
      <Piece
        dissolve={dissolve}
        delay={last}
        className="absolute inset-x-0 top-0"
        style={{ height: HEADER_PX }}
      >
        <div className="absolute inset-x-0 flex justify-center gap-[22px]" style={{ top: 18 }}>
          {Array.from({ length: 10 }, (_, i) => (
            <span key={i} className="relative h-[13px] w-[13px] rounded-full bg-[#3a3833]/80">
              <span
                className="absolute left-[4px] h-[22px] w-[5px] rounded-full"
                style={{
                  bottom: 5,
                  background: "linear-gradient(90deg, #8a8c90, #e6e7e8 45%, #9b9da1)",
                }}
              />
            </span>
          ))}
        </div>
        <div
          className="absolute inset-x-4 truncate text-center text-[46px] font-bold leading-[56px] tracking-tight"
          style={{ top: 62, color: color ? `rgb(${color})` : INK }}
        >
          {title}
        </div>
        <div
          className="absolute inset-x-0 grid grid-cols-7 text-center text-[12px] font-bold uppercase tracking-wider"
          style={{ top: HEADER_PX - 24 }}
        >
          {[1, 2, 3, 4, 5, 6, 0].map((dow) => (
            <span key={dow} style={{ color: dow === 0 || dow === 6 ? WEEKEND_INK : undefined }}>
              {t.weekdaysShort[dow].charAt(0)}
            </span>
          ))}
        </div>
      </Piece>
      {weeks.map(({ week, placed }, w) => (
        <Piece
          key={w}
          dissolve={dissolve}
          delay={Math.abs(w - middle) * STEP}
          className="absolute inset-x-0 border-t"
          style={{
            top: HEADER_PX + w * rowPx,
            height: rowPx,
            borderColor: "rgb(43 41 38 / 0.25)",
          }}
        >
          <div className="grid grid-cols-7">
            {week.map((d, c) => (
              <span
                key={d.key}
                className="flex h-10 items-center justify-center text-[20px]"
                style={{ color: c >= 5 ? WEEKEND_INK : undefined }}
              >
                {d.inMonth && d.dayOfMonth}
              </span>
            ))}
          </div>
          {/* The ruled lines between the days. */}
          {[1, 2, 3, 4, 5, 6].map((c) => (
            <span
              key={c}
              className="absolute inset-y-0 w-px"
              style={{ left: `${(c / 7) * 100}%`, background: "rgb(43 41 38 / 0.1)" }}
            />
          ))}
          {placed.map((p) => (
            <svg
              key={`${p.from}-${p.lane}`}
              aria-hidden
              viewBox="0 0 48 16"
              preserveAspectRatio="none"
              className="absolute"
              style={{
                top: NUMBER_PX - 1 + p.lane * LANE_PX,
                height: LANE_PX - 3,
                left: `calc(${(p.from / 7) * 100}% + 4px)`,
                width: `calc(${100 / 7}% - 8px)`,
              }}
            >
              <path
                d={SCRIBBLES[(w * 7 + p.from + p.lane) % SCRIBBLES.length]}
                fill="none"
                stroke={`rgb(${color ?? colorOf(p.item.calendarId)})`}
                strokeWidth={2.2}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          ))}
        </Piece>
      ))}
      {/* The bottom of the sheet, under the last week. */}
      <Piece
        dissolve={dissolve}
        delay={last}
        className="absolute inset-x-0 bottom-0"
        style={{ top: HEADER_PX + weeks.length * rowPx }}
      />
    </div>
  );
});

export default PaperCalendar;
