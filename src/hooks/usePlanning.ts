import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { sendPlanFeedback } from "@/api/aiFeedback";
import { eventsQueryKey, rankDates, suggestEvent } from "@/api/events";
import type { EventImpact } from "@/api/eventProfile";
import {
  groupBusyQuery,
  groupsQueryKey,
  participantsFromGroup,
  type Group,
  type GroupBusy,
} from "@/api/groups";
import { useAuth } from "@/context/auth";
import { useAiAllowed, useAiShare } from "@/hooks/useAiAllowed";
import { useAiPlanner } from "@/hooks/useAiPlanner";
import { findAnswer, TODAY, useDateSearch } from "@/hooks/useDateSearch";
import { useEventProfile } from "@/hooks/useEventProfile";
import { useGroupRefresh, type RefreshOutcome } from "@/hooks/useGroupRefresh";
import { usePhoneLayout } from "@/hooks/usePhoneLayout";
import { useSchedulingGroups } from "@/hooks/useSchedulingGroups";
import { storedEventTitle } from "@/i18n/eventTitle";
import { LOCALE, useLang, useT } from "@/i18n/lang";
import { planFeedback, planFieldsOf, type AiPlan } from "@/lib/aiPlan";
import { widenOptions, type WidenOption } from "@/lib/widen";
import {
  accept,
  back,
  currentStep,
  forward,
  jump,
  restart,
  type AnswerSteps,
} from "@/lib/answerSteps";
import type { MultiDayResult, VacationSuggestion } from "@/lib/availability";
import { findPool, rankFromPool } from "@/lib/candidates";
import { edgeWarnings } from "@/lib/earlyMorning";
import { profileInput } from "@/lib/eventImpact";
import { peopleForSearch, SEARCH_WINDOW } from "@/lib/eventSearch";
import { monthAvailability } from "@/lib/monthAvailability";
import {
  answerKey,
  DEFAULT_EXTRAS,
  fallbackTitleId,
  MAX_TRIP_DAYS,
  NO_PEOPLE_CHOICE,
  peopleFromChoice,
  periodBounds,
  periodWindow,
  randomDefaultSettings,
  reviewAnswer,
  settingsToSearch,
  type EventExtras,
  type PeopleChoice,
  type SchedulerSettings,
} from "@/lib/scheduler";
import { readStored, writeStored } from "@/lib/storage";
import { addDays, APP_TIME_ZONE, dayOf, localDate, startOfMonth } from "@/lib/zone";

/** The zone every search and every day planned is local to. */
export const TZ = APP_TIME_ZONE;

/** How long "Suggest dates" waits for a calendar sync already running, at most. */
const SUGGEST_WAIT_MS = 2_000;

/** How long it waits for the dates' scores (#119), at most: it goes without rather than slowly. */
const SCORE_WAIT_MS = 3_000;

/** The months the chart can show: this one, up to the last one searched. */
export const FIRST_MONTH = startOfMonth(Date.parse(TODAY), TZ);
export const LAST_MONTH = startOfMonth(Date.parse(SEARCH_WINDOW.end) - 1, TZ);

/**
 * The real group you last scheduled for, per account, so a reload opens on
 * it rather than on your first group. Only a convenience: if storage is
 * blocked, or the group is gone, the page simply starts on the first group.
 */
const lastGroupKey = (userId: string) => `casy-last-group:${userId}`;

/**
 * The plan as it was left, so going to My calendar or the profile and back
 * finds it just as you set it up: settings, name, group, the date stepped to
 * and the month paged to. In memory only, never in storage, so a reload (or
 * a new tab) starts afresh with new random settings. Per account, so someone
 * signing in after you doesn't find your half-typed event. Shared by every
 * place planning starts (the scheduler, My calendar's Planlæg), so it is one
 * plan wherever it was begun.
 */
interface PageMemory {
  userId: string | null;
  name: string;
  extras: EventExtras;
  peopleChoices: Record<string, PeopleChoice>;
  sched: SchedulerSettings;
  selectedGroupId: string | null;
  steps: AnswerSteps;
  monthPick: MonthPick | null;
}
let pageMemory: PageMemory | null = null;

/** A month paged to by hand, for the answer (its first day) it was paged from. */
interface MonthPick {
  month: number;
  anchor: string | null;
}

/** Your own answer to a date you suggest (#101): sent with it. */
type SuggesterAnswer = "accepted" | "maybe";

/** A date sent as it is, with your answer (My calendar's Planlæg, #126). */
interface ChosenDate {
  start: string;
  end: string;
  answer: SuggesterAnswer;
}

/**
 * Planning an event for a group: who it is for, what and when, the first
 * date everyone can make and the ones after it, and sending dates to the
 * group as a vote. Everything but the screens: the scheduling page
 * (FindDate) draws it as a page or the phone's flow, My calendar as its
 * Planlæg sheet.
 */
export function usePlanning() {
  const t = useT();
  const { lang } = useLang();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const phone = usePhoneLayout();

  // The plan as this person left it earlier in this visit, if they did;
  // otherwise it starts fresh, with random settings.
  const [left] = useState(() => (pageMemory?.userId === userId ? pageMemory : null));
  const [selectedGroupId, setSelectedGroupId] = useState(left?.selectedGroupId ?? null);
  // What the event is called: only for the group to read, never searched on.
  const [name, setName] = useState(left?.name ?? "");
  // Where, what to know, and how the vote runs (#84, #99): sent with a
  // suggestion, never searched on.
  const [extras, setExtras] = useState<EventExtras>(left?.extras ?? DEFAULT_EXTRAS);
  const updateExtras = (patch: Partial<EventExtras>) => setExtras((e) => ({ ...e, ...patch }));
  // Who each group's event is for (#89), per group: members differ.
  const [peopleChoices, setPeopleChoices] = useState<Record<string, PeopleChoice>>(
    left?.peopleChoices ?? {},
  );
  const [sched, setSched] = useState(() => left?.sched ?? randomDefaultSettings());
  const [steps, setSteps] = useState(() => left?.steps ?? restart());
  // Once the answer moves on from the date it was paged from, the chart
  // follows the answer again.
  const [monthPick, setMonthPick] = useState(left?.monthPick ?? null);
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  useEffect(() => {
    pageMemory = { userId, name, extras, peopleChoices, sched, selectedGroupId, steps, monthPick };
  }, [userId, name, extras, peopleChoices, sched, selectedGroupId, steps, monthPick]);

  // The group you last scheduled for, read once your account is known. A
  // group picked on this visit wins; a remembered one that's gone falls back
  // to the first group, like any unknown id.
  const rememberedGroupId = useMemo(
    () => (userId ? readStored(lastGroupKey(userId)) : null),
    [userId],
  );
  // Real groups and everyone's real busy time, or the labelled examples for
  // someone who has not made a group yet. See the hook for which is which.
  const {
    groups,
    activeGroup,
    activeGroupId,
    busyLoading,
    busyFailed,
    myCalendarsFailed,
    youProfileId,
    carousel,
  } = useSchedulingGroups(selectedGroupId ?? rememberedGroupId);
  // A phone lists the examples to pick from, so they hold still there
  // rather than taking turns on screen.
  const stopExamples = carousel.stop;
  useEffect(() => {
    if (phone) stopExamples();
  }, [phone, stopExamples]);
  // Remember whichever real group is on screen, however it got there
  // (picked, just made, or the fallback after leaving one).
  const rememberableGroupId = activeGroup && !activeGroup.isExample ? activeGroup.id : null;
  useEffect(() => {
    if (userId && rememberableGroupId) writeStored(lastGroupKey(userId), rememberableGroupId);
  }, [userId, rememberableGroupId]);

  // What is being searched for, as data. The same settings travel with a
  // suggested event, so a decline re-runs exactly this search (eventSearch.ts).
  // The controls show a change at once; the search follows a beat later, so
  // tapping + a few times in a row never stutters on a slow phone.
  const deferredSched = useDeferredValue(sched);
  const peopleChoice = (activeGroupId && peopleChoices[activeGroupId]) || NO_PEOPLE_CHOICE;
  const deferredChoice = useDeferredValue(peopleChoice);
  const memberIds = useMemo(
    () => activeGroup?.members.map((m) => m.profileId) ?? [],
    [activeGroup?.members],
  );
  const search = useMemo(
    () =>
      settingsToSearch(
        deferredSched,
        peopleFromChoice(memberIds, deferredChoice, !deferredSched.multiDay),
      ),
    [deferredSched, memberIds, deferredChoice],
  );
  const updatePeople = (choice: PeopleChoice) => {
    if (!activeGroupId) return;
    setPeopleChoices((all) => ({ ...all, [activeGroupId]: choice }));
    // Like any other setting: back to the first date for the new rules.
    setSteps(restart());
  };
  // The months to search (#74): every date found, and every date suggested,
  // lies within them. With none picked, the whole year from today.
  const period = deferredSched.period;
  const searchWindow = useMemo(() => periodWindow(period, TODAY, SEARCH_WINDOW, TZ), [period]);

  // Still fetching the group or its calendars, as opposed to having nothing
  // to search: the page then keeps its full layout with placeholders, so it
  // doesn't jump when they land. With no calendars at all there is nothing
  // to search, or "everyone" would be free today.
  const loadingGroup = !activeGroup || busyLoading;
  const participants =
    !loadingGroup && activeGroup.participants.length > 0 ? activeGroup.participants : null;
  const { found, suggestions, later, firstDay, days } = useDateSearch(
    participants,
    search,
    currentStep(steps),
    searchWindow,
  );
  const slot = found?.slot ?? null;
  const review = reviewAnswer(found, search, youProfileId, steps.accepted);
  // Ways to widen a search that found nothing (#135), each with the first
  // date it finds: only for the first search (not after stepping past the
  // last date), and only with calendars to search.
  const widen = useMemo(
    () =>
      participants && found && !found.slot && steps.index === 0
        ? widenOptions({
            participants,
            settings: deferredSched,
            members: memberIds,
            choice: deferredChoice,
            today: TODAY,
            limit: SEARCH_WINDOW,
            timeZone: TZ,
          })
        : [],
    [participants, found, steps.index, deferredSched, memberIds, deferredChoice],
  );

  // Fresh busy times while planning (#85): calendars sync hourly, so the
  // group's are synced again in the background while someone plans for it,
  // at most once a minute (useGroupRefresh). The suggest button never syncs
  // itself; it only waits a moment for a sync already running.
  const refresh = useGroupRefresh(userId ?? "");
  // The search and step on screen, for checks that finish after a render.
  const shownSearch = useRef({ search, step: currentStep(steps), window: searchWindow });
  useEffect(() => {
    shownSearch.current = { search, step: currentStep(steps), window: searchWindow };
  });
  /** The group's members as the search sees them, from `data`, a copy of their busy times. */
  function peopleFrom(groupId: string, data: GroupBusy | undefined) {
    const group = queryClient
      .getQueryData<Group[]>(groupsQueryKey(userId ?? ""))
      ?.find((g) => g.id === groupId);
    if (!group || !data) return null;
    const { participants: people } = participantsFromGroup(group, data, t.common.withYou);
    return people.length > 0 ? people : null;
  }
  /**
   * The answer the page would show from `data`: the same search the page
   * runs (findAnswer), from the same group members, so it can be compared
   * with the one on screen.
   */
  function answerFrom(groupId: string, data: GroupBusy | undefined): MultiDayResult | null {
    const people = peopleFrom(groupId, data);
    if (!people) return null;
    const { search, step, window: within } = shownSearch.current;
    return findAnswer(people, search, step, within);
  }
  // The date moved because calendars changed, said in the hint line for as
  // long as that new date is the one on screen.
  const [moved, setMoved] = useState<{
    groupId: string;
    start: string | null;
    when: "background" | "suggest";
  } | null>(null);

  // Planning starts with the first change on the page: settings, a step, a
  // picked day or month, another group. Not merely opening it (and not the
  // page as it was left earlier in the visit), or every glance at Casy would
  // sync a whole group's calendars.
  const [atOpen] = useState(() => ({ sched, steps, selectedGroupId, monthPick }));
  const planning =
    sched !== atOpen.sched ||
    steps !== atOpen.steps ||
    selectedGroupId !== atOpen.selectedGroupId ||
    monthPick !== atOpen.monthPick;
  const planningGroupId =
    planning && userId && activeGroup && !activeGroup.isExample ? activeGroup.id : null;
  /**
   * Sync the group in the background (unless it was within the last minute),
   * and if the fresh busy times move the answer on screen, say so.
   */
  function freshenInBackground(groupId: string) {
    void refresh.start(groupId)?.then((outcome: RefreshOutcome) => {
      if (!outcome.after || !outcome.before) return;
      const was = answerFrom(groupId, outcome.before);
      const now = answerFrom(groupId, outcome.after);
      if (answerKey(was) !== answerKey(now)) {
        setMoved({ groupId, start: now?.slot?.start ?? null, when: "background" });
      }
    });
  }
  // Every change while planning, at most once a minute (useGroupRefresh).
  useEffect(() => {
    if (planningGroupId) freshenInBackground(planningGroupId);
    // freshenInBackground reads the latest search through a ref; only a
    // change on the page is a trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planningGroupId, sched, steps, monthPick]);
  // Coming back to the tab, or the app: the usual way a new appointment
  // happens is switching to the calendar to add it, then switching back.
  useEffect(() => {
    if (!planningGroupId) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") freshenInBackground(planningGroupId);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
    // As above: freshenInBackground reads the latest through a ref, so only the group is a trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planningGroupId]);

  // The chart shows the answer's month unless a month was paged to by hand
  // for this same answer.
  const viewMonth =
    monthPick && monthPick.anchor === firstDay
      ? monthPick.month
      : Math.min(
          Math.max(
            startOfMonth(firstDay ? Date.parse(firstDay) : Date.parse(searchWindow.start), TZ),
            FIRST_MONTH,
          ),
          LAST_MONTH,
        );
  // While loading, an empty month gives the chart its frame (DayChart's `loading`).
  const chartMonth = useMemo(() => {
    if (!participants && !loadingGroup) return null;
    const { year, month } = localDate(viewMonth, TZ);
    const shown = monthAvailability(participants ?? [], search, year, month, {
      timeZone: TZ,
      todayMs: Date.parse(TODAY),
      windowEndMs: Date.parse(SEARCH_WINDOW.end),
      locale: LOCALE[lang],
    });
    if (!period) return shown;
    // Days outside the months (or days) picked read like an unticked weekday: not searched.
    const { from, to } = periodBounds(period, TZ);
    return {
      ...shown,
      days: shown.days.map((d) =>
        Date.parse(d.date) < from || Date.parse(d.date) >= to ? { ...d, excluded: true } : d,
      ),
    };
  }, [lang, participants, loadingGroup, viewMonth, search, period]);

  /**
   * Any touch of the settings or the answer stops the example carousel, for
   * good: if you are using the page, it is not a demo any more. The example
   * on screen is pinned as the selection too, so it can't move on between
   * the click and the next render.
   */
  function stopCarousel() {
    if (!carousel.running) return;
    setSelectedGroupId((id) => id ?? activeGroupId);
    carousel.stop();
  }

  /** Another group (null: whichever comes first), its first date from today. */
  function selectGroup(id: string | null) {
    setSelectedGroupId(id);
    setSteps(restart());
  }

  function updateSettings(patch: Partial<SchedulerSettings>) {
    setSched((prev) => {
      const next = { ...prev, ...patch };
      // A trip that starts on a set weekday covers a week at most.
      if (next.multiDay && next.startDow !== null && next.days > MAX_TRIP_DAYS) {
        next.days = MAX_TRIP_DAYS;
      }
      return next;
    });
    setSteps(restart());
  }

  /**
   * A day picked in the chart or among the later dates. A meeting shows that
   * very day if it works at all. For a trip, any day of it means that trip:
   * search from the day it starts (never before today), or clicking the
   * Saturday of a free weekend would jump to the weekend after.
   */
  function pickDay(dayIso: string) {
    if (search.kind !== "trip") {
      setSteps((s) => jump(s, dayIso, search.kind === "single"));
      return;
    }
    const day = Date.parse(dayIso);
    const offset = (localDate(day, TZ).dow - search.shape.anchorDow + 7) % 7;
    const start = Math.max(addDays(day, -offset, TZ), Date.parse(TODAY));
    setSteps((s) => jump(s, new Date(start).toISOString()));
  }

  /** Adopt a workaround: the shorter stay, from its dates. */
  function adoptSuggestion(suggestion: VacationSuggestion) {
    setSched((prev) => ({ ...prev, days: suggestion.days }));
    setSteps(restart(dayOf(suggestion.slot.start, TZ)));
  }

  function stepOn() {
    if (!slot) return;
    const dayAfter = new Date(addDays(Date.parse(slot.start), 1, TZ)).toISOString();
    setSteps((s) => forward(s, dayAfter));
  }
  const stepBack = () => setSteps(back);
  const acceptOwnTimeOff = () => slot && setSteps((s) => accept(s, slot.start));

  /** Step the chart a month back (-1) or forward (+1), within the searched months. */
  function pageMonth(delta: number) {
    const month = startOfMonth(viewMonth, TZ, delta);
    if (month >= FIRST_MONTH && month <= LAST_MONTH) setMonthPick({ month, anchor: firstDay });
  }

  // "New group" from the switcher: made and invited to in its own sheet
  // (NewGroupDialog, #153), which says when the group exists so it is picked
  // here, the plan open behind it. A group with no owner would be nobody's,
  // so anyone signed out is sent to sign in first and comes straight back.
  function groupCreated(id: string) {
    selectGroup(id);
  }
  function openNewGroup() {
    if (!user) {
      navigate("/sign-in?next=/");
      return;
    }
    setNewGroupOpen(true);
  }

  // Suggesting the date on screen and a few more to the group, to swipe
  // through (#74). The answer is the fresh list of events, which goes
  // straight into the cache the header badge reads; on a computer the
  // suggester then answers the dates themselves, right away.
  // What the event is called when sent: the name typed, or the matching
  // type's name, which each reader sees in their own language (eventTitle.ts).
  const sentTitle = name.trim() || storedEventTitle(fallbackTitleId(search));
  // What the event is likely to cause (#113): asked in the background while
  // it is set up, for a real group only, and sent with the dates.
  const profileFor =
    user && activeGroup && !activeGroup.isExample
      ? profileInput(search, sentTitle, extras.place, extras.note)
      : null;
  const profile = useEventProfile(profileFor);
  // Waiting (briefly) for that profile before sending.
  const [preparing, setPreparing] = useState(false);
  // Something to do between "sent" and leaving for My events: the dates
  // flying into the Events tab (#102). It is handed the way on and takes it
  // when it is done; without one the way is taken at once.
  const beforeLeaving = useRef<((go: () => void) => void) | null>(null);
  const suggest = useMutation({
    mutationFn: suggestEvent,
    onSuccess: (data) => {
      queryClient.setQueryData(eventsQueryKey(userId ?? ""), data.events);
      // A phone's suggester has answered already (#101): on to My events,
      // where the new vote waits for the others.
      const go = () => navigate(phone ? "/events" : `/events/${data.createdId}`);
      if (beforeLeaving.current) beforeLeaving.current(go);
      else go();
    },
  });
  // Waiting for the calendars to be fresh before sending.
  const [checking, setChecking] = useState(false);
  // Suggesting needs a signed-in person, a real group, a date, and your
  // sign-off on any time off it would cost you.
  const canSuggest =
    !!user && !!activeGroup && !activeGroup.isExample && !!slot && review.tone !== "approve";
  /**
   * Send the date on screen and the best few after it in the period
   * (pickCandidates), checked against the freshest busy times there are: if
   * a background sync is running, wait for it, but no more than
   * SUGGEST_WAIT_MS (the button must stay quick); then search those busy
   * times the way the page does. If the answer is still this date, costing
   * the same people the same, the dates go, picked from those same busy
   * times; if not, nothing goes, and the page shows the new answer to look
   * at first.
   */
  /** How well each date suits the group (#119), by its start; undefined when it can't be said. */
  async function scoresFor(
    groupId: string,
    impact: EventImpact | undefined,
    dates: { slot: { start: string; end: string } }[],
  ): Promise<Map<string, number> | undefined> {
    try {
      const { scores } = await Promise.race([
        rankDates({
          groupId,
          settings: search,
          profile: impact ?? null,
          dates: dates.map((d) => ({ start: d.slot.start, end: d.slot.end })),
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("slow")), SCORE_WAIT_MS),
        ),
      ]);
      return new Map(dates.map((d, i) => [d.slot.start, scores[i]] as const));
    } catch (err) {
      console.warn("couldn't score the dates", err);
      return undefined;
    }
  }

  async function sendSuggestion(
    /** The dates to send as they are, with your answers (Planlæg, #126). */
    chosen?: ChosenDate[],
  ) {
    if (!activeGroup || !found?.slot || !participants || !userId) return;
    const groupId = activeGroup.id;
    const shown = answerKey(found);
    setMoved(null);
    const running = refresh.running(groupId);
    if (running) {
      setChecking(true);
      await Promise.race([running, new Promise((done) => setTimeout(done, SUGGEST_WAIT_MS))]);
      setChecking(false);
    }
    const busy = groupBusyQuery(userId, groupId, SEARCH_WINDOW.start, SEARCH_WINDOW.end);
    const fresh = peopleFrom(groupId, queryClient.getQueryData(busy.queryKey));
    const now = answerFrom(groupId, queryClient.getQueryData(busy.queryKey));
    if (now && answerKey(now) !== shown) {
      setMoved({ groupId, start: now.slot?.start ?? null, when: "suggest" });
      return;
    }
    const first = { slot: found.slot, conflicts: found.conflicts };
    // Usually here already; never waited for long (PROFILE_WAIT_MS), and
    // the event goes without one rather than not at all.
    setPreparing(true);
    const impact = await profile.forSend();
    let dates: { start: string; end: string; answer?: SuggesterAnswer }[] | undefined = chosen;
    if (!dates) {
      // The dates a vote offers: the clean ones first, and among them the
      // best by what everyone's important events say (#119). The scores come
      // from the server; without them (slow, or failing) the dates are
      // picked as they always were.
      const options = { first, end: searchWindow.end, count: extras.dateCount };
      const pool = findPool(fresh ?? participants, search, options, TZ);
      const scores = await scoresFor(groupId, impact, [first, ...pool]);
      dates = rankFromPool(pool, search, { ...options, scores }, TZ).chosen.map((d) => ({
        start: d.slot.start,
        end: d.slot.end,
      }));
    }
    setPreparing(false);
    // A plan Planlæg med AI made, sent to the group with whatever the person
    // changed by hand: with their yes, Casy learns from it (#122). Once per
    // plan, in the background, never worth holding the event back for.
    const aiSession = planner.session;
    if (shares && aiSession.plan && planSent.current !== aiSession.plan) {
      const feedback = planFeedback(
        aiSession.texts,
        aiSession.plan,
        aiSession.overridden,
        sched,
        TZ,
      );
      if (feedback) {
        planSent.current = aiSession.plan;
        void sendPlanFeedback(feedback).catch((err) =>
          console.warn("sending the plan to Casy failed", err),
        );
      }
    }
    suggest.mutate({
      groupId,
      title: sentTitle,
      settings: search,
      dates,
      place: extras.place,
      note: extras.note,
      answerDays: extras.answerDays,
      impact,
    });
  }
  // How sending went belongs to the exact date it was for: switch group, step
  // to another date or change a setting, and it stops showing.
  const sentFor = suggest.variables;
  const suggestIsForThis =
    !!sentFor && sentFor.groupId === activeGroup?.id && sentFor.dates[0]?.start === slot?.start;
  const suggested = suggestIsForThis && suggest.isSuccess;

  // Why there is nothing to search yet, if there isn't: said plainly, never
  // as the red "no date works".
  const waiting = loadingGroup
    ? { text: activeGroup ? t.scheduler.busyLoading : t.common.loading, loading: true }
    : !participants
      ? { text: busyFailed ? t.scheduler.busyFailed : t.scheduler.noCalendars, loading: false }
      : null;
  // A meeting's edges, said rather than blocked: someone coming straight from
  // something else, or having to be up early after a late night.
  const edge =
    search.kind === "single" && slot && participants
      ? edgeWarnings(participants, slot, TZ, youProfileId, lang, t)
      : [];
  // Members with no calendar check suggested dates themselves (#82): the
  // answer says who, and doesn't claim to work for "everyone" without them.
  const checkers =
    activeGroup && !activeGroup.isExample && !loadingGroup && activeGroup.waitingFor.length > 0
      ? {
          names: activeGroup.waitingFor.map((m) => (m.isYou ? t.common.withYou(m.name) : m.name)),
          everyone: activeGroup.waitingFor.length === activeGroup.memberCount,
        }
      : null;
  // Members whose calendar hasn't been updated for days: still searched, but
  // the answer says so, since something newer may not be known.
  const outdated =
    activeGroup && !activeGroup.isExample && !loadingGroup
      ? activeGroup.outdated.map((o) => ({
          name: o.member.isYou ? t.common.withYou(o.member.name) : o.member.name,
          since: o.since,
        }))
      : [];
  // What the boxes below fade on: a different group's numbers.
  const fadeKey = activeGroupId ?? "none";
  // Why the date on screen moved, while it is the one on screen.
  const movedNote =
    moved && moved.groupId === activeGroup?.id && moved.start === (slot?.start ?? null)
      ? moved.when
      : null;
  const groupSize = peopleForSearch(participants ?? [], search.people).searched.length;

  // Planning with AI (#100): the conversation, kept here so it outlives the
  // flow's steps; what it says lands in the same state the controls set.
  const aiOn = useAiAllowed();
  // Whether what the AI got wrong goes to Casy to learn from (#122), and the
  // plan last sent, so one plan is sent once however many votes it makes.
  const shares = useAiShare();
  const planSent = useRef<AiPlan | null>(null);
  const planner = useAiPlanner({
    settings: sched,
    name,
    members: activeGroup?.members ?? [],
    peopleChoice,
    setSettings: (next) => updateSettings(next),
    setName,
    setExtras: updateExtras,
    setPeople: updatePeople,
  });
  // A setting changed by hand on the AI's screen is no longer its guess.
  const updateSettingsByHand = (patch: Partial<SchedulerSettings>) => {
    updateSettings(patch);
    planner.edited(planFieldsOf(patch));
  };
  /** A way to widen the search picked (#135): only what it changes, by hand. */
  function applyWiden(option: WidenOption) {
    if (option.people) {
      updatePeople(option.people);
      return;
    }
    const patch = Object.fromEntries(
      Object.entries(option.settings).filter(
        ([key, value]) =>
          JSON.stringify(value) !== JSON.stringify(sched[key as keyof SchedulerSettings]),
      ),
    ) as Partial<SchedulerSettings>;
    updateSettingsByHand(patch);
  }

  return {
    user,
    // The group, and who in it the event is for.
    groups,
    activeGroup,
    activeGroupId,
    busyLoading,
    busyFailed,
    myCalendarsFailed,
    youProfileId,
    carousel,
    stopCarousel,
    selectGroup,
    peopleChoice,
    updatePeople,
    newGroupOpen,
    setNewGroupOpen,
    groupCreated,
    openNewGroup,
    // What and when.
    name,
    setName,
    extras,
    updateExtras,
    sched,
    updateSettings,
    updateSettingsByHand,
    aiOn,
    planner,
    // The search and its answer.
    search,
    searchWindow,
    loadingGroup,
    participants,
    found,
    suggestions,
    later,
    days,
    slot,
    review,
    steps,
    stepOn,
    stepBack,
    acceptOwnTimeOff,
    pickDay,
    adoptSuggestion,
    widen,
    applyWiden,
    waiting,
    edge,
    checkers,
    outdated,
    fadeKey,
    groupSize,
    // The chart's month.
    viewMonth,
    chartMonth,
    pageMonth,
    // Sending.
    profileFor,
    canSuggest,
    checking,
    sending: suggest.isPending || preparing,
    suggest,
    suggested,
    suggestIsForThis,
    movedNote,
    sendSuggestion,
    /** Run something once the send is confirmed, before leaving for My events; null to stop. */
    setBeforeLeaving: (run: ((go: () => void) => void) | null) => {
      beforeLeaving.current = run;
    },
  };
}

export type Planning = ReturnType<typeof usePlanning>;
