import { memo, useMemo } from "react";

import { LOCALE, useLang, useT } from "@/i18n/lang";
import { buildMonthLayout } from "@/lib/calendarOverview";
import { capitalize } from "@/lib/format";
import { LANE_PX, layoutWeek, weekRowPx, type GridItem } from "@/lib/monthGrid";
import { addDays, localDate } from "@/lib/zone";
import { TZ } from "./demo";
import { HEADER_PX } from "./geometry";

const LANES = 3;
/** Where the bars start under a week's line: the line and the number (MonthSection). */
const NUMBER_PX = 41;

/** Three pen scribbles, like a word written fast; a day picks one, so no two lines match. */
const SCRIBBLES = [
  "M2 11c3-9 5-9 6-1s3 7 6 0 5-8 7 0 3 7 6 1 4-7 7-1 3 5 8 0",
  "M2 8c2 5 4 6 7 1s4-6 6 0 3 6 6 0 4-5 7 1 5 4 10-2",
  "M3 10c4-8 6-7 7 0s4 5 6-1 5-7 6 1 4 6 8-1 3-3 8-1",
];

/**
 * A real paper calendar, printed and written on (#228): it hangs from its
 * binding, its numbers are in a printed serif, and someone's busy days are in
 * their own pen, each scribble exactly where the phone's month draws that
 * person's bar, so paper turning digital shows each one becoming the other.
 * The same in dark mode: paper is paper.
 */
const PaperCalendar = memo(function PaperCalendar({
  month,
  items,
  who,
  name,
  color,
  radius,
}: {
  month: number;
  /** Everyone's so far and this person's, laid out as the month will lay them out. */
  items: GridItem[];
  who: string;
  name: string;
  color: string;
  radius?: number;
}) {
  const t = useT();
  const { lang } = useLang();
  const { year, month: m } = localDate(month, TZ);
  const weeks = useMemo(() => {
    const layout = buildMonthLayout(year, m, TZ, LOCALE[lang]);
    return layout.weeks.map((week) => {
      const days = week.map((d) => d.date.getTime());
      const { placed } = layoutWeek(items, days, addDays(days[6], 1, TZ), LANES);
      return { week, placed: placed.filter((p) => p.item.calendarId === who) };
    });
  }, [year, m, lang, items, who]);
  const title = capitalize(
    new Date(month).toLocaleDateString(LOCALE[lang], { month: "long", timeZone: TZ }),
  );
  const firstDay = weeks[0].week.findIndex((d) => d.inMonth);
  const pen = `rgb(${color})`;

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{
        borderRadius: radius,
        // Off-white, a little warmer down the sheet; printer's ink rather than the app's colours.
        background: "linear-gradient(170deg, #fdfbf5, #f6f1e4)",
        color: "#2b2926",
        fontFamily: 'Georgia, "Times New Roman", serif',
      }}
    >
      {/* The binding: punched holes along the top, each with its wire. */}
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
      <div className="absolute inset-x-0 text-center" style={{ top: 52 }}>
        <div className="text-[46px] font-bold leading-[56px] tracking-tight">{title}</div>
        <div className="text-[15px] tracking-[0.3em] text-[#2b2926]/60">{year}</div>
      </div>
      <div
        className="absolute inset-x-0 grid grid-cols-7 text-center text-[12px] font-bold uppercase tracking-wider"
        style={{ top: HEADER_PX - 24 }}
      >
        {[1, 2, 3, 4, 5, 6, 0].map((dow) => (
          <span key={dow} className={dow === 0 || dow === 6 ? "text-[#b3362b]" : ""}>
            {t.weekdaysShort[dow].charAt(0)}
          </span>
        ))}
      </div>
      <div className="absolute inset-x-0" style={{ top: HEADER_PX }}>
        {weeks.map(({ week, placed }, w) => (
          <div
            key={w}
            className="relative border-t border-[#2b2926]/25"
            style={{ height: weekRowPx(LANES) }}
          >
            {/* Whose it is, in the empty days before the 1st. */}
            {w === 0 && firstDay > 0 && (
              <span
                className="absolute left-3 top-[2px] -rotate-3 text-[26px] leading-[36px]"
                style={{ color: pen, fontFamily: '"Bradley Hand", Noteworthy, cursive' }}
              >
                {name}
              </span>
            )}
            <div className="grid grid-cols-7">
              {week.map((d, c) => (
                <span
                  key={d.key}
                  className={`flex h-10 items-center justify-center text-[20px] ${
                    c >= 5 ? "text-[#b3362b]" : ""
                  }`}
                >
                  {d.inMonth && d.dayOfMonth}
                </span>
              ))}
            </div>
            {/* The ruled lines between the days. */}
            {[1, 2, 3, 4, 5, 6].map((c) => (
              <span
                key={c}
                className="absolute inset-y-0 w-px bg-[#2b2926]/10"
                style={{ left: `${(c / 7) * 100}%` }}
              />
            ))}
            {placed.map((p) => (
              <svg
                key={p.from}
                aria-hidden
                viewBox="0 0 48 16"
                preserveAspectRatio="none"
                className="absolute"
                style={{
                  top: NUMBER_PX + p.lane * LANE_PX,
                  height: LANE_PX - 3,
                  left: `calc(${(p.from / 7) * 100}% + 4px)`,
                  width: `calc(${100 / 7}% - 8px)`,
                }}
              >
                <path
                  d={SCRIBBLES[(w * 7 + p.from) % SCRIBBLES.length]}
                  fill="none"
                  stroke={pen}
                  strokeWidth={2.2}
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
});

export default PaperCalendar;
