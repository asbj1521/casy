import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { eventsQueryKey, suggestEvent } from "@/api/events";
import {
  createGroup,
  groupBusyQuery,
  groupsQueryKey,
  participantsFromGroup,
  type Group,
  type GroupBusy,
} from "@/api/groups";
import DayChart from "@/components/DayChart";
import AnswerActions from "@/components/findDate/AnswerActions";
import AnswerCard from "@/components/findDate/AnswerCard";
import ExampleGroupPanel from "@/components/findDate/ExampleGroupPanel";
import GroupPanel from "@/components/findDate/GroupPanel";
import LaterDates from "@/components/findDate/LaterDates";
import MoreSettingsScreen from "@/components/findDate/MoreSettingsScreen";
import GroupSwitcher from "@/components/GroupSwitcher";
import NewGroupDialog from "@/components/NewGroupDialog";
import { SettingsPanel, SettingsSentence } from "@/components/SchedulerSettings";
import TopNav from "@/components/TopNav";
import DanishTimeNote from "@/components/time/DanishTimeNote";
import { useAuth } from "@/context/auth";
import { findAnswer, TODAY, useDateSearch } from "@/hooks/useDateSearch";
import { useGroupRefresh, type RefreshOutcome } from "@/hooks/useGroupRefresh";
import { usePhoneLayout } from "@/hooks/usePhoneLayout";
import { useSchedulingGroups } from "@/hooks/useSchedulingGroups";
import { storedEventTitle } from "@/i18n/eventTitle";
import { LOCALE, useLang, useT } from "@/i18n/lang";
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
import { pickCandidates } from "@/lib/candidates";
import { edgeWarnings } from "@/lib/earlyMorning";
import { peopleForSearch, SEARCH_WINDOW } from "@/lib/eventSearch";
import { monthAvailability } from "@/lib/monthAvailability";
import {
  answerKey,
  DEFAULT_EXTRAS,
  fallbackTitleId,
  NO_PEOPLE_CHOICE,
  peopleFromChoice,
  MAX_TRIP_DAYS,
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

/** The zone every search and every day on this page is local to. */
const TZ = APP_TIME_ZONE;

/** How long "Suggest dates" waits for a calendar sync already running, at most. */
const SUGGEST_WAIT_MS = 2_000;

/** The months the chart can show: this one, up to the last one searched. */
const FIRST_MONTH = startOfMonth(Date.parse(TODAY), TZ);
const LAST_MONTH = startOfMonth(Date.parse(SEARCH_WINDOW.end) - 1, TZ);

/**
 * The real group you last scheduled for, per account, so a reload opens on
 * it rather than on your first group. Only a convenience: if storage is
 * blocked, or the group is gone, the page simply starts on the first group.
 */
const lastGroupKey = (userId: string) => `casy-last-group:${userId}`;

/**
 * The page as it was left, so going to My calendar or the profile and back
 * finds it just as you set it up: settings, name, group, the date stepped to
 * and the month paged to. In memory only, never in storage, so a reload (or
 * a new tab) starts afresh with new random settings. Per account, so someone
 * signing in after you doesn't find your half-typed event.
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

/**
 * The scheduling page: the settings on top, the first date everyone can make
 * under them, the month day by day, the next few dates, and the group itself
 * at the bottom.
 */
export default function FindDate() {
  const t = useT();
  const { lang } = useLang();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const navigate = useNavigate();
  // Flere indstillinger (#98), laid over the page while ?settings is set.
  const location = useLocation();
  const moreSettings = new URLSearchParams(location.search).has("settings");
  const queryClient = useQueryClient();
  const phone = usePhoneLayout();

  // The page as this person left it earlier in this visit, if they did;
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
    // Days outside the months picked read like an unticked weekday: not searched.
    const [from, to] = [Date.parse(period.from), startOfMonth(Date.parse(period.to), TZ, 1)];
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

  /** Step the chart a month back (-1) or forward (+1), within the searched months. */
  function pageMonth(delta: number) {
    const month = startOfMonth(viewMonth, TZ, delta);
    if (month >= FIRST_MONTH && month <= LAST_MONTH) setMonthPick({ month, anchor: firstDay });
  }

  // "New group" from the switcher. A group with no owner would be nobody's,
  // so anyone signed out is sent to sign in first and comes straight back.
  const create = useMutation({
    mutationFn: createGroup,
    onSuccess: (data) => {
      queryClient.setQueryData(groupsQueryKey(userId ?? ""), data.groups);
      selectGroup(data.createdId);
      setNewGroupOpen(false);
    },
  });
  function openNewGroup() {
    if (!user) {
      navigate("/sign-in?next=/");
      return;
    }
    create.reset();
    setNewGroupOpen(true);
  }

  // Suggesting the date on screen and a few more to the group, to swipe
  // through (#74). The answer is the fresh list of events, which goes
  // straight into the cache the header badge reads; the suggester then
  // answers the dates themselves, right away.
  const suggest = useMutation({
    mutationFn: suggestEvent,
    onSuccess: (data) => {
      queryClient.setQueryData(eventsQueryKey(userId ?? ""), data.events);
      navigate(phone ? `/events/${data.createdId}/dates` : `/events/${data.createdId}`);
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
  async function sendSuggestion() {
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
    const dates = pickCandidates(
      fresh ?? participants,
      search,
      { first, end: searchWindow.end, count: extras.dateCount },
      TZ,
    );
    suggest.mutate({
      groupId,
      // A name left empty is stored as the matching type's name, which each
      // reader sees in their own language (eventTitle.ts).
      title: name.trim() || storedEventTitle(fallbackTitleId(search)),
      settings: search,
      dates: dates.map((d) => ({ start: d.slot.start, end: d.slot.end })),
      place: extras.place,
      note: extras.note,
      answerDays: extras.answerDays,
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
  // What the boxes below fade on: a different group's numbers.
  const fadeKey = activeGroupId ?? "none";

  // Still there after stepping past the last date, so the way back never
  // disappears.
  const actions = !waiting && (slot || steps.index > 0) && (
    <AnswerActions
      canStepBack={steps.index > 0}
      canStepOn={!!slot}
      onStepBack={() => setSteps(back)}
      onStepOn={stepOn}
      approving={review.tone === "approve"}
      onAccept={() => slot && setSteps((s) => accept(s, slot.start))}
      canSuggest={canSuggest}
      checking={checking}
      suggesting={suggest.isPending}
      suggested={suggested}
      onSuggest={() => void sendSuggestion()}
    />
  );
  const showMoved =
    !!moved && moved.groupId === activeGroup?.id && moved.start === (slot?.start ?? null);
  const hint = suggested ? (
    t.scheduler.sent(
      <Link to="/events" className="font-medium text-foreground underline underline-offset-2">
        {t.scheduler.sentLink}
      </Link>,
    )
  ) : showMoved ? (
    <span className="font-medium text-foreground">
      {moved.when === "suggest" ? t.scheduler.changedBeforeSending : t.scheduler.refreshedDate}
    </span>
  ) : suggestIsForThis && suggest.isError ? (
    <span className="text-red-700">{suggest.error.message}</span>
  ) : !user ? (
    t.scheduler.hintSignIn
  ) : activeGroup?.isExample ? (
    t.scheduler.hintExample
  ) : review.tone === "approve" ? (
    t.scheduler.hintAccept
  ) : (
    t.scheduler.hintEveryone(extras.dateCount)
  );

  // Who the event is for (#89): the active group's members and this group's choice.
  const participantProps = {
    members: activeGroup?.members ?? [],
    choice: peopleChoice,
    onChange: updatePeople,
    meeting: !sched.multiDay,
    example: !activeGroup || activeGroup.isExample,
  };

  const settingsProps = {
    groupSwitcher:
      groups && activeGroupId ? (
        <GroupSwitcher
          groups={groups}
          selectedId={activeGroupId}
          onChange={selectGroup}
          onCreate={openNewGroup}
        />
      ) : (
        <div className="h-[42px] rounded-lg border bg-background" />
      ),
    name,
    onName: setName,
    settings: sched,
    onChange: updateSettings,
  };

  return (
    <div className="min-h-screen bg-background">
      <TopNav />

      {/* The answer first: what the group is planning on top, then the date
          that works for everyone, big, then the month day by day so you can
          see why. Everything about the group itself sits at the bottom. */}
      <div className="mx-auto flex max-w-[90rem] flex-col gap-2 px-4 pb-6 pt-2 sm:gap-5 sm:px-6 sm:pb-16 sm:pt-4 lg:px-10">
        <div
          onPointerDownCapture={stopCarousel}
          onFocusCapture={stopCarousel}
          className="flex flex-col gap-2 sm:gap-5"
        >
          {/* The settings and the answer: the sentence above the answer on
              narrower screens, side by side and equally tall on a wide one
              (#98), where the settings box takes the bar's old place. */}
          <div className="flex flex-col gap-2 sm:gap-5 xl:grid xl:grid-cols-2 xl:items-stretch">
            <SettingsSentence {...settingsProps} />
            <AnswerCard
              fadeKey={fadeKey}
              waiting={waiting}
              review={review}
              search={search}
              slot={slot}
              name={name}
              checkers={checkers}
              edge={edge}
              actions={actions}
              hint={hint}
            />
            <SettingsPanel
              {...settingsProps}
              extras={extras}
              onExtras={updateExtras}
              participants={participantProps}
            />
          </div>
          {/* The start times are Danish time. */}
          <DanishTimeNote className="px-1" />

          {chartMonth && (
            <DayChart
              month={chartMonth}
              bestDays={days}
              timeZone={TZ}
              canPrev={viewMonth > FIRST_MONTH}
              canNext={viewMonth < LAST_MONTH}
              onPrev={() => pageMonth(-1)}
              onNext={() => pageMonth(1)}
              onPickDay={pickDay}
              conditionalKind={search.kind === "single" ? "skip" : "timeOff"}
              swapKey={fadeKey}
              loading={loadingGroup}
            />
          )}

          <LaterDates
            loading={loadingGroup}
            fadeKey={fadeKey}
            search={search}
            needsTimeOff={!!slot}
            suggestions={suggestions}
            later={later}
            groupSize={peopleForSearch(participants ?? [], search.people).searched.length}
            onUseSuggestion={adoptSuggestion}
            onPick={(start) => pickDay(dayOf(start, TZ))}
          />
        </div>

        {activeGroup && !activeGroup.isExample ? (
          <GroupPanel
            key={activeGroup.id}
            group={activeGroup}
            busyLoading={busyLoading}
            note={
              busyFailed
                ? t.scheduler.busyFailed
                : busyLoading
                  ? t.scheduler.busyLoading
                  : t.scheduler.realTimes
            }
            onLeft={() => selectGroup(null)}
          />
        ) : (
          <ExampleGroupPanel
            participants={activeGroup?.participants ?? []}
            myCalendarsFailed={myCalendarsFailed}
          />
        )}
      </div>

      {/* A phone's actions, pinned above the tab bar (TabBar) while the page
          scrolls. Sticky rather than fixed, so at the very end it comes to
          rest above the footer instead of covering it. */}
      {actions && (
        <div className="sticky bottom-[var(--tab-bar-height)] z-30 flex gap-2 border-t bg-card px-4 pb-2 pt-2 shadow-[0_-8px_24px_-16px_rgba(0,0,0,0.25)] sm:hidden">
          {actions}
        </div>
      )}

      {moreSettings && (
        <MoreSettingsScreen
          back={location.pathname}
          extras={extras}
          onExtras={updateExtras}
          participants={participantProps}
        />
      )}

      <NewGroupDialog
        open={newGroupOpen}
        submitting={create.isPending}
        error={create.error?.message ?? null}
        onSubmit={(group) => create.mutate(group)}
        onCancel={() => setNewGroupOpen(false)}
      />
    </div>
  );
}
