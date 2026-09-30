import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarCheck,
  CalendarX,
  Check,
  ChevronDown,
  Clock,
  Hourglass,
  Loader2,
  Moon,
  Sparkles,
  Users,
  X,
  XCircle,
} from "lucide-react";

import {
  acceptEvent,
  cancelEvent,
  declineEvent,
  eventsQuery,
  eventsQueryKey,
  leaveEvent,
  type EventInvitee,
  type SuggestedEvent,
} from "@/api/events";
import { groupBusyQuery, groupsQuery, participantsFromGroup } from "@/api/groups";
import { SEARCH_WINDOW } from "@/api/mockData";
import {
  backToBackEnds,
  backToBackNote,
  earlyMorningNote,
  earlyMorningStarts,
} from "@/lib/earlyMorning";
import { APP_TIME_ZONE } from "@/lib/zone";
import AddToCalendar from "@/components/AddToCalendar";
import TopNav from "@/components/TopNav";
import { useAuth } from "@/context/auth";
import { eventTitle } from "@/i18n/eventTitle";
import { useLang, useT, type Lang } from "@/i18n/lang";
import { avatarColor } from "@/lib/avatar";
import { formatDaySpan, formatSlot, formatTripSpan } from "@/lib/format";
import { eventDateLabel, eventHeadline, nameList, sectionEvents, waitingOn } from "@/lib/myEvents";
import { cn } from "@/lib/utils";

/** A declined date, in the same words its event kind uses elsewhere. */
function pastDateLabel(
  event: SuggestedEvent,
  d: { start: string; end: string },
  lang: Lang,
): string {
  if (event.settings.kind === "vacation") return formatDaySpan(d.start, d.end, lang);
  if (event.settings.kind === "trip") return formatTripSpan(d.start, d.end, lang);
  return formatSlot(d.start, d.end, lang);
}

/** Everyone asked, each with where they stand on the current date. */
function People({ invitees }: { invitees: EventInvitee[] }) {
  const t = useT();
  return (
    <ul className="flex flex-wrap gap-1.5">
      {invitees.map((p, i) => (
        <li
          key={p.profileId}
          className={cn(
            "flex items-center gap-1.5 rounded-full border py-0.5 pl-0.5 pr-2.5 text-xs",
            p.response === "accepted" && "border-emerald-200 bg-emerald-50 text-emerald-800",
            p.response === "declined" && "border-rose-200 bg-rose-50 text-rose-800",
            p.response === null && "bg-background text-muted-foreground",
          )}
        >
          <span
            className={cn(
              "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold",
              avatarColor(i),
            )}
          >
            {p.name.trim().charAt(0).toUpperCase()}
          </span>
          {p.isYou ? t.events.you : p.name}
          {p.response === "accepted" ? (
            <Check className="h-3 w-3" />
          ) : p.response === "declined" ? (
            <X className="h-3 w-3" />
          ) : (
            <Clock className="h-3 w-3" />
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * The group's name as a button that opens a floating box with its members.
 * The box closes when the pointer leaves it (or the name), and on a tap
 * outside or Escape, since a touch screen has no pointer to move away.
 * Members come from your cached groups; a group you've since left falls back
 * to the people invited to this event.
 */
function GroupName({ event }: { event: SuggestedEvent }) {
  const t = useT();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data: groups } = useQuery(groupsQuery(user?.id ?? ""));
  const group = groups?.find((g) => g.id === event.group.id);
  const members = (group?.members ?? event.invitees).map((m) => (m.isYou ? t.events.you : m.name));

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (
        e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative z-10" onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={t.events.showMembers(event.group.name)}
        className="-mx-1.5 flex max-w-full items-center gap-1.5 rounded-lg px-1.5 text-left text-sm font-semibold text-emerald-800 transition hover:bg-emerald-200/60"
      >
        <Users className="h-4 w-4 shrink-0" />
        <span className="min-w-0 break-words">{event.group.name}</span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        // Padded rather than spaced from the name, so the pointer never
        // crosses a gap (and leaves) on its way into the box.
        <div className="absolute left-0 top-full z-20 pt-1">
          <ul className="flex w-56 max-w-[70vw] flex-col gap-1 rounded-xl border bg-card p-2 shadow-lg">
            {members.map((name, i) => (
              <li
                key={`${name}-${i}`}
                className="flex items-center gap-2 rounded-lg px-1.5 py-1 text-sm text-foreground"
              >
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                    avatarColor(i),
                  )}
                >
                  {name.trim().charAt(0).toUpperCase()}
                </span>
                <span className="truncate">{name}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * A meeting's edge warnings on My events, for those still invited: someone
 * coming straight from something that ends as it starts, or having to be up
 * early after a late night (lib/earlyMorning.ts). Meetings only; the group's
 * calendars are the same cached data a decline uses, one fetch per group.
 */
function EdgeWarnings({ event, className }: { event: SuggestedEvent; className?: string }) {
  const { lang } = useLang();
  const t = useT();
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const meeting = event.settings.kind === "single" && !!event.currentDate;
  const { data: groups } = useQuery({ ...groupsQuery(userId), enabled: meeting });
  const { data: busy } = useQuery({
    ...groupBusyQuery(userId, event.group.id, SEARCH_WINDOW.start, SEARCH_WINDOW.end),
    enabled: meeting,
  });
  const group = groups?.find((g) => g.id === event.group.id);
  if (!meeting || !group || !busy || !event.currentDate) return null;

  const invited = new Set(event.invitees.map((i) => i.profileId));
  const participants = participantsFromGroup(group, busy).participants.filter((p) =>
    invited.has(p.profileId),
  );
  const notes = [
    {
      icon: Hourglass,
      text: backToBackNote(
        backToBackEnds(participants, event.currentDate, APP_TIME_ZONE),
        userId,
        lang,
        t.backToBack,
      ),
    },
    {
      icon: Moon,
      text: earlyMorningNote(
        earlyMorningStarts(participants, event.currentDate, APP_TIME_ZONE),
        userId,
        lang,
        t.earlyMorning,
      ),
    },
  ].filter((n) => n.text);
  if (notes.length === 0) return null;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {notes.map(({ icon: Icon, text }) => (
        <p key={text} className="flex items-start gap-2 text-sm text-amber-900">
          <Icon className="mt-0.5 h-4 w-4 shrink-0" />
          {text}
        </p>
      ))}
    </div>
  );
}

/** Where the event came from: who suggested it, and why the date changed if it did. */
function Origin({ event, inline = false }: { event: SuggestedEvent; inline?: boolean }) {
  const { lang } = useLang();
  const t = useT();
  const last = event.declinedDates[event.declinedDates.length - 1];
  const Tag = inline ? "span" : "p";
  return (
    <Tag className="text-sm text-muted-foreground">
      {event.createdBy.isYou ? t.events.youSuggested : t.events.suggestedBy(event.createdBy.name)}
      {last && t.events.newDateBecause(last.declinedBy, pastDateLabel(event, last, lang))}.
    </Tag>
  );
}

export default function MyEvents() {
  const { user } = useAuth();
  const { lang } = useLang();
  const t = useT();
  const userId = user?.id ?? "";
  const queryClient = useQueryClient();
  const { data: events, isPending, isError } = useQuery(eventsQuery(userId));

  // Which card has its decline, cancel or leave confirmation open.
  const [confirming, setConfirming] = useState<{
    id: string;
    kind: "decline" | "cancel" | "leave";
  } | null>(null);

  const onChanged = (data: { events: SuggestedEvent[] }) => {
    queryClient.setQueryData(eventsQueryKey(userId), data.events);
    setConfirming(null);
  };
  // On any failure the list is refetched: the usual cause is someone else
  // answering first, and the fresh list shows what changed.
  const onFailed = () => void queryClient.invalidateQueries({ queryKey: eventsQueryKey(userId) });

  const accept = useMutation({ mutationFn: acceptEvent, onSuccess: onChanged, onError: onFailed });
  const decline = useMutation({
    mutationFn: (event: SuggestedEvent) => declineEvent(queryClient, userId, event),
    onSuccess: onChanged,
    onError: onFailed,
  });
  const cancel = useMutation({ mutationFn: cancelEvent, onSuccess: onChanged, onError: onFailed });
  const leave = useMutation({ mutationFn: leaveEvent, onSuccess: onChanged, onError: onFailed });

  const busyId =
    (accept.isPending && accept.variables?.id) ||
    (decline.isPending && decline.variables?.id) ||
    (cancel.isPending && cancel.variables) ||
    (leave.isPending && leave.variables) ||
    null;
  const errorFor = (id: string): string | null => {
    for (const m of [accept, decline]) {
      if (m.isError && m.variables?.id === id) return m.error.message;
    }
    for (const m of [cancel, leave]) {
      if (m.isError && m.variables === id) return m.error.message;
    }
    return null;
  };
  const resetErrors = () => {
    accept.reset();
    decline.reset();
    cancel.reset();
    leave.reset();
  };

  const headlineWords = {
    timeRange: t.scheduler.timeRange,
    tripTimes: t.scheduler.tripTimes,
    days: t.common.days,
  };

  const sections = events ? sectionEvents(events) : null;
  // Cancelled events are left out of every section, so "no events" means
  // nothing left to show, not an empty list from the server.
  const nothingToShow = !!sections && Object.values(sections).every((list) => list.length === 0);

  // The way out of an event: whoever suggested it cancels it for everyone,
  // anyone else leaves it and it goes ahead without them. `inline` is the
  // link alone, set in a row with other buttons; its confirmation then comes
  // from a separate exitConfirm() below the row.
  const exiting = (event: SuggestedEvent) =>
    confirming?.id === event.id && confirming.kind === (event.createdBy.isYou ? "cancel" : "leave");
  function exitControl(event: SuggestedEvent, inline = false) {
    const isCancel = event.createdBy.isYou;
    const kind = isCancel ? "cancel" : "leave";
    const label = isCancel ? t.events.cancelEvent : t.events.leaveEvent;
    if (exiting(event)) {
      if (inline) return null;
      return (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          {isCancel ? t.events.cancelConfirm : t.events.leaveConfirm}
          <div className="mt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={() => (isCancel ? cancel : leave).mutate(event.id)}
              disabled={busyId === event.id}
              className="flex items-center gap-1.5 rounded-full bg-red-600 px-4 py-1.5 font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
            >
              {busyId === event.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {label}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(null)}
              className="text-red-900/80 transition hover:text-red-900"
            >
              {isCancel ? t.events.keepIt : t.events.stayIn}
            </button>
          </div>
        </div>
      );
    }
    return (
      <button
        type="button"
        onClick={() => {
          resetErrors();
          setConfirming({ id: event.id, kind });
        }}
        className={cn(
          "text-sm font-medium text-muted-foreground transition hover:text-red-700",
          inline ? "shrink-0" : "mt-3",
        )}
      >
        {label}
      </button>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main className="px-4 pb-16 pt-2 sm:px-6 sm:pt-0 lg:px-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t.events.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.events.intro}</p>

        {isPending ? (
          <p className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t.events.loading}
          </p>
        ) : isError || !sections ? (
          <p className="mt-8 text-sm text-red-700">{t.events.loadFailed}</p>
        ) : nothingToShow ? (
          <div className="mt-6 flex flex-col items-start rounded-2xl border bg-card p-5 sm:mt-8 sm:p-6">
            <CalendarCheck className="h-8 w-8 text-primary" />
            <p className="mt-3 font-semibold text-foreground">{t.events.emptyTitle}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t.events.emptyBody}</p>
            <Link
              to="/"
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
            >
              <Sparkles className="h-4 w-4" />
              {t.events.findDate}
            </Link>
          </div>
        ) : (
          <>
            {/* ───── Needs your answer: the one thing this page is for ───── */}
            {sections.needsAnswer.length > 0 && (
              <section className="mt-8">
                <h2 className="text-lg font-semibold text-foreground">
                  {t.events.needsAnswer}
                  <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                    {sections.needsAnswer.length}
                  </span>
                </h2>
                <ul className="mt-3 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                  {sections.needsAnswer.map((event) => {
                    const busy = busyId === event.id;
                    const declining = confirming?.id === event.id && confirming.kind === "decline";
                    const error = errorFor(event.id);
                    return (
                      <li
                        key={event.id}
                        className="rounded-2xl border border-primary/30 bg-card p-4 shadow-sm sm:p-5"
                      >
                        <p className="text-xs font-medium uppercase tracking-wide text-primary">
                          {event.group.name} · {eventTitle(event.title, t)}
                        </p>
                        <p className="mt-1 text-xl font-bold text-foreground">
                          {eventDateLabel(event, lang)}
                        </p>
                        <div className="mt-1">
                          <Origin event={event} />
                        </div>
                        <div className="mt-3">
                          <People invitees={event.invitees} />
                        </div>
                        <EdgeWarnings event={event} className="mt-3" />

                        {declining ? (
                          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4">
                            <p className="text-sm text-rose-900">{t.events.cantMake}</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => decline.mutate(event)}
                                disabled={busy}
                                className="inline-flex items-center gap-2 rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60"
                              >
                                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                                {t.events.declineFind}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirming(null)}
                                disabled={busy}
                                className="rounded-full px-4 py-2 text-sm font-medium text-rose-900/80 transition hover:text-rose-900"
                              >
                                {t.events.keepIt}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-4 grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                resetErrors();
                                accept.mutate(event);
                              }}
                              disabled={busy}
                              className="flex items-center justify-center gap-2 rounded-full bg-primary py-3 font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition hover:opacity-90 disabled:opacity-60"
                            >
                              {busy ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                              ) : (
                                <Check className="h-5 w-5" />
                              )}
                              {t.events.accept}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                resetErrors();
                                setConfirming({ id: event.id, kind: "decline" });
                              }}
                              disabled={busy}
                              className="flex items-center justify-center gap-2 rounded-full border bg-background py-3 font-semibold text-foreground transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-60"
                            >
                              <X className="h-5 w-5" />
                              {t.events.decline}
                            </button>
                          </div>
                        )}

                        {error && (
                          <p className="mt-3 flex items-start gap-2 text-sm text-red-700">
                            <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                            {error}
                          </p>
                        )}
                        {exitControl(event)}
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {/* ───── Waiting for others ───── */}
            {sections.waiting.length > 0 && (
              <section className="mt-8">
                <h2 className="text-lg font-semibold text-foreground">
                  {t.events.waitingForOthers}
                </h2>
                <ul className="mt-3 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                  {sections.waiting.map((event) => {
                    const error = errorFor(event.id);
                    return (
                      <li key={event.id} className="rounded-2xl border bg-card p-4 sm:p-5">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {event.group.name} · {eventTitle(event.title, t)}
                        </p>
                        <p className="mt-1 text-lg font-bold text-foreground">
                          {eventDateLabel(event, lang)}
                        </p>
                        <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-amber-700">
                          <Clock className="h-4 w-4" />
                          {t.events.waitingFor(nameList(waitingOn(event), lang))}
                        </p>
                        <div className="mt-1">
                          <Origin event={event} />
                        </div>
                        <div className="mt-3">
                          <People invitees={event.invitees} />
                        </div>
                        <EdgeWarnings event={event} className="mt-3" />
                        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
                        {exitControl(event)}
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {/* ───── Scheduled ───── */}
            {sections.scheduled.length > 0 && (
              <section className="mt-8">
                <h2 className="text-lg font-semibold text-foreground">{t.events.scheduled}</h2>
                {/* Two halves need the width: at most two cards side by side. */}
                <ul className="mt-3 grid gap-3 xl:grid-cols-2">
                  {sections.scheduled.map((event) => {
                    const headline = eventHeadline(event, lang, headlineWords);
                    const pending = event.invitees.filter((i) => i.response !== "accepted");
                    return (
                      // One grid for both halves, so each row lines up across them:
                      //   group name   | title             who suggested it
                      //   big date     | accepted by all
                      //   time         | calendar          cancel / leave
                      // In the markup the cells go row by row; on phones (one
                      // column) `order` puts the left half first instead.
                      <li
                        key={event.id}
                        className="relative grid gap-y-2 rounded-2xl border border-emerald-200 bg-emerald-50/60 py-4 sm:grid-cols-2 sm:items-baseline sm:gap-y-1.5 sm:py-5"
                      >
                        {/* The left half's tint, drawn behind its cells. */}
                        <div
                          aria-hidden
                          className="absolute inset-y-0 left-0 hidden w-1/2 rounded-l-2xl border-r border-emerald-200 bg-emerald-100/60 sm:block"
                        />
                        <div className="relative order-1 min-w-0 px-4 sm:order-none sm:px-5">
                          <GroupName event={event} />
                        </div>
                        <div className="relative order-4 mt-3 flex min-w-0 items-baseline justify-between gap-3 px-4 sm:order-none sm:mt-0 sm:px-5">
                          <p className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-emerald-800">
                            <CalendarCheck className="h-4 w-4 shrink-0" />
                            <span className="truncate">{eventTitle(event.title, t)}</span>
                          </p>
                          {/* Who suggested it: the one person who can cancel it. */}
                          <p className="shrink-0 text-sm text-muted-foreground">
                            {event.createdBy.isYou
                              ? t.events.youSuggested
                              : t.events.suggestedBy(event.createdBy.name)}
                          </p>
                        </div>
                        <p className="relative order-2 px-4 text-3xl font-extrabold leading-tight tracking-tight text-foreground sm:order-none sm:px-5">
                          {headline?.date ?? eventDateLabel(event, lang)}
                        </p>
                        {/* Only who still hasn't said yes; normally nobody. */}
                        <div className="relative order-5 min-w-0 px-4 sm:order-none sm:px-5">
                          {pending.length > 0 ? (
                            <People invitees={pending} />
                          ) : (
                            <p className="text-xl font-bold text-foreground">
                              {t.events.acceptedByAll}
                            </p>
                          )}
                          <EdgeWarnings event={event} className="mt-1.5" />
                        </div>
                        <p className="relative order-3 px-4 text-lg text-foreground sm:order-none sm:px-5">
                          {headline?.time}
                        </p>
                        <div className="relative order-6 flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-2 px-4 sm:order-none sm:px-5">
                          <div className="min-w-0 flex-1">
                            <AddToCalendar event={event} />
                          </div>
                          {exitControl(event, true)}
                        </div>
                        {exiting(event) && (
                          <div className="relative order-7 px-4 sm:order-none sm:col-start-2 sm:px-5">
                            {exitControl(event)}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {/* ───── Past and closed ───── */}
            {sections.closed.length > 0 && (
              <section className="mt-8">
                <h2 className="text-lg font-semibold text-foreground">{t.events.pastClosed}</h2>
                <ul className="mt-3 grid gap-2 md:grid-cols-2 2xl:grid-cols-3">
                  {sections.closed.map((event) => (
                    <li
                      key={event.id}
                      className="flex items-start gap-3 rounded-2xl border bg-card p-4"
                    >
                      <CalendarX className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 text-sm">
                        <p className="font-medium text-foreground">
                          {event.group.name} · {eventTitle(event.title, t)}
                        </p>
                        <p className="text-muted-foreground">
                          {event.status === "no_date"
                            ? t.events.noDate
                            : event.status === "scheduled"
                              ? t.events.happened(eventDateLabel(event, lang))
                              : t.events.passed(eventDateLabel(event, lang))}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
