import { Link } from "react-router-dom";
import { CalendarCheck, ChevronRight } from "lucide-react";

import { type CandidateDate, type EventResponse } from "@/api/events";
import Notice from "@/components/ui/Notice";
import { useLang, useT } from "@/i18n/lang";
import { formatEventDate, formatLongDate, formatTime, nameList } from "@/lib/format";
import { cn } from "@/lib/utils";
import { stillToAnswer, voteStage, type VoteEvent } from "@/lib/vote";
import { AnswerIcon } from "@/components/swipe/SwipeCard";

/**
 * After the last card: your answers (tap one to change it), and where the
 * event stands: settled (with the celebration), waiting for others, or
 * waiting for the suggester's choice.
 */
export default function DoneView({
  event,
  dates,
  answerOf,
  onChange,
  moved,
}: {
  event: VoteEvent;
  dates: CandidateDate[];
  answerOf: (d: CandidateDate) => EventResponse | undefined;
  onChange: (index: number) => void;
  /** The new date, after your answer moved the decided one. */
  moved: string | null;
}) {
  const t = useT();
  const { lang } = useLang();
  const settled = event.status === "scheduled" && event.currentDate;
  const stage = event.status === "pending" ? voteStage(event) : null;
  const missing = event.status === "pending" ? stillToAnswer(event) : [];

  return (
    <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
      <div>
        {moved && (
          <Notice tone="info" className="mb-4">
            {t.swipe.moved(moved)}
          </Notice>
        )}
        {settled ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5">
            <CalendarCheck className="h-8 w-8 text-emerald-600" />
            <p className="mt-2 text-sm font-semibold uppercase tracking-wide text-emerald-800">
              {t.swipe.settledTitle}
            </p>
            <p className="mt-1 text-2xl font-extrabold text-foreground">
              {formatEventDate(event.settings.kind, event.currentDate!, lang)}
            </p>
            <Link
              to={`/events/${event.id}`}
              className="mt-4 inline-flex rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              {t.swipe.seeEvent}
            </Link>
            <p className="mt-3 text-sm text-emerald-900/80">{t.swipe.changeAfter}</p>
          </div>
        ) : dates.length === 0 ? (
          <p className="text-muted-foreground">{t.swipe.noDates}</p>
        ) : (
          <>
            <p className="text-2xl font-extrabold text-foreground">{t.swipe.doneTitle}</p>
            <p className="mt-1 text-muted-foreground">
              {stage === "choose"
                ? t.swipe.chooseNow
                : stage === "waitingForChoice"
                  ? t.swipe.waitingForChoice(event.createdBy.name)
                  : missing.length > 0
                    ? t.swipe.waitingFor(nameList(missing, lang))
                    : t.swipe.deciding}
            </p>
            {event.answerBy && missing.length > 0 && (
              <p className="mt-1 text-sm text-muted-foreground">
                {t.swipe.decidedBy(
                  formatLongDate(event.answerBy, lang),
                  formatTime(event.answerBy),
                )}
              </p>
            )}
            {stage === "choose" && (
              <Link
                to={`/events/${event.id}`}
                className="mt-3 inline-flex rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
              >
                {t.swipe.goChoose}
              </Link>
            )}
          </>
        )}

        {dates.length > 0 && (
          <section className="mt-6">
            <h3 className="flex items-baseline justify-between gap-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t.swipe.yourAnswers}
              <span className="text-xs font-medium normal-case tracking-normal">
                {t.swipe.tapToChange}
              </span>
            </h3>
            <ul className="mt-2 flex flex-col gap-1.5">
              {dates.map((d, i) => {
                const a = answerOf(d);
                return (
                  <li key={d.id}>
                    <button
                      type="button"
                      onClick={() => onChange(i)}
                      aria-label={t.swipe.changeAnswerFor(
                        formatEventDate(event.settings.kind, d, lang),
                      )}
                      className="flex w-full items-center justify-between gap-3 rounded-xl border bg-card px-3 py-2.5 text-left text-sm transition hover:bg-secondary"
                    >
                      <span className="min-w-0 truncate font-medium text-foreground">
                        {formatEventDate(event.settings.kind, d, lang)}
                      </span>
                      <span
                        className={cn(
                          "flex shrink-0 items-center gap-1 text-xs font-semibold",
                          a === "accepted" && "text-emerald-700",
                          a === "maybe" && "text-amber-700",
                          a === "declined" && "text-rose-700",
                          !a && "text-muted-foreground",
                        )}
                      >
                        <AnswerIcon answer={a} />
                        {a ? t.swipe.answerWord[a] : t.swipe.notAnswered}
                        <ChevronRight className="ml-1 h-4 w-4 text-muted-foreground" />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
