import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { calendarsChanged, updateCalendar } from "@/api/calendars";
import { HOLIDAY_CALENDAR_ID, type OverviewData } from "@/lib/calendarOverview";
import { readStored, writeStored } from "@/lib/storage";

/**
 * Whether the built-in holiday calendar is ticked. It has no row in the
 * database and never counts when scheduling (a holiday isn't busy time), so
 * its tick is only a view setting, remembered in this browser.
 */
const HOLIDAYS_HIDDEN_KEY = "casy-hide-holidays";

/**
 * Ticking and unticking calendars on My calendar, on a computer and a phone
 * alike: whether each counts at all, saved on the server. The tick moves at
 * once (the cached answer is patched before the call) and moves back if
 * saving fails. The holiday calendar's tick stays in this browser.
 */
export function useCalendarVisibility() {
  const queryClient = useQueryClient();
  const [holidaysHidden, setHolidaysHidden] = useState(
    () => readStored(HOLIDAYS_HIDDEN_KEY) === "1",
  );

  const setIncluded = useMutation({
    mutationFn: async ({ ids, included }: { ids: string[]; included: boolean }) => {
      await Promise.all(ids.map((calendarId) => updateCalendar(calendarId, { included })));
    },
    onMutate: async ({ ids, included }) => {
      // Both this page and the scheduling page's copy of your calendars.
      const key = { queryKey: ["calendar-busy"] };
      await queryClient.cancelQueries(key);
      const previous = queryClient.getQueriesData<OverviewData>(key);
      queryClient.setQueriesData<OverviewData>(key, (old) =>
        old
          ? {
              ...old,
              calendars: old.calendars.map((c) => (ids.includes(c.id) ? { ...c, included } : c)),
            }
          : old,
      );
      return { previous };
    },
    onError: (_err, _v, context) => {
      for (const [queryKey, old] of context?.previous ?? [])
        queryClient.setQueryData(queryKey, old);
    },
    onSettled: () => calendarsChanged(queryClient),
  });

  // Tick or untick any number of calendars at once: one, or a whole brand
  // group. Holidays stay in this browser; everything else is saved.
  const setCalendarsVisible = (ids: string[], visible: boolean) => {
    if (ids.includes(HOLIDAY_CALENDAR_ID)) {
      setHolidaysHidden(!visible);
      writeStored(HOLIDAYS_HIDDEN_KEY, visible ? null : "1");
    }
    const connected = ids.filter((id) => id !== HOLIDAY_CALENDAR_ID);
    if (connected.length > 0) setIncluded.mutate({ ids: connected, included: visible });
  };

  return { holidaysHidden, setCalendarsVisible, error: setIncluded.error?.message ?? null };
}
