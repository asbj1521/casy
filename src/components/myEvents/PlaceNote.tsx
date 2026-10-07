import { useState } from "react";
import { MapPin, Pencil, StickyNote } from "lucide-react";

import { editEventDetails, type SuggestedEvent } from "@/api/events";
import { useEventChange } from "@/hooks/useEventChange";
import { useT } from "@/i18n/lang";
import { MAX_NOTE_LENGTH, MAX_PLACE_LENGTH } from "@/lib/scheduler";
import { cn } from "@/lib/utils";

/**
 * An event's place and note (#84), shown as written, and for the person who
 * suggested it a way to add or change them. Everyone sees a change at once
 * (the event's updated_at moves the live pulse), and it reaches the
 * calendar entries Casy added. Nothing at all for an event with neither,
 * unless it is yours to fill in.
 */
export default function PlaceNote({
  event,
  row = false,
  readOnly = false,
  className,
}: {
  event: SuggestedEvent;
  /** On one line, wrapping if need be: where height is short (a computer's vote pane). */
  row?: boolean;
  /** Shown only, never edited here (the swipe card: editing is on My events). */
  readOnly?: boolean;
  className?: string;
}) {
  const t = useT();
  const words = t.eventDetails;
  const [editing, setEditing] = useState(false);
  const [place, setPlace] = useState("");
  const [note, setNote] = useState("");
  const save = useEventChange((details: { place: string; note: string }) =>
    editEventDetails(event.id, details),
  );
  const canEdit = !readOnly && event.createdBy.isYou && event.status !== "cancelled";
  const empty = !event.place && !event.note;
  if (empty && !canEdit) return null;

  function open() {
    setPlace(event.place ?? "");
    setNote(event.note ?? "");
    save.reset();
    setEditing(true);
  }

  if (editing) {
    const field =
      "h-10 w-full rounded-lg border bg-card px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20";
    return (
      <form
        className={cn("flex flex-col gap-2", className)}
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate({ place, note }, { onSuccess: () => setEditing(false) });
        }}
      >
        <input
          type="text"
          value={place}
          maxLength={MAX_PLACE_LENGTH}
          onChange={(e) => setPlace(e.target.value)}
          placeholder={t.settingsPanel.place.wherePlaceholder}
          aria-label={words.place}
          className={field}
        />
        <input
          type="text"
          value={note}
          maxLength={MAX_NOTE_LENGTH}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t.settingsPanel.place.notePlaceholder}
          aria-label={words.note}
          className={field}
        />
        {save.isError && <p className="text-sm text-red-700">{save.error.message}</p>}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={save.isPending}
            className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
          >
            {save.isPending ? words.saving : words.save}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition hover:bg-secondary"
          >
            {words.cancel}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div
      className={cn(
        "flex text-sm text-foreground",
        row ? "flex-row flex-wrap items-center gap-x-4 gap-y-1" : "flex-col gap-1",
        className,
      )}
    >
      {event.place && (
        <p className="flex items-start gap-1.5">
          <MapPin aria-label={words.place} className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span className="min-w-0 break-words">{event.place}</span>
        </p>
      )}
      {event.note && (
        <p className="flex items-start gap-1.5 text-muted-foreground">
          <StickyNote aria-label={words.note} className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="min-w-0 break-words">{event.note}</span>
        </p>
      )}
      {canEdit && (
        <button
          type="button"
          onClick={open}
          className="flex items-center gap-1.5 self-start text-sm font-medium text-primary hover:underline"
        >
          <Pencil className="h-3.5 w-3.5" />
          {empty ? words.add : words.edit}
        </button>
      )}
    </div>
  );
}
