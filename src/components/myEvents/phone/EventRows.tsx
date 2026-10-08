import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { CalendarCheck, CalendarX, ChevronDown, ChevronRight, Clock } from "lucide-react";

import Collapse from "@/components/ui/Collapse";
import { useDecidingRefresh } from "@/hooks/useDecidingRefresh";
import { eventTitle } from "@/i18n/eventTitle";
import { useLang, useT } from "@/i18n/lang";
import { formatEventDate, nameList } from "@/lib/format";
import { waitingOn, type StagedEvent } from "@/lib/myEvents";
import { cn } from "@/lib/utils";
import { stillToAnswer, upcomingDates, voteStage, type VoteEvent } from "@/lib/vote";

import DatedSummary from "./DatedSummary";
import VoteSummary from "./VoteSummary";

/**
 * A phone's My events (#103): every event as one compact row, newest first,
 * coloured by where it stands: yellow with a clock while it waits for
 * answers, green once everyone agreed, grey once it is over (at the bottom,
 * and gone a week later, phoneEventList). A tap opens a row to its summary,
 * one at a time; a vote waiting for your answers goes straight to swiping.
 */
export default function EventRows({
  live,
  past,
  pastTitle,
}: {
  live: StagedEvent[];
  past: StagedEvent[];
  pastTitle: string;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const toggle = (id: string) => setOpenId((open) => (open === id ? null : id));

  return (
    <>
      <ul className="mt-4 flex flex-col gap-2">
        {live.map((staged) => (
          <EventRow
            key={staged.event.id}
            staged={staged}
            open={openId === staged.event.id}
            onToggle={() => toggle(staged.event.id)}
          />
        ))}
      </ul>
      {past.length > 0 && (
        <section className="mt-8">
          <h2 className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {pastTitle}
          </h2>
          <ul className="mt-2 flex flex-col gap-2">
            {past.map((staged) => (
              <EventRow key={staged.event.id} staged={staged} open={false} onToggle={() => {}} />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

const TONES = {
  pending: {
    row: "border-amber-200 bg-amber-50/70",
    icon: "bg-amber-100 text-amber-700",
    Icon: Clock,
  },
  agreed: {
    row: "border-emerald-200 bg-emerald-50/70",
    icon: "bg-emerald-100 text-emerald-700",
    Icon: CalendarCheck,
  },
  past: {
    row: "border-border bg-card/60",
    icon: "bg-secondary text-muted-foreground",
    Icon: CalendarX,
  },
};

function EventRow({
  staged,
  open,
  onToggle,
}: {
  staged: StagedEvent;
  open: boolean;
  onToggle: () => void;
}) {
  const t = useT();
  const { stage, event } = staged;
  const tone = TONES[stage === "scheduled" ? "agreed" : stage === "closed" ? "past" : "pending"];
  const yourTurn = stage === "toSwipe";
  const choosing =
    stage === "voting" && voteStage(event as VoteEvent) === "choose" && event.createdBy.isYou;

  const head = (
    <>
      <span
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
          tone.icon,
        )}
      >
        <tone.Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block truncate text-[15px] font-semibold",
            stage === "closed" ? "text-muted-foreground" : "text-foreground",
          )}
        >
          {eventTitle(event.title, t)}
        </span>
        <span className="block truncate text-[13px] text-muted-foreground">
          {event.group.name} · <StatusLine staged={staged} />
        </span>
      </span>
      {yourTurn || choosing ? (
        <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
          {yourTurn ? t.events.answerNow : t.events.choose}
          {yourTurn && <ChevronRight className="-mr-1 h-3.5 w-3.5" />}
        </span>
      ) : (
        stage !== "closed" && (
          <ChevronDown
            className={cn(
              "h-5 w-5 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          />
        )
      )}
    </>
  );
  const rowClass = "flex w-full items-center gap-3 px-3 py-2.5 text-left";

  return (
    <li className={cn("overflow-hidden rounded-2xl border", tone.row)}>
      {(staged.stage === "voting" || staged.stage === "toSwipe") && (
        <DecidingRefresh event={staged.event} />
      )}
      {yourTurn ? (
        <Link to={`/events/${event.id}/dates`} className={rowClass}>
          {head}
        </Link>
      ) : stage === "closed" ? (
        <div className={rowClass}>{head}</div>
      ) : (
        <>
          <button type="button" onClick={onToggle} aria-expanded={open} className={rowClass}>
            {head}
          </button>
          <Collapse open={open}>
            <div className="border-t border-black/5 px-3 pb-3 pt-3">
              <Summary staged={staged} />
            </div>
          </Collapse>
        </>
      )}
    </li>
  );
}

/** The opened row: a vote's dates and answers, or a date's details. */
function Summary({ staged }: { staged: StagedEvent }): ReactNode {
  switch (staged.stage) {
    case "voting":
      return <VoteSummary event={staged.event} />;
    case "needsAnswer":
    case "waiting":
    case "scheduled":
      return <DatedSummary event={staged.event} stage={staged.stage} />;
    default:
      return null;
  }
}

/** Where an event stands, in the few words after its group's name. */
function StatusLine({ staged }: { staged: StagedEvent }) {
  const t = useT();
  const { lang } = useLang();
  const { stage, event } = staged;

  switch (stage) {
    case "toSwipe": {
      const you = event.invitees.find((i) => i.isYou)?.profileId;
      const dates = upcomingDates(event);
      return <>{t.events.datesToAnswer(dates.filter((d) => !you || !d.answers[you]).length)}</>;
    }
    case "voting": {
      const vote = voteStage(event);
      if (vote === "choose") return <>{t.swipe.goChoose}</>;
      if (vote === "waitingForChoice") return <>{t.swipe.waitingForChoice(event.createdBy.name)}</>;
      const total = event.invitees.length;
      return <>{t.events.answeredOf(total - stillToAnswer(event).length, total)}</>;
    }
    case "needsAnswer":
    case "scheduled":
      return <>{formatEventDate(event.settings.kind, event.currentDate, lang)}</>;
    case "waiting":
      return <>{t.events.waitingFor(nameList(waitingOn(event), lang))}</>;
    case "closed":
      return (
        <>
          {event.status === "no_date" || !event.currentDate
            ? t.events.noDate
            : (event.status === "scheduled" ? t.events.happened : t.events.passed)(
                formatEventDate(event.settings.kind, event.currentDate, lang),
              )}
        </>
      );
  }
}

/** A vote everyone has answered shows its decided date as soon as it exists. */
function DecidingRefresh({ event }: { event: VoteEvent }) {
  useDecidingRefresh(event);
  return null;
}
