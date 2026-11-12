import { useDeferredValue, useMemo } from "react";

import { TODAY } from "@/hooks/useDateSearch";
import type { Planning } from "@/hooks/usePlanning";
import { FIELD_LABEL } from "@/components/ui/field";
import { useT } from "@/i18n/lang";
import { SEARCH_WINDOW } from "@/lib/eventSearch";
import type { SchedulerSettings } from "@/lib/scheduler";
import { cn } from "@/lib/utils";
import { firstDateByCount, MIN_COUNT, requiredCount, type CountOption } from "@/lib/widen";
import { APP_TIME_ZONE } from "@/lib/zone";

import HowManySlider from "./HowManySlider";

/**
 * "Hvor mange skal kunne" (#259), in the Planlæg sheet itself under the
 * months, and under a genvej about to run: a number, not people picked one
 * by one, so nobody is quietly left out. A slider (HowManySlider), a step per
 * count from two to everyone Med, each with the first date it finds in the
 * months searched (#255, firstDateByCount), following the plan a beat behind
 * (deferred, as the search) so tapping the rows above never stutters.
 * Meetings only, and only with three or more Med; the same choice as Flere
 * detaljer's Deltagere.
 *
 * `search`: what a genvej would search, its times each as settings (#175),
 * instead of the plan on screen, since a genvej is loaded only as it runs.
 */
export default function HowManyRow({
  planning,
  search,
  className = "mt-4",
}: {
  planning: Planning;
  search?: SchedulerSettings[];
  className?: string;
}) {
  const t = useT();
  const words = t.planFromCalendar.howMany;
  const { activeGroup, participants, sched, peopleChoice, updatePeople } = planning;
  const list = useMemo(() => search ?? [sched], [search, sched]);
  const deferred = useDeferredValue(list);

  const members = useMemo(
    () => activeGroup?.members.map((m) => m.profileId) ?? [],
    [activeGroup?.members],
  );
  const of = requiredCount(members, peopleChoice);
  const count = peopleChoice.atLeast === null ? of : Math.min(peopleChoice.atLeast, of);
  const shown = !!activeGroup && !activeGroup.isExample && !list[0]?.multiDay && of > MIN_COUNT;

  const options = useMemo((): CountOption[] | null => {
    const [settings, ...others] = deferred;
    if (!shown || !participants || !settings) return null;
    return firstDateByCount(
      {
        participants,
        settings,
        members,
        choice: peopleChoice,
        today: TODAY,
        limit: SEARCH_WINDOW,
        timeZone: APP_TIME_ZONE,
      },
      others,
    );
  }, [shown, participants, deferred, members, peopleChoice]);

  if (!shown) return null;
  // While the group's calendars load: the steps, their dates still to come.
  const steps =
    options ??
    Array.from({ length: of - MIN_COUNT + 1 }, (_, i) => ({ count: of - i, of, first: null }));

  return (
    <section className={className}>
      <span className={FIELD_LABEL}>{words.label}</span>
      <div className={cn("rounded-2xl border bg-card")}>
        <HowManySlider
          options={steps}
          loading={!options}
          count={count}
          onPick={(n) => updatePeople({ ...peopleChoice, atLeast: n === of ? null : n })}
        />
      </div>
      {count < of && (
        <p className="mt-1.5 px-1 text-[0.75rem] text-muted-foreground">{words.footnote}</p>
      )}
    </section>
  );
}
