import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  Copy,
  Hourglass,
  Lightbulb,
  Loader2,
  Send,
} from "lucide-react";

import { eventsQueryKey, suggestEvent } from "@/api/events";
import {
  createGroup,
  createInvite,
  groupsQueryKey,
  leaveGroup,
  type Group,
} from "@/api/groups";
import { SEARCH_WINDOW } from "@/api/mockData";
import {
  findVacationSuggestions,
  type MultiDayResult,
  type VacationSuggestion,
} from "@/lib/availability";
import { findEventSlot, type EventSettings } from "@/lib/eventSearch";
import { buildMonthGrid } from "@/lib/heatmap";
import { useSchedulingGroups } from "@/hooks/useSchedulingGroups";
import { useAuth } from "@/context/auth";
import { storedEventTitle } from "@/i18n/eventTitle";
import { LOCALE, useLang, useT } from "@/i18n/lang";
import { formatDaySpan, formatLongDate, formatLongSpan, formatTime } from "@/lib/format";
import { nameList } from "@/lib/myEvents";
import { avatarColor } from "@/lib/avatar";
import { dayOf, monthStartMs } from "@/lib/day";
import {
  daysUntil,
  fallbackTitleId,
  laterSlots,
  MAX_TRIP_DAYS,
  settingsToSearch,
  type SchedulerSettings,
} from "@/lib/scheduler";
import { ALL_DOWS } from "@/lib/weekdays";
import { cn } from "@/lib/utils";
import { addDays, APP_TIME_ZONE, localDate, startOfMonth } from "@/lib/zone";
import DayChart from "@/components/DayChart";
import GroupPanel from "@/components/GroupPanel";
import GroupSwitcher from "@/components/GroupSwitcher";
import NewGroupDialog from "@/components/NewGroupDialog";
import { SettingsBar, SettingsSentence } from "@/components/SchedulerSettings";
import TopNav from "@/components/TopNav";

/**
 * The zone every search and every day on this page is local to. One constant
 * for now; once groups exist for real, each group carries its own.
 */
const TZ = APP_TIME_ZONE;

/**
 * The real group you last scheduled for, per account, so a reload opens on
 * it rather than on your first group. Only a convenience: if storage is
 * blocked, or the group is gone, the page simply starts on the first group.
 */
const lastGroupKey = (userId: string) => `casy-last-group:${userId}`;

function readLastGroup(userId: string): string | null {
  try {
    return localStorage.getItem(lastGroupKey(userId));
  } catch {
    return null;
  }
}

function writeLastGroup(userId: string, groupId: string) {
  try {
    localStorage.setItem(lastGroupKey(userId), groupId);
  } catch {
    // Not remembered; the first group it is next time.
  }
}

/** Today as a local-midnight ISO (computed once), for "om 11 dage" and the chart. */
const TODAY_DAY = dayOf(new Date().toISOString(), TZ);

/** First-of-month (ms) for the month containing today. */
const DEFAULT_MONTH = monthStartMs(Date.parse(TODAY_DAY), TZ);
/** Navigable month range: from this month up to the last month with data. */
const MIN_MONTH = Math.max(
  DEFAULT_MONTH,
  monthStartMs(Date.parse(SEARCH_WINDOW.start), TZ),
);
const MAX_MONTH = monthStartMs(Date.parse(SEARCH_WINDOW.end) - 1, TZ);

/**
 * Where every search starts from: today, or the window start if that's later.
 * The past is never searched.
 */
const SEARCH_BASE =
  Date.parse(TODAY_DAY) > Date.parse(SEARCH_WINDOW.start)
    ? TODAY_DAY
    : SEARCH_WINDOW.start;

/**
 * Where a search begins: the day asked for, but for a meeting never a moment
 * already gone, so at 20:00 today's 18:00 isn't offered. (The engine trims a
 * day's window to the search start, and a window cut short no longer fits
 * the meeting.) Trips and holidays are whole days and keep today.
 */
function searchStartFor(search: EventSettings, from: string | null): string {
  const base = from ?? SEARCH_BASE;
  if (search.kind !== "single") return base;
  return new Date(Math.max(Date.parse(base), Date.now())).toISOString();
}

/** What the page opens on: an evening, every day; a weekend trip if switched. */
const DEFAULT_SETTINGS: SchedulerSettings = {
  multiDay: false,
  startHour: 18,
  durationMinutes: 180,
  dows: ALL_DOWS,
  days: 3,
  startDow: 5,
};

/** How many later dates the "Også muligt" row offers. */
const LATER_COUNT = 3;

export default function FindDate() {
  const t = useT();
  const { lang } = useLang();
  const [copied, setCopied] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  // What the event is called: only for the group to read, never searched on.
  const [name, setName] = useState("");
  const [sched, setSched] = useState<SchedulerSettings>(DEFAULT_SETTINGS);
  // Multi-day spans with work/school conflicts need the user's sign-off; this
  // holds the slot start they accepted (null = nothing accepted yet).
  const [acceptedSlot, setAcceptedSlot] = useState<string | null>(null);
  // The answer follows the settings: history[0] is the first date from today
  // (null), and each later entry is where a step forward (or a picked day)
  // searched from. historyIndex is which one is on screen; back only replays.
  // Changing a setting starts over from today.
  const [history, setHistory] = useState<(string | null)[]>([null]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const searchFrom = history[historyIndex] ?? null;
  // A month paged to by hand, remembered for the answer it was paged from:
  // once the answer moves, the chart follows it again.
  const [monthPick, setMonthPick] = useState<{ month: number; anchor: string | null } | null>(
    null,
  );
  const copiedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Don't leave the "Copied!" timer running after the page goes away.
  useEffect(() => () => clearTimeout(copiedTimer.current), []);

  // Real groups and everyone's real busy time, or the labelled example group
  // for someone who has not made a group yet. See the hook for which is which.
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // The group you last scheduled for, read once your account is known. A
  // group picked on this visit wins; a remembered one that's gone falls back
  // to the first group, like any unknown id.
  const userId = user?.id ?? null;
  const rememberedGroupId = useMemo(() => (userId ? readLastGroup(userId) : null), [userId]);
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
    if (userId && rememberableGroupId) writeLastGroup(userId, rememberableGroupId);
  }, [userId, rememberableGroupId]);

  /**
   * Any touch of the settings or the answer stops the example carousel, for
   * good: if you are using the page, it is not a demo any more. Pinning the
   * current example as the selection too, so it can't move on between the
   * click and the next render.
   */
  function stopCarousel() {
    if (!carousel.running) return;
    setSelectedGroupId((id) => id ?? activeGroupId);
    carousel.stop();
  }

  // Anything that changes membership answers with the new list of groups, so
  // the cache is filled from the reply instead of asking for it again.
  const onGroupsChanged = (data: { groups: Group[] }) => {
    queryClient.setQueryData(groupsQueryKey(user?.id ?? ""), data.groups);
  };

  const createMutation = useMutation({
    mutationFn: createGroup,
    onSuccess: (data) => {
      onGroupsChanged(data);
      setSelectedGroupId(data.createdId);
      setNewGroupOpen(false);
    },
  });

  const inviteMutation = useMutation({ mutationFn: createInvite });

  // Suggesting the date on screen to the group. The answer is the fresh list
  // of events, which goes straight into the cache the header badge reads.
  const suggestMutation = useMutation({
    mutationFn: suggestEvent,
    onSuccess: (data) => queryClient.setQueryData(eventsQueryKey(user?.id ?? ""), data.events),
  });

  const leaveMutation = useMutation({
    mutationFn: leaveGroup,
    onSuccess: (data) => {
      onGroupsChanged(data);
      setSelectedGroupId(null);
      inviteMutation.reset();
    },
  });

  // A link belongs to the group it was made for; switching groups must not
  // leave the previous group's invite on screen.
  const invite =
    inviteMutation.data && inviteMutation.variables === activeGroupId
      ? inviteMutation.data
      : null;

  // What is being searched for, as data. The same settings travel with a
  // suggested event, so a decline re-runs exactly this search (eventSearch.ts).
  // The controls show a change at once; the search (a few to a few dozen ms,
  // several times that on a slow phone) follows a beat later, so tapping +
  // a few times in a row never stutters.
  const deferredSched = useDeferredValue(sched);
  const search = useMemo(() => settingsToSearch(deferredSched), [deferredSched]);
  const isMultiDay = search.kind !== "single";

  // The search itself, cheap and pure, so it simply follows the settings:
  // single meetings need the whole group free at that hour; multi-day spans
  // let work/school through as conflicts to review.
  // Nothing to search until someone's calendar is in: while a real group's
  // calendars load, if they fail, or if nobody has linked one, there are no
  // participants, and "everyone" would be free today.
  const searchable = !!activeGroup && !busyLoading && activeGroup.participants.length > 0;
  const found = useMemo<MultiDayResult | null>(() => {
    if (!activeGroup || !searchable) return null;
    return findEventSlot(
      activeGroup.participants,
      search,
      searchStartFor(search, searchFrom),
      SEARCH_WINDOW.end,
      TZ,
    );
  }, [activeGroup, searchable, search, searchFrom]);
  const activeSlot = found?.slot ?? null;
  const result = isMultiDay ? null : found;
  const multiResult = isMultiDay ? found : null;

  // Workarounds for vacations that don't work cleanly: "6 days works for
  // everyone if you leave after work Friday" and the like.
  const suggestions = useMemo<VacationSuggestion[]>(() => {
    if (search.kind !== "vacation" || !activeGroup || !multiResult) return [];
    if (multiResult.slot && multiResult.conflicts.length === 0) return [];
    return findVacationSuggestions(
      activeGroup.participants,
      search.days,
      searchFrom ?? SEARCH_BASE,
      SEARCH_WINDOW.end,
      TZ,
    );
  }, [search, activeGroup, multiResult, searchFrom]);

  // The next few dates after the one on screen, found by the same search.
  const later = useMemo(() => {
    if (!activeGroup || !activeSlot || suggestions.length > 0) return [];
    return laterSlots(
      activeGroup.participants,
      search,
      activeSlot.start,
      LATER_COUNT,
      SEARCH_WINDOW.end,
      TZ,
    );
  }, [activeGroup, activeSlot, search, suggestions]);

  // The day (local-midnight ISO) the answer starts on, and every day it covers.
  const bestDay = activeSlot ? dayOf(activeSlot.start, TZ) : null;
  const spanDays =
    search.kind === "vacation" ? search.days : search.kind === "trip" ? search.shape.spanDays : 1;
  const bestDays = useMemo(() => {
    const set = new Set<string>();
    if (!bestDay) return set;
    for (let i = 0; i < spanDays; i++) {
      set.add(new Date(addDays(Date.parse(bestDay), i, TZ)).toISOString());
    }
    return set;
  }, [bestDay, spanDays]);

  // The chart shows the answer's month unless a month was paged to by hand
  // for this same answer.
  const answerMonth = bestDay ? monthStartMs(Date.parse(bestDay), TZ) : DEFAULT_MONTH;
  const viewMonth =
    monthPick && monthPick.anchor === bestDay
      ? monthPick.month
      : Math.min(Math.max(answerMonth, MIN_MONTH), MAX_MONTH);

  // The month, day by day, for the chart under the answer.
  const monthGrid = useMemo(() => {
    if (!activeGroup || !searchable) return null;
    const vm = localDate(viewMonth, TZ);
    return buildMonthGrid(activeGroup.participants, vm.year, vm.month, {
      timeZone: TZ,
      startHour: deferredSched.startHour,
      durationMinutes: deferredSched.durationMinutes,
      todayMs: Date.parse(TODAY_DAY),
      allowedDays: search.kind === "single" ? search.allowedDays : undefined,
      multiDay:
        search.kind === "vacation" ? { windowEndMs: Date.parse(SEARCH_WINDOW.end) } : undefined,
      weeklySpan:
        search.kind === "trip"
          ? { ...search.shape, windowEndMs: Date.parse(SEARCH_WINDOW.end) }
          : undefined,
      locale: LOCALE[lang],
    });
  }, [lang, activeGroup, searchable, viewMonth, deferredSched, search]);

  /** Back to the first date from today: any setting or group change does this. */
  function resetSearch() {
    setHistory([null]);
    setHistoryIndex(0);
    setAcceptedSlot(null);
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
    resetSearch();
  }

  /** Show the first date on or after `dayIso`, keeping the way back. */
  function jumpTo(dayIso: string) {
    setHistory((h) => [...h.slice(0, historyIndex + 1), dayIso]);
    setHistoryIndex(historyIndex + 1);
    setAcceptedSlot(null);
  }

  /**
   * A day clicked in the chart. For a trip, any day of it means that trip:
   * search from the day it starts (never before today), or clicking the
   * Saturday of a free weekend would jump to the weekend after.
   */
  function pickDay(dayIso: string) {
    if (search.kind !== "trip") return jumpTo(dayIso);
    const day = Date.parse(dayIso);
    const offset = (localDate(day, TZ).dow - search.shape.anchorDow + 7) % 7;
    const start = Math.max(addDays(day, -offset, TZ), Date.parse(SEARCH_BASE));
    jumpTo(new Date(start).toISOString());
  }

  /** Adopt a suggested workaround: shorter stay, anchored on its dates. */
  function applySuggestion(s: VacationSuggestion) {
    setSched((prev) => ({ ...prev, days: s.days }));
    setHistory([dayOf(s.slot.start, TZ)]);
    setHistoryIndex(0);
    setAcceptedSlot(null);
  }

  function handleSelectGroup(id: string) {
    setSelectedGroupId(id);
    resetSearch(); // a new group's first date starts from today
    inviteMutation.reset(); // a link belongs to the group it was made for
  }

  /**
   * "New group" from the switcher. Making a group needs an account, since a
   * group with no owner is nobody's; anyone signed out is sent to sign in
   * first and comes straight back here.
   */
  function handleNewGroup() {
    if (!user) {
      navigate("/sign-in?next=/");
      return;
    }
    createMutation.reset();
    setNewGroupOpen(true);
  }

  /** Step the chart a month back (-1) or forward (+1), within the data range. */
  function pageMonth(delta: number) {
    const month = startOfMonth(viewMonth, TZ, delta);
    if (month < MIN_MONTH || month > MAX_MONTH) return;
    setMonthPick({ month, anchor: bestDay });
  }

  /**
   * Step forward: if the next date was already found earlier (the user
   * stepped back), show it again; otherwise search past the current one.
   */
  function handleFindNext() {
    if (!activeSlot) return;
    if (historyIndex + 1 < history.length) {
      setHistoryIndex(historyIndex + 1);
      setAcceptedSlot(null);
    } else {
      jumpTo(new Date(addDays(Date.parse(activeSlot.start), 1, TZ)).toISOString());
    }
  }

  /** Step back to the date shown just before this one. Never searches. */
  function handleFindPrev() {
    if (historyIndex <= 0) return;
    setHistoryIndex(historyIndex - 1);
    setAcceptedSlot(null);
  }

  /** Suggest the date on screen to everyone in the group. */
  function handleSuggest() {
    if (!activeGroup || !activeSlot) return;
    suggestMutation.mutate({
      groupId: activeGroup.id,
      // A name left empty is stored as the matching type's name, which each
      // reader sees in their own language (eventTitle.ts).
      title: name.trim() || storedEventTitle(fallbackTitleId(search)),
      settings: search,
      date: { start: activeSlot.start, end: activeSlot.end },
    });
  }

  function handleCopy() {
    navigator.clipboard?.writeText(window.location.href).catch(() => {});
    setCopied(true);
    clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), 1800);
  }

  // The big answer: the date (or span), and the times plus how far away it is.
  const headline = activeSlot
    ? search.kind === "single"
      ? formatLongDate(activeSlot.start, lang)
      : formatLongSpan(activeSlot.start, activeSlot.end, lang)
    : null;
  const subline = activeSlot
    ? [
        search.kind === "single"
          ? t.scheduler.timeRange(formatTime(activeSlot.start), formatTime(activeSlot.end))
          : search.kind === "trip"
            ? t.scheduler.tripTimes(formatTime(activeSlot.start), formatTime(activeSlot.end))
            : t.common.days(search.days),
        t.scheduler.inDays(daysUntil(dayOf(activeSlot.start, TZ), TODAY_DAY)),
      ].join(" · ")
    : null;

  // Conflict review state for multi-day spans. Your own work/school conflicts
  // need your explicit approval; other people's put the dates under review.
  const selfConflict =
    multiResult?.conflicts.find((c) => c.profileId === youProfileId) ?? null;
  const otherConflicts =
    multiResult?.conflicts.filter((c) => c.profileId !== youProfileId) ?? [];
  const selfAccepted =
    multiResult?.slot != null && acceptedSlot === multiResult.slot.start;
  const needsSelfApproval = selfConflict !== null && !selfAccepted;
  // Dates that clash with your own work/school wait for your "Accept" before
  // they can go to the group.
  const awaitingYourApproval = isMultiDay && !!activeSlot && needsSelfApproval;

  // Suggesting needs a signed-in person, a real group, a date to suggest, and
  // your sign-off on any time off it would cost you.
  const canSuggest =
    !!user &&
    !!activeGroup &&
    !activeGroup.isExample &&
    !!activeSlot &&
    !awaitingYourApproval;
  // Success and errors belong to the exact date they were for: switch group,
  // step to another date or change a setting, and they stop showing.
  const suggestedFor = suggestMutation.variables;
  const suggestIsForThis =
    !!suggestedFor &&
    suggestedFor.groupId === activeGroup?.id &&
    suggestedFor.date.start === activeSlot?.start;
  const suggestedThis = suggestIsForThis && suggestMutation.isSuccess;
  const suggestError =
    suggestIsForThis && suggestMutation.isError ? suggestMutation.error.message : null;
  // A single meeting that needs someone to skip something they marked
  // skippable: what you'd skip, and who else would skip something.
  const skipConflicts = !isMultiDay && activeSlot ? (result?.conflicts ?? []) : [];
  const yourSkip = skipConflicts.find((c) => c.profileId === youProfileId) ?? null;
  const othersSkipping = skipConflicts.filter((c) => c.profileId !== youProfileId);

  // Unique titles of your own conflicting commitments: a generated title like
  // "Arbejde", or with real data the name of the calendar, e.g. "Work".
  const selfConflictTitles = selfConflict
    ? [...new Set(selfConflict.events.map((e) => e.title ?? t.scheduler.aCommitment))]
        .slice(0, 3)
        .join(", ")
    : "";
  const yourSkipTitles = yourSkip
    ? [...new Set(yourSkip.events.map((e) => e.title ?? t.scheduler.aCommitment))]
        .slice(0, 3)
        .join(", ")
    : "";

  // The answer's tone: the plain "everyone can" in orange, or one of the
  // review states the old banner had, in their own colours.
  const conflicts = found?.conflicts ?? [];
  // Why there is nothing to search yet, if there isn't: said plainly, never
  // as the red "no date works" box.
  const waitingText = !activeGroup
    ? t.common.loading
    : busyLoading
      ? t.scheduler.busyLoading
      : activeGroup.participants.length === 0
        ? busyFailed
          ? t.scheduler.busyFailed
          : t.scheduler.noCalendars
        : null;
  const tone = waitingText
    ? "waiting"
    : !activeSlot
      ? "none"
    : isMultiDay && needsSelfApproval
      ? "approve"
      : isMultiDay && otherConflicts.length > 0
        ? "review"
        : skipConflicts.length > 0
          ? "skip"
          : "clean";
  const kicker =
    tone === "approve"
      ? t.scheduler.needsApproval
      : tone === "review"
        ? t.scheduler.underReview
        : tone === "skip"
          ? t.scheduler.worksIfSkipping
          : t.scheduler.kickerAll(name.trim());
  const participants = activeGroup?.participants ?? [];
  const conflictIds = new Set(conflicts.map((c) => c.profileId));

  const groupSwitcher =
    groups && activeGroupId ? (
      <GroupSwitcher
        groups={groups}
        selectedId={activeGroupId}
        onChange={handleSelectGroup}
        onCreate={handleNewGroup}
        variant="hero"
      />
    ) : (
      <div className="h-[42px] rounded-lg border bg-background" />
    );

  // Step back, step on, and send (or first accept the time off). Drawn in the
  // answer card on wider screens and in the bottom bar on a phone. Still there
  // after stepping past the last date, so the way back never disappears.
  const actionButtons = tone !== "waiting" && (activeSlot || historyIndex > 0) && (
    <>
      <button
        type="button"
        onClick={handleFindPrev}
        disabled={historyIndex <= 0}
        aria-label={t.scheduler.previousTime}
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border bg-card text-foreground transition hover:bg-secondary disabled:opacity-30"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={handleFindNext}
        disabled={!activeSlot}
        className="h-12 min-w-0 flex-1 truncate rounded-xl border bg-card px-3 text-[15px] font-semibold text-foreground transition hover:bg-secondary disabled:opacity-30 sm:flex-none sm:px-4"
      >
        <span className="sm:hidden">{t.scheduler.nextShort}</span>
        <span className="hidden sm:inline">{t.scheduler.nextOption}</span>
      </button>
      {tone === "approve" ? (
        <button
          type="button"
          onClick={() => setAcceptedSlot(activeSlot?.start ?? null)}
          className="inline-flex h-12 min-w-0 flex-[2] items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 text-[15px] font-bold text-white transition hover:bg-amber-700 sm:flex-none sm:px-5"
        >
          <Check className="h-5 w-5 shrink-0" />
          {t.scheduler.accept}
        </button>
      ) : (
        <button
          type="button"
          onClick={handleSuggest}
          disabled={!canSuggest || suggestMutation.isPending || suggestedThis}
          className="inline-flex h-12 min-w-0 flex-[2] items-center justify-center gap-2 rounded-xl bg-orange-700 px-4 text-[15px] font-bold text-white transition hover:bg-orange-800 disabled:opacity-50 sm:flex-none sm:px-5"
        >
          {suggestMutation.isPending ? (
            <Loader2 className="h-5 w-5 shrink-0 animate-spin" />
          ) : suggestedThis ? (
            <Check className="h-5 w-5 shrink-0" />
          ) : (
            <Send className="h-5 w-5 shrink-0" />
          )}
          <span className="truncate">
            {suggestedThis ? (
              t.scheduler.suggested
            ) : (
              <>
                <span className="sm:hidden">{t.scheduler.suggestShort}</span>
                <span className="hidden sm:inline">{t.scheduler.suggest}</span>
              </>
            )}
          </span>
        </button>
      )}
    </>
  );

  const settingsProps = {
    groupSwitcher,
    name,
    onName: setName,
    settings: sched,
    onChange: updateSettings,
  };

  return (
    <div className="min-h-screen bg-background">
      <TopNav />

      {/*
        The answer first: what the group is planning on top, then the date
        that works for everyone, big, then the month day by day so you can
        see why. Everything about the group itself sits at the bottom.
      */}
      <div className="mx-auto flex max-w-[90rem] flex-col gap-3 px-4 pb-6 pt-2 sm:gap-5 sm:pt-4 sm:px-6 sm:pb-16 lg:px-10">
        <div
          onPointerDownCapture={stopCarousel}
          onFocusCapture={stopCarousel}
          className="flex flex-col gap-3 sm:gap-5"
        >
          <SettingsBar {...settingsProps} />
          <SettingsSentence {...settingsProps} />

          {/* ───────── The answer ───────── */}
          <section
            className={cn(
              "rounded-3xl border p-4 shadow-xl shadow-black/5 sm:p-8",
              tone === "none" && "border-rose-200 bg-rose-50",
              (tone === "approve" || tone === "skip") && "border-amber-300 bg-amber-50",
              tone === "review" && "border-sky-200 bg-sky-50",
              (tone === "clean" || tone === "waiting") && "bg-card",
            )}
          >
            {tone === "waiting" ? (
              <p className="flex items-center gap-2.5 text-base text-muted-foreground">
                {(!activeGroup || busyLoading) && <Loader2 className="h-5 w-5 shrink-0 animate-spin" />}
                {waitingText}
              </p>
            ) : tone === "none" ? (
              <>
                <p className="text-base text-rose-800">
                  {search.kind === "vacation"
                    ? t.scheduler.noVacation(search.days)
                    : search.kind === "trip"
                      ? t.scheduler.noTrip
                      : t.scheduler.noSingle(`${String(deferredSched.startHour).padStart(2, "0")}:00`)}
                </p>
                {/* Stepped past the last date: the way back stays. */}
                {actionButtons && (
                  <div className="mt-4 hidden items-center gap-2 sm:flex">{actionButtons}</div>
                )}
              </>
            ) : (
              <div className="flex flex-col gap-4 sm:gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <p
                    className={cn(
                      "flex items-center gap-2 text-xs font-bold uppercase tracking-wider sm:text-sm",
                      tone === "clean" && "text-orange-700",
                      (tone === "approve" || tone === "skip") && "text-amber-800",
                      tone === "review" && "text-sky-800",
                    )}
                  >
                    {tone === "approve" ? (
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                    ) : tone === "review" ? (
                      <Hourglass className="h-4 w-4 shrink-0" />
                    ) : (
                      <Check className="h-4 w-4 shrink-0" />
                    )}
                    <span className="truncate">{kicker}</span>
                  </p>
                  <h1 className="mt-1.5 text-[1.75rem] font-extrabold leading-[1.05] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                    {headline}
                  </h1>
                  <p className="mt-2 text-base text-muted-foreground sm:text-xl">{subline}</p>

                  {/* What the date costs, in the review states. */}
                  {tone === "approve" && (
                    <p className="mt-3 text-sm text-amber-900">
                      {t.scheduler.selfConflict(selfConflictTitles)}
                      {otherConflicts.length > 0 &&
                        t.scheduler.othersNeedTimeOff(
                          nameList(otherConflicts.map((c) => c.name), lang),
                        )}
                    </p>
                  )}
                  {tone === "review" && (
                    <p className="mt-3 text-sm text-sky-900">
                      {t.scheduler.othersMustApprove(
                        nameList(otherConflicts.map((c) => c.name), lang),
                        otherConflicts.length,
                      )}
                      {selfAccepted && t.scheduler.youApprovedTimeOff}
                    </p>
                  )}
                  {tone === "skip" && (
                    <p className="mt-3 text-sm text-amber-900">
                      {yourSkip && t.scheduler.youSkip(yourSkipTitles)}
                      {othersSkipping.length > 0 &&
                        t.scheduler.othersSkip(nameList(othersSkipping.map((c) => c.name), lang))}
                      {t.scheduler.skipWhy}
                    </p>
                  )}
                  {tone === "clean" && isMultiDay && selfAccepted && (
                    <p className="mt-3 text-sm text-muted-foreground">
                      {t.scheduler.youApprovedDates}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 flex-col gap-4 lg:items-end">
                  {/* Everyone in the search; someone who'd skip or take time
                      off is shown faded. */}
                  <div className="flex items-center gap-3">
                    <div className="flex">
                      {participants.map((p, i) => (
                        <span
                          key={p.profileId}
                          title={p.name}
                          className={cn(
                            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-card text-xs font-bold sm:h-9 sm:w-9 sm:border-[3px] sm:text-sm",
                            avatarColor(i),
                            i > 0 && "-ml-2 sm:-ml-2.5",
                            conflictIds.has(p.profileId) && "opacity-40",
                          )}
                        >
                          {p.name.trim().charAt(0).toUpperCase()}
                        </span>
                      ))}
                    </div>
                    <span className="whitespace-nowrap text-sm font-bold text-foreground">
                      {t.scheduler.countCan(participants.length - conflictIds.size, participants.length)}
                    </span>
                  </div>

                  {/* On a phone these live in the bar pinned to the bottom of
                      the screen instead, so the card stays short and the
                      chart under it is on the first screen. */}
                  <div className="hidden items-center gap-2 sm:flex">{actionButtons}</div>
                  <p className="text-xs text-muted-foreground sm:text-sm lg:max-w-xs lg:text-right">
                    {suggestedThis ? (
                      t.scheduler.sent(
                        <Link
                          to="/events"
                          className="font-medium text-foreground underline underline-offset-2"
                        >
                          {t.scheduler.sentLink}
                        </Link>,
                      )
                    ) : suggestError ? (
                      <span className="text-red-700">{suggestError}</span>
                    ) : !user ? (
                      t.scheduler.hintSignIn
                    ) : activeGroup?.isExample ? (
                      t.scheduler.hintExample
                    ) : awaitingYourApproval ? (
                      t.scheduler.hintAccept
                    ) : (
                      t.scheduler.hintEveryone
                    )}
                  </p>
                </div>
              </div>
            )}
          </section>

          {/* The month day by day, straight under the answer: it's what
              shows why the answer is what it is. */}
          {monthGrid && (
            <DayChart
              grid={monthGrid}
              bestDays={bestDays}
              timeZone={TZ}
              canPrev={viewMonth > MIN_MONTH}
              canNext={viewMonth < MAX_MONTH}
              onPrev={() => pageMonth(-1)}
              onNext={() => pageMonth(1)}
              onPickDay={pickDay}
              conditionalKind={isMultiDay ? "timeOff" : "skip"}
            />
          )}

          {/* Workarounds for a holiday that doesn't fit cleanly, or else the
              next few dates found by the same search. */}
          {suggestions.length > 0 ? (
            <div className="flex flex-col gap-2">
              {suggestions.map((s) => (
                <div
                  key={`${s.days}-${s.slot.start}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4"
                >
                  <div className="flex items-center gap-2.5 text-sm text-foreground">
                    <Lightbulb className="h-4 w-4 shrink-0 text-primary" />
                    <span>
                      {s.conflicts.length === 0
                        ? t.scheduler.suggestionFits(
                            deferredSched.days,
                            !!multiResult?.slot,
                            s.days,
                            formatDaySpan(s.slot.start, s.slot.end, lang),
                            (s.leaveAfterWork ? t.scheduler.leaveAfterWork : "") +
                              (s.homeBeforeWork ? t.scheduler.homeBeforeWork : ""),
                          )
                        : t.scheduler.closestWorkaround(
                            s.days,
                            formatDaySpan(s.slot.start, s.slot.end, lang),
                            nameList(s.conflicts.map((c) => c.name), lang),
                            s.conflicts.length,
                          )}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => applySuggestion(s)}
                    className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
                  >
                    {t.scheduler.useTheseDates}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            later.length > 0 && (
              // One compact line per date on a phone, three cards side by
              // side on anything wider.
              <div className="grid gap-2 sm:grid-cols-3 sm:gap-3">
                {later.map((r) => (
                  <button
                    key={r.slot!.start}
                    type="button"
                    onClick={() => jumpTo(dayOf(r.slot!.start, TZ))}
                    className="flex items-center justify-between gap-3 rounded-2xl border bg-card px-4 py-3 text-left transition hover:border-primary/40 hover:bg-secondary/40 sm:block sm:px-5 sm:py-4"
                  >
                    <span className="hidden text-xs text-muted-foreground sm:block">
                      {t.scheduler.alsoPossible}
                    </span>
                    <span className="block min-w-0 truncate text-[15px] font-bold text-foreground sm:mt-0.5 sm:text-lg">
                      {search.kind === "single"
                        ? formatLongDate(r.slot!.start, lang)
                        : formatLongSpan(r.slot!.start, r.slot!.end, lang)}
                    </span>
                    <span className="block shrink-0 text-sm text-muted-foreground sm:mt-0.5">
                      {t.scheduler.countCan(
                        participants.length - r.conflicts.length,
                        participants.length,
                      )}
                    </span>
                  </button>
                ))}
              </div>
            )
          )}
        </div>

        {/* ───────── The group ───────── */}
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
          <section className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-foreground">{t.scheduler.groupMembers}</h2>
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border bg-card px-3 py-2 text-sm font-medium text-foreground transition hover:bg-secondary"
              >
                {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                {copied ? t.scheduler.copiedLink : t.scheduler.copyLink}
              </button>
            </div>
            {/* Whose times are real. The example group is the only place
                generated calendars are still used, and it says so. */}
            <p className="mt-1 text-xs text-muted-foreground">
              {activeGroup?.isExample ? (
                !user ? (
                  t.scheduler.exampleSignedOut(
                    <Link to="/sign-in?next=/" className="font-medium text-foreground underline underline-offset-2">
                      {t.scheduler.exampleSignedOutLink}
                    </Link>,
                  )
                ) : myCalendarsFailed ? (
                  t.scheduler.exampleCalendarsFailed
                ) : (
                  t.scheduler.exampleSignedIn(
                    <Link to="/profile" className="font-medium text-foreground underline underline-offset-2">
                      {t.scheduler.exampleSignedInLink}
                    </Link>,
                  )
                )
              ) : busyFailed ? (
                t.scheduler.busyFailed
              ) : busyLoading ? (
                t.scheduler.busyLoading
              ) : (
                t.scheduler.realTimes
              )}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {participants.map((p, i) => (
                <span
                  key={p.profileId}
                  className="flex items-center gap-2 rounded-full border bg-card py-1 pl-1 pr-3"
                >
                  <span
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                      avatarColor(i),
                    )}
                  >
                    {p.name.charAt(0)}
                  </span>
                  <span className="text-sm text-foreground">{p.name}</span>
                </span>
              ))}
            </div>
          </section>

          {activeGroup && (
            <GroupPanel
              group={activeGroup}
              busyLoading={busyLoading}
              inviteUrl={invite?.url ?? null}
              inviteExpiresAt={invite?.expiresAt ?? null}
              invitePending={inviteMutation.isPending}
              inviteError={
                inviteMutation.error ? (inviteMutation.error as Error).message : null
              }
              onInvite={() => inviteMutation.mutate(activeGroup.id)}
              leavePending={leaveMutation.isPending}
              onLeave={() => leaveMutation.mutate(activeGroup.id)}
            />
          )}
        </div>
      </div>

      {/* A phone's actions, pinned to the bottom of the screen while the page
          scrolls. Sticky rather than fixed, so at the very end it comes to
          rest above the footer instead of covering it. */}
      {actionButtons && (
        <div className="sticky bottom-0 z-30 flex gap-2 border-t bg-card px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_-16px_rgba(0,0,0,0.25)] sm:hidden">
          {actionButtons}
        </div>
      )}

      <NewGroupDialog
        open={newGroupOpen}
        submitting={createMutation.isPending}
        error={createMutation.error ? (createMutation.error as Error).message : null}
        onSubmit={(groupName) => createMutation.mutate(groupName)}
        onCancel={() => setNewGroupOpen(false)}
      />
    </div>
  );
}
