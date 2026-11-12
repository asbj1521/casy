import { useState } from "react";
import { LayoutGroup, motion, useReducedMotion } from "framer-motion";
import { Check, ChevronDown, Loader2, LogOut } from "lucide-react";

import { answerDate, chooseDate, type EventResponse } from "@/api/events";
import EventImpactDetails from "@/components/myEvents/EventImpactDetails";
import { ExitConfirm } from "@/components/myEvents/parts";
import Countdown from "@/components/myEvents/phone/Countdown";
import DateTile from "@/components/myEvents/phone/DateTile";
import { DateFaces, DateVotersOpen } from "@/components/myEvents/phone/DateVoters";
import EventScreen from "@/components/myEvents/phone/EventScreen";
import PeopleRow from "@/components/myEvents/phone/PeopleRow";
import RemindButton from "@/components/myEvents/phone/RemindButton";
import SearchAgain from "@/components/myEvents/phone/SearchAgain";
import PlaceNote from "@/components/myEvents/PlaceNote";
import { PhoneVoteDeadline } from "@/components/myEvents/VoteDeadline";
import YourAnswer from "@/components/myEvents/YourAnswer";
import ReportEventButton from "@/components/safety/ReportEventButton";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import Notice from "@/components/ui/Notice";
import { useEventChange } from "@/hooks/useEventChange";
import { useLang, useT } from "@/i18n/lang";
import { eventTitle } from "@/i18n/eventTitle";
import { formatDate, formatEventDate, formatTime } from "@/lib/format";
import { isNativeApp } from "@/lib/nativeApp";
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
 * date; #258: those still to answer apart at the end), and each date as a
 * row with the faces of those who can (paler for "rather not"), the most
 * yeses at the top, a tap on it opening who said what (DateVoters),
 * so the leading date is always first, ticked in orange once half the
 * group has answered (before that every date is as good as the next). Your
 * own answer is at each row's end, changed with a tap, the rows gliding to
 * their new places. Only when no date can win does the suggester choose,
 * with "Vælg" on each. Under the dates, the time left until it is settled
 * ticks down (Countdown), or it says it waits for everyone (#179), with
 * Casy's read on the right; the place and note come next, then the
 * suggester's deadline and "Afgør nu", and cancelling or leaving stays along
 * the bottom. In the app, an open vote can be searched again under its dates,
 * with any of the group it leaves out (SearchAgain, #240).
 */
export default function VoteScreen({ event }: { event: VoteEvent }) {
  const t = useT();
  const { lang } = useLang();
  const reduce = useReducedMotion();
  const [exiting, setExiting] = useState(false);
  // The date opened to who said what (#258), one at a time.
  const [openId, setOpenId] = useState<string | null>(null);
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
  // A meeting's time, said once at the top when every date shares it; the
  // rows then say only the day (#258). Dates at different times keep theirs.
  const clock = (d: { start: string; end: string }) =>
    `${formatTime(d.start)}-${formatTime(d.end)}`;
  const sharedTime =
    event.settings.kind === "single" &&
    dates.length > 0 &&
    dates.every((d) => clock(d) === clock(dates[0]))
      ? clock(dates[0])
      : null;
  const dateLabel = (d: { start: string; end: string }) =>
    sharedTime ? formatDate(d.start, lang) : formatEventDate(event.settings.kind, d, lang);
  // Most yeses first, then most "rather not", then soonest.
  const ranked = dates
    .map((d) => ({ date: d, n: tally(d, event) }))
    .sort((a, b) => b.n.accepted - a.n.accepted || b.n.maybe - a.n.maybe);

  return (
    <EventScreen>
      <div className="mt-2 flex items-center gap-4">
        <span className="pr-2 pt-2">
          <DateTile start={first} more={Math.max(0, dates.length - 1)} size="hero" />
        </span>
        {/* The group is the sheet's title; here what it is, and when. */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[1.0625rem] font-semibold text-foreground">
            {eventTitle(event.title, t)}
          </p>
          {sharedTime && (
            <p className="whitespace-nowrap text-[0.9375rem] tabular-nums text-muted-foreground">
              {sharedTime}
            </p>
          )}
        </div>
        {/* The suggester nudges those the vote waits for, once a day. */}
        {!mustChoose && (
          <RemindButton event={event} waiting={missing.length} className="shrink-0" />
        )}
      </div>

      <div className="mt-5">
        <PeopleRow
          invitees={event.invitees}
          suggesterId={event.createdBy.id}
          standing={(p) =>
            dates.every((d) => d.answers[p.profileId] !== undefined) ? "accepted" : "waiting"
          }
          optional={event.settings.people?.optional}
          split
        />
      </div>

      {mustChoose && (
        <p className="mt-4 text-[0.9375rem] font-medium text-foreground">
          {event.createdBy.isYou
            ? t.swipe.chooseNow
            : t.swipe.waitingForChoice(event.createdBy.name)}
        </p>
      )}

      <LayoutGroup>
        <ListGroup>
          {ranked.map(({ date: d, n }) => {
            const isMarked = d.id === marked?.id;
            const isOpen = d.id === openId;
            const label = dateLabel(d);
            // Shown as given while it saves.
            const yours =
              answer.isPending && answer.variables?.dateId === d.id
                ? answer.variables.response
                : you
                  ? d.answers[you]
                  : undefined;
            return (
              <motion.li
                key={d.id}
                layout={!reduce}
                transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
                className="group/row relative bg-card pl-4"
              >
                <span className="flex min-h-[3.25rem] min-w-0 items-center gap-3 border-t py-2.5 pr-4 group-first/row:border-t-0">
                  {/* The date and its faces open to who said what (#258). */}
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpenId(isOpen ? null : d.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="flex items-center gap-1 text-[0.9375rem] font-medium text-foreground">
                      {isMarked && (
                        <Check
                          aria-label={mustChoose ? t.events.bestPick : t.events.ahead}
                          className="h-4 w-4 shrink-0 text-primary"
                          strokeWidth={3}
                        />
                      )}
                      <span className="truncate">{label}</span>
                      <ChevronDown
                        aria-hidden
                        className={cn(
                          "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                          isOpen && "rotate-180",
                        )}
                      />
                    </span>
                    <DateFaces
                      date={d}
                      invitees={event.invitees}
                      open={isOpen}
                      label={`${t.events.canOnDate(n.accepted + n.maybe)}${n.declined > 0 ? `, ${t.events.cantOnDate(n.declined)}` : ""}`}
                    />
                  </button>
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
                      className="flex shrink-0 items-center gap-1 text-[0.9375rem] font-semibold text-primary disabled:opacity-60"
                    >
                      {choose.isPending && choose.variables === d.id && (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      )}
                      {t.events.choose}
                    </button>
                  )}
                </span>
                <DateVotersOpen date={d} invitees={event.invitees} open={isOpen} />
              </motion.li>
            );
          })}
        </ListGroup>
      </LayoutGroup>
      {(choose.error ?? answer.error) && (
        <Notice tone="error" bare className="mt-2">
          {(choose.error ?? answer.error)?.message}
        </Notice>
      )}

      {/* The suggester's deadline, and settling now (#179), right under the dates. */}
      {event.createdBy.isYou && !mustChoose && event.status === "pending" && (
        <PhoneVoteDeadline event={event} />
      )}

      {/* Then the time left on the left, Casy's read on the right. */}
      <EventImpactDetails
        event={event}
        className="mt-2 px-1"
        beside={
          !mustChoose && event.answerBy && missing.length > 0 ? (
            <Countdown until={event.answerBy} />
          ) : !mustChoose && missing.length > 0 ? (
            // No deadline (#179): settled once everyone has answered.
            <span className="text-[0.8125rem] text-muted-foreground">
              {t.voteDeadline.untilAll}
            </span>
          ) : (
            <span />
          )
        }
      />

      {/* A place or note written when it was planned, shown only. */}
      <PlaceNote event={event} readOnly className="mt-6" />

      {/* Searching again, cancelling or leaving: last, scrolled to, never pinned
          (nothing invites anyone to call a plan off). */}
      <div className="mt-8">
        {exiting ? (
          <ExitConfirm event={event} onCancel={() => setExiting(false)} />
        ) : (
          <ListGroup className="mt-0">
            {isNativeApp && event.status === "pending" && <SearchAgain event={event} />}
            <ReportEventButton event={event} as="row" />
            <ListRow
              icon={LogOut}
              label={event.createdBy.isYou ? t.events.cancelEvent : t.events.leaveEvent}
              tone="danger"
              onClick={() => setExiting(true)}
            />
          </ListGroup>
        )}
      </div>
    </EventScreen>
  );
}
