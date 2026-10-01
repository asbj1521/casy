import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";

import { eventsQueryKey, suggestEvent } from "@/api/events";
import { createGroup, groupsQueryKey } from "@/api/groups";
import DayChart from "@/components/DayChart";
import AnswerActions from "@/components/findDate/AnswerActions";
import AnswerCard from "@/components/findDate/AnswerCard";
import ExampleGroupPanel from "@/components/findDate/ExampleGroupPanel";
import GroupPanel from "@/components/findDate/GroupPanel";
import LaterDates from "@/components/findDate/LaterDates";
import GroupSwitcher from "@/components/GroupSwitcher";
import NewGroupDialog from "@/components/NewGroupDialog";
import { SettingsBar, SettingsSentence } from "@/components/SchedulerSettings";
import TopNav from "@/components/TopNav";
import { useAuth } from "@/context/auth";
import { TODAY, useDateSearch } from "@/hooks/useDateSearch";
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
import type { VacationSuggestion } from "@/lib/availability";
import { edgeWarnings } from "@/lib/earlyMorning";
import { SEARCH_WINDOW } from "@/lib/eventSearch";
import { monthAvailability } from "@/lib/monthAvailability";
import {
  fallbackTitleId,
  MAX_TRIP_DAYS,
  randomDefaultSettings,
  reviewAnswer,
  settingsToSearch,
  type SchedulerSettings,
} from "@/lib/scheduler";
import { readStored, writeStored } from "@/lib/storage";
import { addDays, APP_TIME_ZONE, dayOf, localDate, startOfMonth } from "@/lib/zone";

/** The zone every search and every day on this page is local to. */
const TZ = APP_TIME_ZONE;

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
  const queryClient = useQueryClient();

  // The page as this person left it earlier in this visit, if they did;
  // otherwise it starts fresh, with random settings.
  const [left] = useState(() => (pageMemory?.userId === userId ? pageMemory : null));
  const [selectedGroupId, setSelectedGroupId] = useState(left?.selectedGroupId ?? null);
  // What the event is called: only for the group to read, never searched on.
  const [name, setName] = useState(left?.name ?? "");
  const [sched, setSched] = useState(() => left?.sched ?? randomDefaultSettings());
  const [steps, setSteps] = useState(() => left?.steps ?? restart());
  // Once the answer moves on from the date it was paged from, the chart
  // follows the answer again.
  const [monthPick, setMonthPick] = useState(left?.monthPick ?? null);
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  useEffect(() => {
    pageMemory = { userId, name, sched, selectedGroupId, steps, monthPick };
  }, [userId, name, sched, selectedGroupId, steps, monthPick]);

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
  const search = useMemo(() => settingsToSearch(deferredSched), [deferredSched]);

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
  );
  const slot = found?.slot ?? null;
  const review = reviewAnswer(found, search, youProfileId, steps.accepted);

  // The chart shows the answer's month unless a month was paged to by hand
  // for this same answer.
  const viewMonth =
    monthPick && monthPick.anchor === firstDay
      ? monthPick.month
      : Math.min(
          Math.max(firstDay ? startOfMonth(Date.parse(firstDay), TZ) : FIRST_MONTH, FIRST_MONTH),
          LAST_MONTH,
        );
  // While loading, an empty month gives the chart its frame (DayChart's `loading`).
  const chartMonth = useMemo(() => {
    if (!participants && !loadingGroup) return null;
    const { year, month } = localDate(viewMonth, TZ);
    return monthAvailability(participants ?? [], search, year, month, {
      timeZone: TZ,
      todayMs: Date.parse(TODAY),
      windowEndMs: Date.parse(SEARCH_WINDOW.end),
      locale: LOCALE[lang],
    });
  }, [lang, participants, loadingGroup, viewMonth, search]);

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

  // Suggesting the date on screen to the group. The answer is the fresh list
  // of events, which goes straight into the cache the header badge reads.
  const suggest = useMutation({
    mutationFn: suggestEvent,
    onSuccess: (data) => queryClient.setQueryData(eventsQueryKey(userId ?? ""), data.events),
  });
  // Suggesting needs a signed-in person, a real group, a date, and your
  // sign-off on any time off it would cost you.
  const canSuggest =
    !!user && !!activeGroup && !activeGroup.isExample && !!slot && review.tone !== "approve";
  function sendSuggestion() {
    if (!activeGroup || !slot) return;
    suggest.mutate({
      groupId: activeGroup.id,
      // A name left empty is stored as the matching type's name, which each
      // reader sees in their own language (eventTitle.ts).
      title: name.trim() || storedEventTitle(fallbackTitleId(search)),
      settings: search,
      date: { start: slot.start, end: slot.end },
    });
  }
  // How sending went belongs to the exact date it was for: switch group, step
  // to another date or change a setting, and it stops showing.
  const sentFor = suggest.variables;
  const suggestIsForThis =
    !!sentFor && sentFor.groupId === activeGroup?.id && sentFor.date.start === slot?.start;
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
      suggesting={suggest.isPending}
      suggested={suggested}
      onSuggest={sendSuggestion}
    />
  );
  const hint = suggested ? (
    t.scheduler.sent(
      <Link to="/events" className="font-medium text-foreground underline underline-offset-2">
        {t.scheduler.sentLink}
      </Link>,
    )
  ) : suggestIsForThis && suggest.isError ? (
    <span className="text-red-700">{suggest.error.message}</span>
  ) : !user ? (
    t.scheduler.hintSignIn
  ) : activeGroup?.isExample ? (
    t.scheduler.hintExample
  ) : review.tone === "approve" ? (
    t.scheduler.hintAccept
  ) : (
    t.scheduler.hintEveryone
  );

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
          <SettingsBar {...settingsProps} />
          <SettingsSentence {...settingsProps} />

          <AnswerCard
            fadeKey={fadeKey}
            waiting={waiting}
            review={review}
            search={search}
            slot={slot}
            name={name}
            edge={edge}
            actions={actions}
            hint={hint}
          />

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
            groupSize={participants?.length ?? 0}
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

      {/* A phone's actions, pinned to the bottom of the screen while the page
          scrolls. Sticky rather than fixed, so at the very end it comes to
          rest above the footer instead of covering it. */}
      {actions && (
        <div className="sticky bottom-0 z-30 flex gap-2 border-t bg-card px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_24px_-16px_rgba(0,0,0,0.25)] sm:hidden">
          {actions}
        </div>
      )}

      <NewGroupDialog
        open={newGroupOpen}
        submitting={create.isPending}
        error={create.error?.message ?? null}
        onSubmit={(groupName) => create.mutate(groupName)}
        onCancel={() => setNewGroupOpen(false)}
      />
    </div>
  );
}
