import { lazy, Suspense, useState, type ComponentProps } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";

import DayChart from "@/components/DayChart";
import AnswerActions from "@/components/findDate/AnswerActions";
import AnswerCard from "@/components/findDate/AnswerCard";
import ExampleGroupPanel from "@/components/findDate/ExampleGroupPanel";
import GroupPanel from "@/components/findDate/GroupPanel";
import LaterDates from "@/components/findDate/LaterDates";
import MoreSettingsScreen from "@/components/findDate/MoreSettingsScreen";
import WidenSearch from "@/components/findDate/WidenSearch";
import GroupSwitcher from "@/components/GroupSwitcher";
import RequireAuth from "@/components/RequireAuth";
import { SettingsPanel, SettingsSentence } from "@/components/SchedulerSettings";
import TopNav from "@/components/TopNav";
import DanishTimeNote from "@/components/time/DanishTimeNote";
import { usePhoneLayout } from "@/hooks/usePhoneLayout";
import { FIRST_MONTH, LAST_MONTH, TZ, usePlanning } from "@/hooks/usePlanning";
import { useT } from "@/i18n/lang";
import { cn } from "@/lib/utils";
import { dayOf } from "@/lib/zone";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

// Planlæg med AI's view only loads once it is opened (#157).
const AiBoxView = lazy(() => import("@/components/findDate/ai/AiBoxView"));
const PlanSummary = lazy(() => import("@/components/findDate/ai/PlanSummary"));
const NewGroupDialog = lazy(() => import("@/components/NewGroupDialog"));
const AiActions = lazy(() =>
  import("@/components/findDate/ai/AiConversation").then((m) => ({ default: m.AiActions })),
);

/**
 * The scheduler's address (`/` signed in, `/plan`). A phone plans from My
 * calendar's Planlæg (#126, #127), so there it leads to the home page (the
 * calendar, #169), through sign-in for anyone signed out; a computer gets the scheduling page.
 */
export default function FindDate() {
  const phone = usePhoneLayout();
  if (phone) {
    return (
      <RequireAuth>
        <Navigate to="/" replace />
      </RequireAuth>
    );
  }
  return <SchedulingPage />;
}

/**
 * The scheduling page (computers and tablets): the settings on top, the
 * first date everyone can make under them, the month day by day, the next
 * few dates, and the group itself at the bottom. The planning itself (state,
 * search, sending) is usePlanning's.
 */
function SchedulingPage() {
  const t = useT();
  useDocumentTitle(t.nav.scheduler);
  // Flere indstillinger (#98), laid over the page while ?settings is set.
  const location = useLocation();
  const moreSettings = new URLSearchParams(location.search).has("settings");

  const {
    user,
    groups,
    activeGroup,
    activeGroupId,
    busyLoading,
    busyFailed,
    myCalendarsFailed,
    stopCarousel,
    selectGroup,
    peopleChoice,
    updatePeople,
    newGroupOpen,
    setNewGroupOpen,
    groupCreated,
    openNewGroup,
    name,
    setName,
    extras,
    updateExtras,
    sched,
    updateSettingsByHand,
    aiOn,
    planner,
    search,
    loadingGroup,
    suggestions,
    later,
    days,
    slot,
    review,
    steps,
    stepOn,
    stepBack: stepAnswerBack,
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
    viewMonth,
    chartMonth,
    pageMonth,
    canSuggest,
    checking,
    sending,
    suggest,
    suggested,
    suggestIsForThis,
    movedNote,
    sendSuggestion,
  } = usePlanning();
  // Whether Planlæg med AI's panel reaches down over the chart, and whether
  // more details are being written in it (a computer's box, #124).
  const [aiOverChart, setAiOverChart] = useState(false);
  const [aiAdding, setAiAdding] = useState(false);

  const actionProps = {
    canStepBack: steps.index > 0,
    canStepOn: !!slot,
    onStepBack: stepAnswerBack,
    onStepOn: stepOn,
    approving: review.tone === "approve",
    onAccept: acceptOwnTimeOff,
    canSuggest,
    checking,
    suggesting: sending,
    suggested,
    onSuggest: () => void sendSuggestion(),
  };
  // Still there after stepping past the last date, so the way back never
  // disappears.
  const actions = !waiting && (slot || steps.index > 0) && <AnswerActions {...actionProps} />;
  const hint = suggested ? (
    t.scheduler.sent(
      <Link to="/events" className="font-medium text-foreground underline underline-offset-2">
        {t.scheduler.sentLink}
      </Link>,
    )
  ) : movedNote ? (
    <span className="font-medium text-foreground">
      {movedNote === "suggest" ? t.scheduler.changedBeforeSending : t.scheduler.refreshedDate}
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
    onChange: updateSettingsByHand,
  };

  // The answer, the chart and the dates after it.
  const answerCardProps = {
    fadeKey,
    waiting,
    review,
    search,
    slot,
    name,
    checkers,
    outdated,
    edge,
    hint,
  };
  const chart = chartMonth && (
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
  );
  const laterDatesProps = {
    loading: loadingGroup,
    fadeKey,
    search,
    needsTimeOff: !!slot,
    suggestions,
    later,
    groupSize,
    onUseSuggestion: adoptSuggestion,
    onPick: (start: string) => pickDay(dayOf(start, TZ)),
  };
  const newGroupDialog = (
    <LazyNewGroupDialog
      open={newGroupOpen}
      onClose={() => setNewGroupOpen(false)}
      onCreated={groupCreated}
    />
  );

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
            <AnswerCard {...answerCardProps} actions={actions} />
            <SettingsPanel
              {...settingsProps}
              extras={extras}
              onExtras={updateExtras}
              participants={participantProps}
              onOverChart={setAiOverChart}
              ai={
                aiOn
                  ? {
                      view: () => (
                        <Suspense fallback={null}>
                          <AiBoxView
                            planner={planner}
                            members={activeGroup?.members ?? []}
                            adding={aiAdding}
                            onAdding={setAiAdding}
                            summary={
                              <PlanSummary
                                name={name}
                                settings={sched}
                                extras={extras}
                                members={activeGroup?.members ?? []}
                                choice={peopleChoice}
                                guessed={planner.session.guessed}
                              />
                            }
                          />
                        </Suspense>
                      ),
                      guessed: planner.session.guessed,
                      actions: planner.session.plan && !aiAdding && !planner.pending && (
                        <Suspense fallback={null}>
                          <AiActions
                            compact
                            inRow
                            onAdd={() => setAiAdding(true)}
                            onReset={() => {
                              setAiAdding(false);
                              planner.reset();
                            }}
                          />
                        </Suspense>
                      ),
                    }
                  : undefined
              }
            />
          </div>
          {/* The start times are Danish time. */}
          <DanishTimeNote className="px-1" />

          {/* Faded while the AI's panel reaches down over it (#124): the panel
              is then plainly in front, and the chart about to change anyway. */}
          {chart && (
            <div
              className={cn("transition-opacity duration-200", aiOverChart && "opacity-40")}
              inert={aiOverChart}
            >
              {chart}
            </div>
          )}

          <LaterDates {...laterDatesProps} />
          {/* No date at all: the ways to widen the search that would find one (#135). */}
          <WidenSearch options={widen} onPick={applyWiden} />
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

      {/* Tablets only: a wide screen has the
          settings box's tabs. */}
      {moreSettings && (
        <MoreSettingsScreen
          back={location.pathname}
          extras={extras}
          onExtras={updateExtras}
          participants={participantProps}
        />
      )}

      {newGroupDialog}
    </div>
  );
}

/**
 * New group, fetched the first time it is opened (#157) and kept mounted
 * after that, so it can slide away when closed.
 */
function LazyNewGroupDialog(props: ComponentProps<typeof NewGroupDialog>) {
  const [wanted, setWanted] = useState(props.open);
  if (props.open && !wanted) setWanted(true);
  if (!wanted) return null;
  return (
    <Suspense fallback={null}>
      <NewGroupDialog {...props} />
    </Suspense>
  );
}
