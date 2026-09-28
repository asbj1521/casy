import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CalendarPlus, Check, Download, Loader2, XCircle } from "lucide-react";

import { calendarStatusQuery } from "@/api/calendarStatus";
import {
  addToMyCalendar,
  eventCalendarFile,
  eventsQueryKey,
  type SuggestedEvent,
} from "@/api/events";
import { primaryCalendarQuery, updatePrimaryCalendar } from "@/api/primaryCalendar";
import { useAuth } from "@/context/auth";
import { useT } from "@/i18n/lang";
import { primaryName, primaryOptions } from "@/lib/primaryCalendar";

/** Hand the browser a file to save (or, on a phone, to open in Calendar). */
function saveFile(filename: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Some browsers read the file after the click returns.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * "Add to my calendar" on a scheduled event.
 *
 * With a primary calendar, Casy puts the event straight into it. Without one
 * but with a calendar Casy may write to, the button first asks which one
 * (that choice becomes the primary calendar). With none at all, it downloads
 * the event as a calendar file instead, which any calendar app can open.
 * If the last sync found the entry deleted from the calendar by hand, the
 * card says so and the button adds it again.
 */
export default function AddToCalendar({ event }: { event: SuggestedEvent }) {
  const t = useT();
  const words = t.addToCalendar;
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: primary } = useQuery(primaryCalendarQuery(user.id));
  const { data: connections } = useQuery(calendarStatusQuery(user.id));
  const [choosing, setChoosing] = useState(false);
  const [chosen, setChosen] = useState("");

  const options = primaryOptions(connections ?? [], null);
  const writableIds = options.flatMap((g) => g.calendars.map((c) => c.id));
  const primaryLabel = primaryName(connections ?? [], primary?.calendarId ?? null);

  const add = useMutation({
    mutationFn: async (calendarId: string | null) => {
      // A first choice from here becomes the primary calendar.
      if (calendarId) await updatePrimaryCalendar(queryClient, user.id, { calendarId });
      return await addToMyCalendar(event.id);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(eventsQueryKey(user.id), data.events);
      setChoosing(false);
    },
    // A failure still changed something (the event is now waiting to be
    // added), so the list is fetched again to show it.
    onError: () => void queryClient.invalidateQueries({ queryKey: eventsQueryKey(user.id) }),
  });
  const download = useMutation({
    mutationFn: () => eventCalendarFile(event.id),
    onSuccess: ({ filename, ics }) => saveFile(filename, ics, "text/calendar;charset=utf-8"),
  });

  const error =
    (add.error instanceof Error && add.error.message) ||
    (download.error instanceof Error && download.error.message) ||
    null;

  const downloadLink = (
    <button
      type="button"
      onClick={() => download.mutate()}
      disabled={download.isPending}
      className="flex items-center gap-1.5 text-sm font-medium text-emerald-800 underline underline-offset-2 transition hover:text-emerald-950 disabled:opacity-60"
    >
      {download.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
      {words.downloadInstead}
    </button>
  );

  let body: ReactNode;
  if (event.myCalendar?.state === "added") {
    body = (
      <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-800">
        <Check className="h-4 w-4 shrink-0" />
        {primaryLabel ? words.added(primaryLabel) : words.addedFallback}
      </p>
    );
  } else if (event.myCalendar?.state === "adding" && !add.isPending) {
    body = (
      <div className="text-sm text-emerald-900">
        <p>{event.myCalendar.error ? words.notYet : words.adding}</p>
        <button
          type="button"
          onClick={() => add.mutate(null)}
          className="mt-1 font-medium underline underline-offset-2 transition hover:text-emerald-950"
        >
          {words.tryAgain}
        </button>
      </div>
    );
  } else if (choosing) {
    body = (
      <div className="rounded-xl border border-emerald-200 bg-background p-3">
        <p className="text-sm font-medium text-foreground">{words.chooseTitle}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{words.chooseHelp}</p>
        <select
          value={chosen}
          onChange={(e) => setChosen(e.target.value)}
          aria-label={words.chooseTitle}
          className="mt-2 w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">{t.primaryCalendar.choose}</option>
          {options.map((group) => (
            <optgroup key={group.account} label={group.account}>
              {group.calendars.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => add.mutate(chosen)}
            disabled={!chosen || add.isPending}
            className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          >
            {add.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {words.useAndAdd}
          </button>
          <button
            type="button"
            onClick={() => setChoosing(false)}
            disabled={add.isPending}
            className="text-sm text-muted-foreground transition hover:text-foreground"
          >
            {t.common.cancel}
          </button>
        </div>
        <div className="mt-3 border-t pt-3">{downloadLink}</div>
      </div>
    );
  } else {
    const writesDirectly = !!primary;
    const canChoose = !primary && writableIds.length > 0;
    const gone = event.myCalendar?.state === "gone";
    body = (
      <div>
        {gone && (
          <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-amber-800">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {words.gone}
          </p>
        )}
        <button
          type="button"
          onClick={() => {
            add.reset();
            download.reset();
            if (writesDirectly) add.mutate(null);
            else if (canChoose) {
              setChosen(writableIds.length === 1 ? writableIds[0] : "");
              setChoosing(true);
            } else download.mutate();
          }}
          disabled={add.isPending || download.isPending}
          className="flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
        >
          {add.isPending || download.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CalendarPlus className="h-4 w-4" />
          )}
          {gone ? words.addAgain : words.button}
        </button>
        <p className="mt-1 text-xs text-emerald-900/80">
          {writesDirectly
            ? primaryLabel
              ? words.goesInto(primaryLabel)
              : words.goesIntoFallback
            : canChoose
              ? words.willAsk
              : words.asFile}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-3">
      {body}
      {error && (
        <p className="mt-2 flex items-start gap-2 text-sm text-red-700">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
