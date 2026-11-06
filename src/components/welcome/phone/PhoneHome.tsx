import { memo, useCallback, useMemo, type CSSProperties, type ReactNode } from "react";
import { motion } from "framer-motion";
import { CalendarCheck, CalendarSearch, Layers, Plus, User } from "lucide-react";

import { MonthLayer } from "@/components/swipe/MonthView";
import { LOCALE, useLang, useT } from "@/i18n/lang";
import { capitalize } from "@/lib/format";
import type { GridItem } from "@/lib/monthGrid";
import { startOfMonth } from "@/lib/zone";
import { colorOf, TZ } from "./demo";
import { HEADER_PILL_TOP, HEADER_PX } from "./geometry";

/**
 * The home page's glass capsules with nothing behind the glass to blur: a
 * backdrop filter redrawn on every frame of a moving phone is the one thing
 * here that would cost a real one its smoothness.
 */
const NO_BLUR: CSSProperties = { backdropFilter: "none", WebkitBackdropFilter: "none" };

/**
 * The phone's screen (#228): the home page as it is, simplified. The real
 * month (`MonthLayer`, so it follows any change to the calendar), under its
 * two capsules and over the three buttons along the bottom. Sizes in px, not
 * rem: this is a picture of a phone, not text to read at the iPhone's size.
 */
const PhoneHome = memo(function PhoneHome({
  month,
  items,
  pressed,
  shine,
  scroll = 0,
  dim = false,
  badge = false,
}: {
  month: number;
  items: GridItem[];
  /** The calendars pressed into one: a wave through the weeks, from the middle out. */
  pressed: boolean;
  /** The days free for everyone, lit up once they are found. */
  shine: ReadonlySet<number> | null;
  /** How far the month has scrolled up, as dates are lifted out of it. */
  scroll?: number;
  /** Faded back behind the list of dates. */
  dim?: boolean;
  /** A vote waiting on the Aftaler button. */
  badge?: boolean;
}) {
  const t = useT();
  const { lang } = useLang();
  const name = capitalize(
    new Date(month).toLocaleDateString(LOCALE[lang], { month: "long", timeZone: TZ }),
  );
  const heading = useMemo(
    (): ReactNode => (
      <div className="flex flex-col justify-end" style={{ height: HEADER_PX }}>
        <div className="px-3 text-[32px] font-bold leading-[38px] tracking-tight text-foreground">
          {name}
        </div>
        <div className="mt-2 grid grid-cols-7 pb-1 text-center text-[12px] font-medium">
          {[1, 2, 3, 4, 5, 6, 0].map((dow) => (
            <span key={dow} className={dow === 0 || dow === 6 ? "text-muted-foreground" : ""}>
              {t.weekdaysShort[dow].charAt(0)}
            </span>
          ))}
        </div>
      </div>
    ),
    [name, t],
  );
  const wrapRow = useCallback(
    (w: number, count: number, row: ReactNode) => (
      <motion.div
        key={w}
        animate={pressed ? { y: [0, 7, 0] } : undefined}
        transition={{ duration: 0.5, delay: Math.abs(w - (count - 1) / 2) * 0.09, ease: "easeOut" }}
      >
        {row}
      </motion.div>
    ),
    [pressed],
  );
  const next = useMemo(() => startOfMonth(month, TZ, 1), [month]);
  return (
    <>
      <motion.div
        className="absolute inset-x-0 top-0"
        initial={false}
        animate={{ y: -scroll, opacity: dim ? 0.3 : 1 }}
        transition={{ duration: 0.45, ease: "easeInOut" }}
      >
        <MonthLayer
          month={month}
          items={items}
          colorOf={colorOf}
          lanes={3}
          heading={heading}
          wrapRow={wrapRow}
        />
        {/* The next month under it, to scroll up into view. */}
        <MonthLayer month={next} items={[]} colorOf={colorOf} lanes={3} />
        {/* The free days over it, so they can fade up instead of switching on. */}
        <motion.div
          className="absolute inset-x-0 top-0"
          initial={false}
          animate={{ opacity: shine ? 1 : 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <MonthLayer
            month={month}
            items={[]}
            colorOf={colorOf}
            lanes={3}
            shine={shine ?? undefined}
            heading={<div className="invisible">{heading}</div>}
          />
        </motion.div>
      </motion.div>
      {/* The real capsules blur what passes under them; these fade it out instead. */}
      <div className="absolute inset-x-0 top-0 h-[104px] bg-gradient-to-b from-background from-80% to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-[92px] bg-gradient-to-t from-background from-70% to-transparent" />
      {/* Where the home page's own capsules sit. */}
      <div
        className="absolute inset-x-4 flex items-start justify-between"
        style={{ top: HEADER_PILL_TOP }}
      >
        <span
          className="glass-pill flex h-10 items-center gap-1.5 rounded-full pl-3.5 pr-4 text-[17px] text-primary"
          style={NO_BLUR}
        >
          <Layers className="h-5 w-5" />
          {t.calendarView.calendarsButton}
        </span>
        <span
          className="glass-pill flex h-10 items-center gap-3 rounded-full px-4 text-[17px] text-primary"
          style={NO_BLUR}
        >
          <Plus className="h-5 w-5" />
          <span className="h-5 w-px bg-primary/30" />
          {t.calendarView.today}
        </span>
      </div>
      <div className="absolute inset-x-4 bottom-5 flex items-center gap-3">
        <span
          className="glass-pill relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-primary"
          style={NO_BLUR}
        >
          <CalendarCheck className="h-6 w-6" />
          {badge && (
            <motion.span
              className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-cta px-1 text-[11px] font-semibold leading-none text-white"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 18 }}
            >
              1
            </motion.span>
          )}
        </span>
        <span
          className="glass-pill flex h-12 flex-1 items-center justify-center gap-2 rounded-full text-[17px] font-semibold text-primary"
          style={NO_BLUR}
        >
          <CalendarSearch className="h-5 w-5" />
          {t.planFromCalendar.button}
        </span>
        <span
          className="glass-pill flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-primary"
          style={NO_BLUR}
        >
          <User className="h-6 w-6" />
        </span>
      </div>
    </>
  );
});

export default PhoneHome;
