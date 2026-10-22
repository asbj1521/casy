import { useEffect, useMemo, useState } from "react";
import { CalendarOff, Sparkles } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import type { EventResponse } from "@/api/events";
import DayChart from "@/components/DayChart";
import AnswerActions from "@/components/findDate/AnswerActions";
import AiBoxView from "@/components/findDate/ai/AiBoxView";
import { AiActions } from "@/components/findDate/ai/AiConversation";
import PlanSummary from "@/components/findDate/ai/PlanSummary";
import AnswerCard from "@/components/findDate/AnswerCard";
import ExampleGroupPanel from "@/components/findDate/ExampleGroupPanel";
import GroupPanel from "@/components/findDate/GroupPanel";
import OutdatedNote from "@/components/findDate/OutdatedNote";
import LaterDates from "@/components/findDate/LaterDates";
import MoreSettingsScreen from "@/components/findDate/MoreSettingsScreen";
import DraftDeck, { type DraftAnswer } from "@/components/findDate/phoneFlow/DraftDeck";
import DescribeStep from "@/components/findDate/phoneFlow/DescribeStep";
import DetailsStep from "@/components/findDate/phoneFlow/DetailsStep";
import FlowShell, { FlowButton } from "@/components/findDate/phoneFlow/FlowShell";
import GroupStep from "@/components/findDate/phoneFlow/GroupStep";
import LiveAnswer from "@/components/findDate/phoneFlow/LiveAnswer";
import GroupSwitcher from "@/components/GroupSwitcher";
import NewGroupDialog from "@/components/NewGroupDialog";
import { SettingsPanel, SettingsSentence, StepSettings } from "@/components/SchedulerSettings";
import TopNav from "@/components/TopNav";
import DanishTimeNote from "@/components/time/DanishTimeNote";
import { usePhoneLayout } from "@/hooks/usePhoneLayout";
import { FIRST_MONTH, LAST_MONTH, TZ, usePlanning } from "@/hooks/usePlanning";
import { eventTitle, storedEventTitle } from "@/i18n/eventTitle";
import { useLang, useT } from "@/i18n/lang";
import { currentStep } from "@/lib/answerSteps";
import { cn } from "@/lib/utils";
import { pickCandidates } from "@/lib/candidates";
import { nameList } from "@/lib/format";
import { edgeWarnings } from "@/lib/earlyMorning";
import { fallbackTitleId } from "@/lib/scheduler";
import {
  aiFromSearch,
  detailsTouched,
  previousStep,
  searchForStep,
  stepFromSearch,
  type FlowStep,
} from "@/lib/schedulerFlow";
import { dayOf } from "@/lib/zone";

/**
 * The phone flow's dates before sending (#101), for the search `key` names:
 * your answers by each date's start, the dates you took out, and the order
 * you answered in, for taking the last one back.
 */
interface Draft {
  key: string;
  answers: Record<string, DraftAnswer>;
  removed: string[];
  history: string[];
}

/**
 * The scheduling page: the settings on top, the first date everyone can make
 * under them, the month day by day, the next few dates, and the group itself
 * at the bottom. On a phone the same page is a flow of four steps instead
 * (#101): the group, what and when, the optional details, and the dates.
 * The planning itself (state, search, sending) is usePlanning's.
 */
export default function FindDate() {
  const t = useT();
  const { lang } = useLang();
  const navigate = useNavigate();
  // Flere indstillinger (#98), laid over the page while ?settings is set.
  const location = useLocation();
  const moreSettings = new URLSearchParams(location.search).has("settings");
  const phone = usePhoneLayout();

  // The phone's flow (#101): the step on screen is in the address, so the
  // phone's back button and the iPhone's back swipe go a step back. Steps
  // taken on are marked, so going back returns to that same history entry
  // rather than adding another; a step opened directly goes back by
  // replacing it.
  const flowStep = stepFromSearch(location.search);
  // Planning with AI (#100) is a flow of its own: the group, the event
  // described, the dates.
  const aiFlow = aiFromSearch(location.search);
  function goToStep(step: FlowStep) {
    navigate(
      { pathname: location.pathname, search: searchForStep(step, aiFlow || step === "describe") },
      { state: { flowStep: true } },
    );
  }
  function stepBack() {
    const previous = previousStep(flowStep, aiFlow);
    if (!previous) return;
    if ((location.state as { flowStep?: boolean } | null)?.flowStep) {
      navigate(-1);
    } else {
      navigate(
        { pathname: location.pathname, search: searchForStep(previous, aiFlow) },
        { replace: true },
      );
    }
  }
  // Each step starts at its top, as a new screen does.
  useEffect(() => {
    if (phone) window.scrollTo(0, 0);
  }, [phone, flowStep]);

  const {
    user,
    groups,
    activeGroup,
    activeGroupId,
    busyLoading,
    busyFailed,
    myCalendarsFailed,
    youProfileId,
    stopCarousel,
    selectGroup,
    peopleChoice,
    updatePeople,
    newGroupOpen,
    setNewGroupOpen,
    create,
    openNewGroup,
    name,
    setName,
    extras,
    updateExtras,
    sched,
    updateSettings,
    updateSettingsByHand,
    aiOn,
    planner,
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
    stepBack: stepAnswerBack,
    acceptOwnTimeOff,
    pickDay,
    adoptSuggestion,
    waiting,
    edge,
    checkers,
    outdated,
    fadeKey,
    groupSize,
    viewMonth,
    chartMonth,
    pageMonth,
    profileFor,
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

  // The phone flow's last step (#101): you swipe the dates before they go.
  // Your answers and the dates you took out belong to the search they were
  // given for (the group, the settings, the period); change any of it and
  // they start afresh.
  const draftKey = [
    activeGroupId,
    JSON.stringify(search),
    searchWindow.start,
    searchWindow.end,
    currentStep(steps).from,
  ].join("|");
  const freshDraft = useMemo<Draft>(
    () => ({ key: draftKey, answers: {}, removed: [], history: [] }),
    [draftKey],
  );
  const [draftState, setDraft] = useState<Draft>(freshDraft);
  const draft = draftState.key === draftKey ? draftState : freshDraft;
  // The dates the vote would offer, picked as a computer's suggestion picks
  // them, less the ones you took out: the next good dates take their place.
  // Only on that step, since picking looks at up to 60 dates.
  const showVoteDates = phone && flowStep === "dates";
  const voteDates = useMemo(() => {
    if (!showVoteDates || !participants || !found?.slot) return null;
    const removed = new Set(draft.removed);
    return pickCandidates(
      participants,
      search,
      {
        first: { slot: found.slot, conflicts: found.conflicts },
        end: searchWindow.end,
        count: extras.dateCount + removed.size,
      },
      TZ,
    )
      .filter((d) => !removed.has(d.slot.start))
      .slice(0, extras.dateCount);
  }, [showVoteDates, participants, search, found, searchWindow, extras.dateCount, draft.removed]);
  const draftReady =
    !!voteDates && voteDates.length > 0 && voteDates.every((d) => draft.answers[d.slot.start]);
  /** Your answer to the date at `start`: "can't" takes it out of the vote. */
  function answerDraft(start: string, response: EventResponse) {
    const answers = { ...draft.answers };
    delete answers[start];
    setDraft({
      ...draft,
      answers: response === "declined" ? answers : { ...answers, [start]: response },
      removed: response === "declined" ? [...draft.removed, start] : draft.removed,
      history: [...draft.history, start],
    });
  }
  /** Take back the last answer, a date taken out included. */
  function undoDraft() {
    const last = draft.history[draft.history.length - 1];
    if (!last) return;
    const answers = { ...draft.answers };
    delete answers[last];
    setDraft({
      ...draft,
      answers,
      removed: draft.removed.filter((s) => s !== last),
      history: draft.history.slice(0, -1),
    });
  }
  /** Answer the date at `start` again: it comes back on top of the cards. */
  function reopenDraft(start: string) {
    const answers = { ...draft.answers };
    delete answers[start];
    setDraft({ ...draft, answers, history: draft.history.filter((s) => s !== start) });
  }
  /** Every date taken out, back in. */
  function restoreDraft() {
    const removed = new Set(draft.removed);
    setDraft({ ...draft, removed: [], history: draft.history.filter((s) => !removed.has(s)) });
  }

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

  // The answer, the chart and the dates after it: the same on a computer's
  // page and in the phone's flow.
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
    <NewGroupDialog
      open={newGroupOpen}
      submitting={create.isPending}
      error={create.error?.message ?? null}
      onSubmit={(group) => create.mutate(group)}
      onCancel={() => setNewGroupOpen(false)}
    />
  );

  if (phone) {
    const touched = detailsTouched(extras, peopleChoice);
    // The last step: swiping while dates are unanswered, then the summary
    // with the button that sends them.
    const swiping =
      flowStep === "dates" && !waiting && !!voteDates && voteDates.length > 0 && !draftReady;
    const canSend = !!user && !!activeGroup && !activeGroup.isExample && draftReady;
    const chosen = (voteDates ?? []).map((d) => ({
      start: d.slot.start,
      end: d.slot.end,
      answer: draft.answers[d.slot.start] ?? "accepted",
    }));
    // Under the summary: who checks the dates by hand, a holiday's ways of
    // fitting, why it can't be sent, and how sending went.
    const notes = [
      checkers && (
        <p key="checkers" className="flex items-start gap-1.5 text-muted-foreground">
          <CalendarOff className="mt-0.5 h-4 w-4 shrink-0" />
          {checkers.everyone
            ? t.scheduler.nobodyHasCalendar
            : t.scheduler.checkThemselves(nameList(checkers.names, lang))}
        </p>
      ),
      outdated.length > 0 && <OutdatedNote key="outdated" outdated={outdated} />,
      search.kind === "vacation" && suggestions.length > 0 && (
        <LaterDates key="workarounds" {...laterDatesProps} />
      ),
      !user ? (
        <p key="signIn" className="text-muted-foreground">
          {t.scheduler.hintSignIn}
        </p>
      ) : activeGroup?.isExample ? (
        <p key="example" className="text-muted-foreground">
          {t.scheduler.hintExample}
        </p>
      ) : null,
      movedNote && (
        <p key="moved" className="font-medium text-foreground">
          {movedNote === "suggest" ? t.scheduler.changedBeforeSending : t.scheduler.refreshedDate}
        </p>
      ),
      suggest.isError && (
        <p key="error" className="text-red-700">
          {suggest.error.message}
        </p>
      ),
    ].filter(Boolean);
    const live = (
      <LiveAnswer
        waiting={waiting}
        review={review}
        search={search}
        slot={slot}
        onOpen={() => goToStep("dates")}
      />
    );
    return (
      <>
        <FlowShell
          step={flowStep}
          pathname={location.pathname}
          onBack={stepBack}
          fill={swiping}
          ai={aiFlow}
          footer={
            flowStep === "group" ? (
              <div className="flex gap-2">
                {/* Planning with AI costs money per use: only for those it is on for (#111). */}
                {aiOn && (
                  <FlowButton quiet onClick={() => goToStep("describe")} disabled={!activeGroup}>
                    <span className="inline-flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-primary" />
                      {t.aiPlan.start}
                    </span>
                  </FlowButton>
                )}
                <FlowButton onClick={() => goToStep("what")} disabled={!activeGroup}>
                  {t.schedulerFlow.next}
                </FlowButton>
              </div>
            ) : flowStep === "describe" ? (
              planner.session.plan && (
                <>
                  {live}
                  <FlowButton onClick={() => goToStep("dates")}>
                    {t.schedulerFlow.seeDates}
                  </FlowButton>
                </>
              )
            ) : flowStep === "what" ? (
              <>
                {live}
                <FlowButton onClick={() => goToStep("details")}>{t.schedulerFlow.next}</FlowButton>
              </>
            ) : flowStep === "details" ? (
              <>
                {live}
                <FlowButton quiet={!touched} onClick={() => goToStep("dates")}>
                  {touched ? t.schedulerFlow.seeDates : t.schedulerFlow.skip}
                </FlowButton>
              </>
            ) : draftReady ? (
              <div className="flex gap-2">
                <AnswerActions
                  stepping={false}
                  {...actionProps}
                  approving={false}
                  canSuggest={canSend}
                  onSuggest={() => void sendSuggestion(chosen)}
                />
              </div>
            ) : null
          }
        >
          {flowStep === "group" ? (
            <GroupStep
              groups={groups}
              selectedId={activeGroupId}
              signedIn={!!user}
              onPick={selectGroup}
              onCreate={openNewGroup}
            />
          ) : flowStep === "what" ? (
            <>
              <StepSettings
                name={name}
                onName={setName}
                settings={sched}
                onChange={updateSettings}
              />
              {/* The start times are Danish time. */}
              <DanishTimeNote className="mt-4 px-1" />
            </>
          ) : flowStep === "describe" ? (
            <DescribeStep
              groups={groups}
              groupId={activeGroupId}
              signedIn={!!user}
              onPickGroup={selectGroup}
              onCreateGroup={openNewGroup}
              planner={planner}
              members={activeGroup?.members ?? []}
              name={name}
              onName={setName}
              settings={sched}
              onChange={updateSettingsByHand}
              extras={extras}
              onExtras={updateExtras}
              participants={participantProps}
            />
          ) : flowStep === "details" ? (
            <DetailsStep extras={extras} onExtras={updateExtras} participants={participantProps} />
          ) : (
            <DraftDeck
              waiting={waiting}
              dates={voteDates}
              answers={draft.answers}
              onAnswer={answerDraft}
              onReopen={reopenDraft}
              onUndo={undoDraft}
              canUndo={draft.history.length > 0}
              onStartOver={restoreDraft}
              anyRemoved={draft.removed.length > 0}
              search={search}
              slotLabel={name.trim() || eventTitle(storedEventTitle(fallbackTitleId(search)), t)}
              place={extras.place}
              groupSize={groupSize}
              warningsFor={(date) =>
                search.kind === "single" && participants
                  ? edgeWarnings(participants, date, TZ, youProfileId, lang, t)
                  : []
              }
              extras={extras}
              onExtras={updateExtras}
              notes={notes.length > 0 ? notes : null}
              profileInput={profileFor}
            />
          )}
        </FlowShell>
        {newGroupDialog}
      </>
    );
  }

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
                      ),
                      guessed: planner.session.guessed,
                      actions: planner.session.plan && !aiAdding && !planner.pending && (
                        <AiActions
                          compact
                          inRow
                          onAdd={() => setAiAdding(true)}
                          onReset={() => {
                            setAiAdding(false);
                            planner.reset();
                          }}
                        />
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

      {/* Tablets only: a phone has the flow above, and a wide screen the
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
