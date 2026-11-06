import { motion } from "framer-motion";

import Avatar from "@/components/ui/Avatar";
import { LOCALE, useLang, useT } from "@/i18n/lang";
import { buildMonthLayout } from "@/lib/calendarOverview";
import { formatHeadline } from "@/lib/format";
import { weekRowPx } from "@/lib/monthGrid";
import type { VoteEvent } from "@/lib/vote";
import { dayOf, localDate } from "@/lib/zone";
import { TZ } from "./demo";
import { HEADER_PX, SCREEN } from "./geometry";

/** Where a day's first bar lies on the phone's month. */
function barOn(day: number, month: number, lang: "da" | "en") {
  const { year, month: m } = localDate(month, TZ);
  const layout = buildMonthLayout(year, m, TZ, LOCALE[lang]);
  const key = dayOf(new Date(day).toISOString(), TZ);
  for (let w = 0; w < layout.weeks.length; w++) {
    const c = layout.weeks[w].findIndex((d) => d.key === key);
    if (c >= 0) {
      return {
        x: (c / 7) * SCREEN.width + 2,
        y: HEADER_PX + w * weekRowPx(3) + 41,
        width: SCREEN.width / 7 - 4,
      };
    }
  }
  return { x: 0, y: 0, width: 0 };
}

/**
 * A date agreed (#228), said as the app says it (AgreedCard): the month dimmed
 * behind a card with the event, its date, and everyone's faces. Then the date
 * flies out of the card into its day, as it does on the home page (`flying`).
 */
export default function AgreedMoment({
  event,
  day,
  month,
  flying,
}: {
  event: VoteEvent;
  /** The date's midnight. */
  day: number;
  month: number;
  flying: boolean;
}) {
  const t = useT();
  const { lang } = useLang();
  const date = event.candidates.find((d) => d.id === String(day)) ?? event.candidates[0];
  const headline = formatHeadline(event.settings, date, lang, t);
  const bar = barOn(day, month, lang);
  return (
    <div className="absolute inset-0">
      <motion.div
        className="absolute inset-0 bg-black/30"
        initial={{ opacity: 0 }}
        animate={{ opacity: flying ? 0 : 1 }}
        transition={{ duration: 0.3 }}
      />
      <motion.div
        className="absolute inset-x-5 rounded-[28px] border bg-card p-5 shadow-2xl shadow-black/30"
        style={{ top: 250 }}
        initial={{ scale: 0.85, opacity: 0, y: 24 }}
        animate={flying ? { scale: 0.92, opacity: 0, y: 0 } : { scale: 1, opacity: 1, y: 0 }}
        transition={flying ? { duration: 0.22 } : { type: "spring", stiffness: 380, damping: 26 }}
      >
        <p className="text-[12px] font-bold uppercase tracking-wide text-primary">
          {t.homeVote.everyone}
        </p>
        <p className="mt-1 text-[17px] font-semibold text-foreground">{event.title}</p>
        <p className="mt-1 text-[28px] font-extrabold leading-[1.1] tracking-tight text-foreground">
          {headline.lines.join(" ")}
        </p>
        <p className="mt-1 text-[17px] text-foreground">{headline.time}</p>
        <ul className="mt-3 flex -space-x-2">
          {event.invitees.map((p, i) => (
            <li key={p.profileId}>
              <Avatar name={p.name} index={i} size="md" className="ring-2 ring-card" />
            </li>
          ))}
        </ul>
      </motion.div>
      {flying && (
        <motion.div
          className="absolute left-0 top-0 h-[17px] truncate rounded-[4px] bg-primary px-1 text-[11px] font-semibold leading-[17px] text-white"
          style={{ width: bar.width }}
          initial={{ x: SCREEN.width / 2 - bar.width / 2, y: 340, scale: 3.4 }}
          animate={{ x: bar.x, y: bar.y, scale: 1 }}
          transition={{ duration: 0.55, ease: [0.45, 0, 0.2, 1] }}
        >
          {event.title}
        </motion.div>
      )}
    </div>
  );
}
