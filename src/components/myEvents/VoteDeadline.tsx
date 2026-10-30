import { useState } from "react";
import { Hourglass, Loader2 } from "lucide-react";

import { setVoteDeadline, settleVote } from "@/api/events";
import BottomSheet from "@/components/ui/BottomSheet";
import ConfirmPanel from "@/components/ui/ConfirmPanel";
import { ListGroup, ListPickRow, ListRow } from "@/components/ui/ListGroup";
import { useEventChange } from "@/hooks/useEventChange";
import { useLang, useT } from "@/i18n/lang";
import { formatLongDate, formatTime } from "@/lib/format";
import { ANSWER_DAY_VALUES } from "@/lib/scheduler";
import { cn } from "@/lib/utils";
import type { VoteEvent } from "@/lib/vote";

/**
 * A vote's deadline (#179). There is none unless the suggester gives it one:
 * when planning (`DeadlineSheet` in Planlæg, a select on a computer), or
 * later on the vote's screen, where the suggester can also settle it now
 * with the answers so far ("Afgør nu", asked first). Everyone else reads
 * when it is settled.
 */

/**
 * Ingen frist, or 1 to 7 days, as rows with a tick: `value` is the days
 * chosen, null for none, and undefined for a deadline already set (no row
 * ticked: it is a moment, not a number of days).
 */
export function DeadlineSheet({
  open,
  onClose,
  value,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  value: number | null | undefined;
  onPick: (days: number | null) => void;
}) {
  const t = useT();
  const words = t.voteDeadline;
  const pick = (days: number | null) => {
    onPick(days);
    onClose();
  };
  return (
    <BottomSheet open={open} onClose={onClose} title={words.label} doneLabel={t.schedulerFlow.done}>
      <ListGroup className="mt-0">
        <ListPickRow
          type="radio"
          name="vote-deadline"
          checked={value === null}
          onChange={() => pick(null)}
          label={words.none}
        />
        {ANSWER_DAY_VALUES.map((days) => (
          <ListPickRow
            key={days}
            type="radio"
            name="vote-deadline"
            checked={value === days}
            onChange={() => pick(days)}
            label={t.common.days(days)}
          />
        ))}
      </ListGroup>
    </BottomSheet>
  );
}

/** When a vote is settled, in words: its deadline, or once everyone has answered. */
function useDeadlineText(event: VoteEvent): string {
  const t = useT();
  const { lang } = useLang();
  return event.answerBy
    ? t.swipe.decidedBy(formatLongDate(event.answerBy, lang), formatTime(event.answerBy))
    : t.voteDeadline.untilAll;
}

/** When a vote is settled, as a line for everyone but the suggester. */
export function DeadlineText({ event, className }: { event: VoteEvent; className?: string }) {
  return <p className={className}>{useDeadlineText(event)}</p>;
}

/** The deadline's changes and settling now, with what goes wrong. */
function useDeadlineChanges(event: VoteEvent) {
  const deadline = useEventChange((days: number | null) => setVoteDeadline(event.id, days));
  const settle = useEventChange(() => settleVote(event.id));
  return { deadline, settle, error: (deadline.error ?? settle.error)?.message ?? null };
}

/**
 * The suggester's rows on a phone's vote screen: the deadline (none, or
 * when), opening the sheet, and "Afgør nu", asked first.
 */
export function PhoneVoteDeadline({ event }: { event: VoteEvent }) {
  const t = useT();
  const { lang } = useLang();
  const words = t.voteDeadline;
  const [picking, setPicking] = useState(false);
  const [asking, setAsking] = useState(false);
  const { deadline, settle, error } = useDeadlineChanges(event);
  const value = event.answerBy
    ? words.at(formatLongDate(event.answerBy, lang), formatTime(event.answerBy))
    : words.none;
  return (
    <>
      <ListGroup>
        <ListRow
          icon={Hourglass}
          label={words.label}
          value={deadline.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : value}
          chevron
          onClick={() => setPicking(true)}
        />
        {!asking && (
          <ListRow
            label={<span className="text-primary">{words.settleNow}</span>}
            onClick={() => setAsking(true)}
          />
        )}
      </ListGroup>
      {asking && (
        <ConfirmPanel
          tone="neutral"
          className="mt-3"
          message={words.settleAsk}
          confirmLabel={words.settleNow}
          busy={settle.isPending}
          onConfirm={() => settle.mutate(undefined, { onSuccess: () => setAsking(false) })}
          onCancel={() => setAsking(false)}
        />
      )}
      {error && <p className="mt-2 px-1 text-[13px] text-red-600">{error}</p>}
      <DeadlineSheet
        open={picking}
        onClose={() => setPicking(false)}
        value={event.answerBy ? undefined : null}
        onPick={(days) => deadline.mutate(days)}
      />
    </>
  );
}

/**
 * The same on a computer, as one line under how the vote stands: when it is
 * settled, a select to change that, and "Afgør nu".
 */
export function ComputerVoteDeadline({ event }: { event: VoteEvent }) {
  const t = useT();
  const words = t.voteDeadline;
  const text = useDeadlineText(event);
  const [asking, setAsking] = useState(false);
  const { deadline, settle, error } = useDeadlineChanges(event);
  const busy = deadline.isPending || settle.isPending;
  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
        <span>{text}</span>
        <label className="flex items-center gap-1.5">
          <span className="sr-only">{words.label}</span>
          <select
            value=""
            disabled={busy}
            onChange={(e) => {
              const v = e.target.value;
              if (v !== "") deadline.mutate(v === "none" ? null : Number(v));
            }}
            className="rounded-full border bg-background px-2 py-0.5 text-sm text-foreground"
          >
            <option value="">{words.label}</option>
            <option value="none">{words.none}</option>
            {ANSWER_DAY_VALUES.map((days) => (
              <option key={days} value={days}>
                {t.common.days(days)}
              </option>
            ))}
          </select>
        </label>
        {!asking && (
          <button
            type="button"
            disabled={busy}
            onClick={() => setAsking(true)}
            className={cn("font-medium text-primary transition hover:underline")}
          >
            {words.settleNow}
          </button>
        )}
      </div>
      {asking && (
        <ConfirmPanel
          tone="neutral"
          className="mt-3"
          message={words.settleAsk}
          confirmLabel={words.settleNow}
          busy={settle.isPending}
          onConfirm={() => settle.mutate(undefined, { onSuccess: () => setAsking(false) })}
          onCancel={() => setAsking(false)}
        />
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
