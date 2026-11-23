/** autoCategorize.ts, for AutoCategorize.swift (#282: calendars sorted natively). */
import type { CalendarConnectionStatus } from "@/api/calendars";
import { accountKindsFor, phoneSourceIds, sampleTitles, uncategorised } from "@/lib/autoCategorize";
import type { PhoneEventWithDetails } from "@/lib/phoneEvents";

import { caseBook, type ParityCase } from "./cases";

const NOW = Date.UTC(2026, 9, 7, 8);
const HOUR = 3_600_000;
const TITLES = [
  "Forelæsning",
  "Vagt",
  "Padel",
  " Padel ",
  "Møde",
  "Eksamen",
  "",
  "Træning",
  "Fødselsdag",
];

export function autoCategorizeCases(): ParityCase[] {
  const { cases, add, int, pick, random } = caseBook(20261124);
  const flag = (odds: number) => random() < odds;
  const purposes = [null, "work", "school", "personal", "other"] as const;
  const sources = [null, "user", "ai"] as const;

  for (let i = 0; i < 50; i++) {
    const connections = Array.from({ length: int(1, 4) }, (_, n) => ({
      id: `conn-${n}`,
      status: pick(["connected", "pending", "error", "connected"]),
      calendar_sources: Array.from({ length: int(0, 4) }, (_, m) => ({
        id: `cal-${n}-${m}`,
        purpose: pick(purposes),
        purpose_source: pick(sources),
        external_id: flag(0.7) ? `EK-${n}-${m}` : flag(0.5) ? "" : null,
      })),
    })) as unknown as CalendarConnectionStatus[];
    add("uncategorised", { connections }, uncategorised(connections));
    const phone = pick(["conn-0", "conn-1", "conn-9"]);
    const ids = phoneSourceIds(connections, phone);
    add("phoneSourceIds", { connections, connectionId: phone }, Object.fromEntries(ids));

    const eventIds = [...ids.keys(), "EK-other"];
    const events: PhoneEventWithDetails[] = Array.from({ length: int(0, 40) }, () => {
      const base = {
        calendarId: pick(eventIds),
        free: false,
        cancelled: flag(0.1),
        declined: false,
        title: flag(0.9) ? pick(TITLES) : undefined,
      };
      if (flag(0.25)) {
        const startDay = pick(["2026-10-01", "2026-10-07", "2026-12-24", "2026-08-15"]);
        return { ...base, allDay: true, startDay, endDay: startDay };
      }
      const start = NOW + int(-60 * 24, 120 * 24) * HOUR;
      return { ...base, allDay: false, start, end: start + HOUR };
    });
    const wanted = [...ids.values()].filter(() => flag(0.7));
    add(
      "sampleTitles",
      { events, serverIdOf: Object.fromEntries(ids), wanted, now: NOW },
      sampleTitles(events, ids, new Set(wanted), NOW),
    );
    const info = [...ids.keys(), "EK-x"].map((id) => ({
      id,
      color: "1, 2, 3",
      accountKind: pick(["icloud", "google", "exchange", "local", "other"]),
    }));
    add(
      "accountKindsFor",
      { info, serverIdOf: Object.fromEntries(ids), pending: wanted },
      accountKindsFor(info, ids, new Set(wanted)),
    );
  }
  return cases;
}
