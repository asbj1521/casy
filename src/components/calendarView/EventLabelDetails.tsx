import { useState } from "react";
import { ChevronDown, Sparkles } from "lucide-react";

import type { EventToLabel } from "@/api/eventLabels";
import Collapse from "@/components/ui/Collapse";
import Notice from "@/components/ui/Notice";
import { useRelabel } from "@/hooks/useEventLabels";
import { useT } from "@/i18n/lang";
import type { StoredLabel } from "@/lib/eventLabels";
import { cn } from "@/lib/utils";

/** The dot beside the importance: how much it matters at a glance. */
const IMPORTANCE_DOT: Record<StoredLabel["importance"], string> = {
  low: "bg-zinc-300",
  normal: "bg-zinc-400",
  high: "bg-orange-500",
  critical: "bg-red-500",
};

/**
 * What Casy's AI made of one of your events (#112), folded away under it in
 * the day's list, so it is there for whoever looks and out of the way for
 * everyone else: what it is and how much it matters, what to keep clear
 * before and after it, and the AI's one line on why. "Forkert?" opens a box
 * to say what is wrong; Casy labels the event again from that, and the new
 * label is kept as the person's own.
 */
export default function EventLabelDetails({
  label,
  calendarExternalId,
  event,
}: {
  label: StoredLabel;
  calendarExternalId: string;
  /** The event as it would be sent again, for a correction. */
  event: EventToLabel;
}) {
  const t = useT();
  const words = t.eventLabel;
  const [open, setOpen] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [note, setNote] = useState("");
  const relabel = useRelabel(calendarExternalId, event);

  const facts = [
    label.prepDays > 0 && words.prep(label.prepDays),
    ...label.avoidBefore.map((a) => words.avoid[a]),
    label.recoveryDays > 0 && words.recovery(label.recoveryDays),
    words.strain[label.strain],
    label.corrected ? words.corrected : words.confidence[label.confidence],
  ].filter((f): f is string => !!f);

  const send = () => {
    const text = note.trim();
    if (!text) return;
    relabel.mutate(
      { previous: label, note: text },
      {
        onSuccess: () => {
          setFixing(false);
          setNote("");
        },
      },
    );
  };

  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-1 text-xs font-medium text-muted-foreground"
      >
        <Sparkles className="h-3 w-3 text-amber-500" aria-hidden />
        {words.toggle}
        <span className={cn("h-1.5 w-1.5 rounded-full", IMPORTANCE_DOT[label.importance])} />
        <ChevronDown
          className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>
      <Collapse open={open}>
        <div className="mt-1.5 space-y-1.5 rounded-lg bg-muted/60 p-2.5 text-xs">
          <p className="font-medium text-foreground">
            {words.kinds[label.kind]} · {words.importance[label.importance]}
          </p>
          <ul className="flex flex-wrap gap-1">
            {facts.map((fact) => (
              <li key={fact} className="rounded-full bg-background px-2 py-0.5 text-foreground">
                {fact}
              </li>
            ))}
          </ul>
          {label.reason && <p className="italic text-muted-foreground">{label.reason}</p>}

          {fixing ? (
            <div className="space-y-1.5 pt-1">
              <label className="block text-muted-foreground" htmlFor="label-note">
                {words.wrongPrompt}
              </label>
              <textarea
                id="label-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={300}
                rows={2}
                placeholder={words.wrongPlaceholder}
                className="w-full resize-none rounded-md border bg-background px-2 py-1.5 text-base text-foreground md:text-sm"
              />
              {relabel.error && <Notice tone="error">{relabel.error.message}</Notice>}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setFixing(false);
                    relabel.reset();
                  }}
                  className="font-medium text-muted-foreground"
                >
                  {words.cancel}
                </button>
                <button
                  type="button"
                  onClick={send}
                  disabled={!note.trim() || relabel.isPending}
                  className="rounded-md bg-primary px-2.5 py-1 font-semibold text-primary-foreground disabled:opacity-50"
                >
                  {relabel.isPending ? words.sending : words.send}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2 pt-0.5">
              <span className="text-muted-foreground">{words.onlyYou}</span>
              <button
                type="button"
                onClick={() => setFixing(true)}
                className="shrink-0 font-medium text-primary"
              >
                {words.wrong}
              </button>
            </div>
          )}
        </div>
      </Collapse>
    </div>
  );
}
