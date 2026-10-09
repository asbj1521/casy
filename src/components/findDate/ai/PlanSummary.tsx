import type { ReactNode } from "react";

import { LOCALE, useLang, useT } from "@/i18n/lang";
import type { PlanField } from "@/lib/aiPlan";
import { capitalize, nameList } from "@/lib/format";
import { periodText } from "@/lib/periodText";
import {
  describeDays,
  type EventExtras,
  type PeopleChoice,
  type SchedulerSettings,
} from "@/lib/scheduler";
import { summarizePeople } from "@/lib/schedulerFlow";

/** "fredag" / "Friday" for a day of week (0 = Sunday). */
function weekdayLong(dow: number, locale: string): string {
  // 21 June 2026 is a Sunday; the time zone doesn't matter at noon UTC.
  return new Date(Date.UTC(2026, 5, 21 + dow, 12)).toLocaleDateString(locale, {
    weekday: "long",
    timeZone: "UTC",
  });
}

/** "18:00" for minutes after midnight, wrapping past it (26 h is 02:00). */
function clock(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/**
 * What Casy picked up (#100), on a computer's AI tab: the event as settings,
 * in a few short lines, rather than the words it came from. Read from the
 * page's own state, so a change made by hand shows here too; what Casy
 * guessed is marked.
 */
export default function PlanSummary({
  name,
  settings,
  extras,
  members,
  choice,
  guessed,
}: {
  name: string;
  settings: SchedulerSettings;
  extras: EventExtras;
  members: { profileId: string; name: string }[];
  choice: PeopleChoice;
  guessed: readonly PlanField[];
}) {
  const t = useT();
  const { lang } = useLang();
  const locale = LOCALE[lang];
  const words = t.aiPlan;
  const meeting = !settings.multiDay;

  const rows: { label: string; value: ReactNode; guess?: boolean }[] = [];
  if (name.trim()) rows.push({ label: words.rows.name, value: name.trim() });
  rows.push({
    label: words.rows.kind,
    value: meeting
      ? words.kinds.meeting
      : settings.startDow === null
        ? words.kinds.holiday
        : words.kinds.trip,
    guess: guessed.includes("kind"),
  });
  if (meeting) {
    const start = settings.startHour * 60;
    rows.push({
      label: words.rows.time,
      value: settings.anyTime
        ? `${t.scheduler.anyTime}, ${t.common.duration(settings.durationMinutes)}`
        : `${t.scheduler.timeRange(clock(start), clock(start + settings.durationMinutes))} (${t.common.duration(settings.durationMinutes)})`,
      guess: guessed.includes("startHour") || guessed.includes("durationMinutes"),
    });
    const days = describeDays(settings.dows);
    rows.push({
      label: words.rows.days,
      value: capitalize(
        days.kind === "list"
          ? nameList(
              days.dows.map((d) => weekdayLong(d, locale)),
              lang,
            )
          : t.scheduler.dayList[days.kind],
      ),
      guess: guessed.includes("weekdays"),
    });
  } else {
    rows.push({
      label: words.rows.days,
      value:
        settings.startDow === null
          ? t.common.days(settings.days)
          : words.tripFrom(t.common.days(settings.days), weekdayLong(settings.startDow, locale)),
      guess: guessed.includes("days") || guessed.includes("startWeekday"),
    });
  }
  rows.push({
    label: words.rows.when,
    value: capitalize(periodText(settings.period, locale, t)),
    guess: guessed.includes("months"),
  });
  if (extras.place.trim()) rows.push({ label: words.rows.place, value: extras.place.trim() });
  if (extras.note.trim()) rows.push({ label: words.rows.note, value: extras.note.trim() });
  if (members.length > 0) {
    const people = summarizePeople(
      members.map((m) => m.profileId),
      choice,
      meeting,
    );
    const out = members.filter((m) => choice.states[m.profileId] === "out").map((m) => m.name);
    rows.push({
      label: words.rows.people,
      value:
        (people.everyone
          ? t.schedulerFlow.peopleAll(people.total)
          : t.schedulerFlow.peopleSome(people.required, people.optional) +
            (people.atLeast !== null ? t.schedulerFlow.peopleAtLeast(people.atLeast) : "")) +
        (out.length > 0 ? `, ${words.without(nameList(out, lang))}` : ""),
    });
  }

  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-2xl border bg-secondary/40 px-3.5 py-3 text-[15px]">
      {rows.map((row) => (
        <div key={row.label} className="contents">
          <dt className="text-muted-foreground">{row.label}</dt>
          <dd className="flex min-w-0 flex-wrap items-center gap-1.5 font-semibold text-foreground">
            <span className="min-w-0 break-words">{row.value}</span>
            {row.guess && (
              <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[11px] font-bold text-amber-800">
                {words.guessed}
              </span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
