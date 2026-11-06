import { memo, useCallback, useMemo, type CSSProperties, type ReactNode } from "react";
import { motion } from "framer-motion";
import { CalendarCheck, CalendarSearch, Layers, Plus, User } from "lucide-react";

import { MonthLayer } from "@/components/swipe/MonthView";
import { LOCALE, useLang, useT } from "@/i18n/lang";
import { capitalize } from "@/lib/format";
import type { GridItem } from "@/lib/monthGrid";
import { colorOf, TZ } from "./demo";
import { HEADER_PX } from "./geometry";

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
}: {
  month: number;
  items: GridItem[];
  /** The calendars pressed into one: a wave through the weeks, from the middle out. */
  pressed: boolean;
  /** The days free for everyone, lit up once they are found. */
  shine: ReadonlySet<number> | null;
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
  return (
    <>
      <MonthLayer
        month={month}
        items={items}
        colorOf={colorOf}
        lanes={3}
        heading={heading}
        wrapRow={wrapRow}
      />
      {/* The free days over it, so they can fade up instead of switching on. */}
      <motion.div
        className="absolute inset-x-0 top-0"
        initial={false}
        animate={{ opacity: shine ? 1 : 0, scale: shine ? 1 : 0.985 }}
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
      {/* Where the home page's own capsules sit. */}
      <div className="absolute inset-x-4 flex items-start justify-between" style={{ top: 58 }}>
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
          className="glass-pill flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-primary"
          style={NO_BLUR}
        >
          <CalendarCheck className="h-6 w-6" />
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
