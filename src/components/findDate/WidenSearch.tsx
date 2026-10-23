import { ChevronRight } from "lucide-react";

import { LOCALE, useLang, useT } from "@/i18n/lang";
import { capitalize, formatEventDate, nameList } from "@/lib/format";
import { periodText } from "@/lib/periodText";
import { settingsToSearch } from "@/lib/scheduler";
import { cn } from "@/lib/utils";
import type { WidenOption } from "@/lib/widen";

/**
 * When no date is found (#135): the ways to widen the search that would find
 * one, each with its first date, worked out before they are shown
 * (widenOptions). A tap applies it; nothing here is a guess. Glass on the
 * phone's pile, a card under the chart on a computer.
 */
export default function WidenSearch({
  options,
  onPick,
  glass = false,
}: {
  options: WidenOption[];
  onPick: (option: WidenOption) => void;
  glass?: boolean;
}) {
  const t = useT();
  const { lang } = useLang();
  const words = t.scheduler.widen;
  if (options.length === 0) return null;

  const label = ({ widening: w }: WidenOption): string => {
    switch (w.kind) {
      case "time":
        return words.time[w.part];
      case "days":
        return words.days;
      case "startDay":
        return words.startDay;
      case "shorter":
        return words.shorter(t.common.duration(w.minutes));
      case "fewerDays":
        return words.shorter(t.common.days(w.days));
      case "months":
        return words.months(periodText(w.period, LOCALE[lang], t));
      case "people":
        return words.people(w.atLeast, w.of);
    }
  };

  return (
    <section
      aria-label={words.title}
      className={cn(
        "flex flex-col gap-2 p-3",
        glass ? "glass rounded-[22px]" : "rounded-2xl border bg-card",
      )}
    >
      <p className="px-1 text-[15px] text-foreground">{words.title}</p>
      {options.map((option, i) => {
        const absent = option.first.absent ?? [];
        // Written as the kind it searches (a trip that may start any day is a holiday).
        const when = capitalize(
          formatEventDate(settingsToSearch(option.settings).kind, option.first.slot, lang),
        );
        return (
          <button
            key={i}
            type="button"
            onClick={() => onPick(option)}
            className="flex items-center justify-between gap-3 rounded-xl bg-background/60 px-3.5 py-3 text-left transition hover:bg-secondary"
          >
            <span className="min-w-0">
              <span className="block text-[15px] font-semibold text-foreground">
                {label(option)}
              </span>
              <span className="block text-sm text-muted-foreground">
                {absent.length > 0
                  ? `${when}, ${words.without(
                      nameList(
                        absent.map((p) => p.name),
                        lang,
                      ),
                    )}`
                  : when}
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        );
      })}
    </section>
  );
}
