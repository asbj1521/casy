import { useState } from "react";
import { Check, Loader2, LogOut } from "lucide-react";

import { answerDate, chooseDate, type EventResponse } from "@/api/events";
import EventImpactDetails from "@/components/myEvents/EventImpactDetails";
import { ExitConfirm } from "@/components/myEvents/parts";
import DateTile from "@/components/myEvents/phone/DateTile";
import EventScreen from "@/components/myEvents/phone/EventScreen";
import PeopleRow from "@/components/myEvents/phone/PeopleRow";
import PlaceNote from "@/components/myEvents/PlaceNote";
import YourAnswer from "@/components/myEvents/YourAnswer";
import ReportEventButton from "@/components/safety/ReportEventButton";
import FlowButton from "@/components/ui/FlowButton";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import Notice from "@/components/ui/Notice";
import { useEventChange } from "@/hooks/useEventChange";
import { useLang, useT } from "@/i18n/lang";
import { formatEventDate, formatLongDate, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  bestPick,
  leader,
  stillToAnswer,
  tally,
  upcomingDates,
  voteStage,
  type VoteEvent,
} from "@/lib/vote";

/**
 * A vote's screen in a phone's Aftaler once you have answered (#177): its
 * dates as a stack, everyone's face (greyed until they have answered every
 * date), and each date as a row with a bar filling as people say they can,
 * the date ahead ticked in orange (only once half the group has answered;
 * before that every date is as good as the next), your own answer at its
 * end, changed with a tap. Only when no date can win does the suggester
 * choose, with "Vælg" on each. When it is decided by is the dates'
 * footnote. Its main action answers again over the day view.
 */
export default function VoteScreen({
  event,
  onAnswer,
}: {
  event: VoteEvent;
  onAnswer: () => void;
}) {
  const t = useT();
  const { lang } = useLang();
  const [exiting, setExiting] = useState(false);
  const choose = useEventChange((dateId: string) => chooseDate(event.id, dateId));
  const answer = useEventChange((v: { dateId: string; response: EventResponse }) =>
    answerDate(event.id, v.dateId, v.response),
  );
  const you = event.invitees.find((i) => i.isYou)?.profileId;
  const stage = voteStage(event);
  const dates = upcomingDates(event);
  const missing = stillToAnswer(event);
  const total = event.invitees.length;
  const halfIn = (total - missing.length) * 2 >= total;
  const mustChoose = stage === "choose";
  const canChoose = mustChoose && event.createdBy.isYou;
  const marked = mustChoose ? bestPick(event) : halfIn ? leader(event) : null;
  const first = dates[0] ? Date.parse(dates[0].start) : null;

  return (
    <EventScreen action={<FlowButton onClick={onAnswer}>{t.events.editAnswers}</FlowButton>}>
      <div className="mt-2 flex items-center gap-4">
        <span className="pr-2 pt-2">
          <DateTile start={first} more={Math.max(0, dates.length - 1)} size="hero" />
        </span>
        <div className="min-w-0">
          <p className="text-[17px] font-semibold text-foreground">
            {t.events.dateCount(dates.length)}
          </p>
          <p className="truncate text-[13px] text-muted-foreground">{event.group.name}</p>
        </div>
      </div>

      <div className="mt-5">
        <PeopleRow
          invitees={event.invitees}
          suggesterId={event.createdBy.id}
          standing={(p) =>
            dates.every((d) => d.answers[p.profileId] !== undefined) ? "accepted" : "waiting"
          }
          optional={event.settings.people?.optional}
        />
      </div>

      {mustChoose && (
        <p className="mt-4 text-[15px] font-medium text-foreground">
          {event.createdBy.isYou
            ? t.swipe.chooseNow
            : t.swipe.waitingForChoice(event.createdBy.name)}
        </p>
      )}

      <ListGroup
        footnote={
          !mustChoose && event.answerBy && missing.length > 0
            ? t.swipe.decidedBy(formatLongDate(event.answerBy, lang), formatTime(event.answerBy))
            : undefined
        }
      >
        {dates.map((d) => {
          const n = tally(d, event);
          const can = n.accepted + n.maybe;
          const isMarked = d.id === marked?.id;
          const label = formatEventDate(event.settings.kind, d, lang);
          // Shown as given while it saves.
          const yours =
            answer.isPending && answer.variables?.dateId === d.id
              ? answer.variables.response
              : you
                ? d.answers[you]
                : undefined;
          return (
            <li key={d.id} className="group/row flex items-center gap-3 pl-4">
              <Check
                aria-label={
                  isMarked ? (mustChoose ? t.events.bestPick : t.events.ahead) : undefined
                }
                aria-hidden={!isMarked}
                className={cn("h-5 w-5 shrink-0 text-primary", !isMarked && "invisible")}
              />
              <span className="flex min-h-[3.25rem] min-w-0 flex-1 items-center gap-3 border-t py-2.5 pr-4 group-first/row:border-t-0">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium text-foreground">
                    {label}
                  </span>
                  {/* How many can, as a bar filling up; the number for screen readers. */}
                  <span
                    role="img"
                    aria-label={`${t.events.canOnDate(can)}${n.declined > 0 ? `, ${t.events.cantOnDate(n.declined)}` : ""}`}
                    className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-secondary"
                  >
                    <span
                      className="bg-emerald-500 transition-[width]"
                      style={{ width: `${(can / Math.max(total, 1)) * 100}%` }}
                    />
                    <span
                      className="bg-rose-400 transition-[width]"
                      style={{ width: `${(n.declined / Math.max(total, 1)) * 100}%` }}
                    />
                  </span>
                </span>
                {you && (
                  <YourAnswer
                    yours={yours}
                    label={label}
                    disabled={answer.isPending}
                    onAnswer={(response) => answer.mutate({ dateId: d.id, response })}
                  />
                )}
                {canChoose && (
                  <button
                    type="button"
                    onClick={() => choose.mutate(d.id)}
                    disabled={choose.isPending}
                    className="flex shrink-0 items-center gap-1 text-[15px] font-semibold text-primary disabled:opacity-60"
                  >
                    {choose.isPending && choose.variables === d.id && (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    )}
                    {t.events.choose}
                  </button>
                )}
              </span>
            </li>
          );
        })}
      </ListGroup>
      {(choose.error ?? answer.error) && (
        <Notice tone="error" bare className="mt-2">
          {(choose.error ?? answer.error)?.message}
        </Notice>
      )}

      <PlaceNote event={event} className="mt-4" />
      <EventImpactDetails event={event} className="mt-4" />

      {exiting ? (
        <ExitConfirm event={event} onCancel={() => setExiting(false)} className="mt-6" />
      ) : (
        <ListGroup>
          <ReportEventButton event={event} as="row" />
          <ListRow
            icon={LogOut}
            label={event.createdBy.isYou ? t.events.cancelEvent : t.events.leaveEvent}
            tone="danger"
            onClick={() => setExiting(true)}
          />
        </ListGroup>
      )}
    </EventScreen>
  );
}
