import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Users } from "lucide-react";

import DanishTimeNote from "@/components/time/DanishTimeNote";
import AnchoredPanel from "@/components/ui/AnchoredPanel";
import GroupBubbles from "@/components/ui/GroupBubbles";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import type { Planning } from "@/hooks/usePlanning";
import { useT } from "@/i18n/lang";
import { matchNames, mentionedNames, type AiPlan } from "@/lib/aiPlan";
import { flexAround, flexOf } from "@/lib/startFlex";

import AiQuestionsSheet from "./AiQuestionsSheet";
import GroupStep from "./GroupStep";
import MoreDetails from "./MoreDetails";
import NameField from "./NameField";
import PlanMonths from "./PlanMonths";
import TimeRows from "./TimeRows";
import { useAiFill, type PlanState } from "./useAiFill";

/**
 * What the Planlæg sheet on My calendar holds (#126), decisions first (#173):
 * the group, the name, the time as rows, the months in view, and the rest
 * folded behind "Flere detaljer". For those Casy's AI is on for, the name
 * field is also where it is asked (NameField's ✨): what is written goes to
 * Casy, its questions (if any) drop from the field (AiQuestionsSheet), and
 * then the sheet fills itself in before your eyes (useAiFill), its guesses
 * marked. Every setting stays yours to change by hand after.
 *
 * The group shares its row with Genveje (#175), three quarters to one. A
 * genvej's own editor shows the plan without the group or the months (a
 * genvej has neither: it runs with the group chosen, from today), its times
 * in their place (`editor`).
 */
export default function PlanSetup({
  planning,
  onShortcuts,
  editor,
}: {
  planning: Planning;
  /** Genveje beside the group (#175); none in a genvej's own editor. */
  onShortcuts?: () => void;
  /** A genvej's editor (#175): no group and no months, its times (`top`) in the group's place. */
  editor?: { top: ReactNode };
}) {
  const t = useT();
  const {
    user,
    groups,
    activeGroup,
    activeGroupId,
    selectGroup,
    openNewGroup,
    aiOn,
    planner,
    name,
    setName,
    sched,
    updateSettings,
    updateSettingsByHand,
    extras,
    updateExtras,
    peopleChoice,
    updatePeople,
  } = planning;
  const [picking, setPicking] = useState(false);
  const groupRow = `${useId()}-group`;
  const members = activeGroup?.members ?? [];

  const fill = useAiFill({ name, settings: sched, extras, people: peopleChoice });
  // The sheet as it was when Casy was asked, played forward once it has answered.
  const before = useRef<PlanState | null>(null);
  const [asking, setAsking] = useState(false);
  const field = useRef<HTMLDivElement>(null);
  const needsAnswers = (plan: AiPlan) =>
    plan.questions.length > 0 ||
    matchNames(mentionedNames(plan), members).some((m) => m.candidates.length !== 1);

  function askAi() {
    const from: PlanState = { name, settings: sched, extras, people: peopleChoice };
    planner.describe(name, {
      fresh: true,
      onAnswer: (plan) => {
        before.current = from;
        if (needsAnswers(plan)) {
          fill.hold(from);
          setAsking(true);
        } else fill.start(from);
      },
    });
  }
  function questionsDone() {
    if (!asking) return;
    setAsking(false);
    if (before.current) fill.start(before.current);
  }

  // The phone's rows know a start as an hour give or take: a window Casy's
  // AI (or a widened search) chose is put in that shape (flexAround).
  useEffect(() => {
    if (!sched.multiDay && !sched.anyTime && sched.startWindow && flexOf(sched) === null) {
      updateSettings(flexAround(sched.startWindow));
    }
  }, [sched, updateSettings]);

  const shown = fill.settings ?? sched;

  return (
    <>
      {/* Nothing to press while Casy fills the sheet in. */}
      <div inert={fill.active || planner.pending}>
        {editor ? (
          <>
            {/* A genvej: its name first, plain, then its times (#175). */}
            <NameField
              value={name}
              onChange={setName}
              ai={null}
              fieldRef={field}
              lit={false}
              label={t.shortcuts.nameLabel}
              placeholder={t.shortcuts.namePlaceholder}
            />
            {editor.top && <div className="mt-4">{editor.top}</div>}
          </>
        ) : (
          <>
            <div className="flex gap-3">
              <ListGroup className="mt-0 flex-[3]">
                {/* Show, don't tell: the members as bubbles, the group's name big;
                  "Gruppe" is left to screen readers. */}
                <ListRow
                  id={groupRow}
                  icon={Users}
                  leading={
                    activeGroup && activeGroup.members.length > 0 ? (
                      <GroupBubbles members={activeGroup.members} />
                    ) : undefined
                  }
                  label={
                    <span className="text-[17px] font-semibold">
                      <span className="sr-only">{t.scheduler.group} </span>
                      {activeGroup?.name ?? t.scheduler.group}
                    </span>
                  }
                  chevron
                  onClick={() => setPicking(true)}
                />
              </ListGroup>
              {onShortcuts && (
                <button
                  type="button"
                  onClick={onShortcuts}
                  className="flex min-w-0 flex-1 items-center justify-center rounded-2xl border bg-card text-[15px] font-medium text-primary transition-colors active:bg-secondary"
                >
                  {t.shortcuts.title}
                </button>
              )}
            </div>
            <NameField
              value={fill.name ?? name}
              onChange={setName}
              ai={aiOn ? { pending: planner.pending, error: planner.error, onAsk: askAi } : null}
              fieldRef={field}
              lit={fill.lit === "name"}
            />
          </>
        )}

        <TimeRows
          settings={shown}
          onChange={updateSettingsByHand}
          lit={fill.lit}
          drive={fill.active ? { sheet: fill.sheet, press: fill.press } : null}
        />
        {!editor && (
          <PlanMonths
            value={shown.period}
            onChange={(period) => updateSettingsByHand({ period })}
            lit={fill.lit === "months"}
          />
        )}
        <DanishTimeNote className="mt-3 px-1 text-xs" />
        <MoreDetails
          extras={extras}
          onExtras={updateExtras}
          lit={fill.lit === "more"}
          participants={{
            members,
            choice: peopleChoice,
            onChange: updatePeople,
            meeting: !shown.multiDay,
            example: !activeGroup || activeGroup.isExample,
          }}
        />
      </div>

      {aiOn && (
        <AiQuestionsSheet
          open={asking}
          planner={planner}
          members={members}
          origin={field}
          onDone={questionsDone}
        />
      )}

      <AnchoredPanel
        open={picking}
        onClose={() => setPicking(false)}
        anchorId={groupRow}
        label={t.scheduler.group}
      >
        <GroupStep
          groups={groups}
          selectedId={activeGroupId}
          signedIn={!!user}
          onPick={(id) => {
            selectGroup(id);
            setPicking(false);
          }}
          onCreate={() => {
            setPicking(false);
            openNewGroup();
          }}
        />
      </AnchoredPanel>
    </>
  );
}
