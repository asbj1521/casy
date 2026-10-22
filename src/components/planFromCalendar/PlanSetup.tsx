import { useState } from "react";
import { Users } from "lucide-react";

import AiConversation from "@/components/findDate/ai/AiConversation";
import DetailsStep from "@/components/findDate/phoneFlow/DetailsStep";
import GroupStep from "@/components/findDate/phoneFlow/GroupStep";
import { StepSettings } from "@/components/SchedulerSettings";
import DanishTimeNote from "@/components/time/DanishTimeNote";
import BottomSheet from "@/components/ui/BottomSheet";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import type { Planning } from "@/hooks/usePlanning";
import { useT } from "@/i18n/lang";

/**
 * What the Planlæg sheet on My calendar holds (#126): the group, the event
 * written or said to Casy's AI (for those it is on for), the settings it
 * fills in or you set yourself, and the optional details. The same pieces
 * as the scheduler's phone flow, on one screen, since the calendar stays
 * in view behind it.
 */
export default function PlanSetup({ planning }: { planning: Planning }) {
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
    updateSettingsByHand,
    extras,
    updateExtras,
    peopleChoice,
    updatePeople,
  } = planning;
  const [picking, setPicking] = useState(false);

  return (
    <>
      <ListGroup className="mb-4 mt-0">
        <ListRow
          icon={Users}
          label={t.scheduler.group}
          value={activeGroup?.name}
          chevron
          onClick={() => setPicking(true)}
        />
      </ListGroup>

      {aiOn && (
        <AiConversation planner={planner} members={activeGroup?.members ?? []} className="mb-6" />
      )}

      <h3 className="mb-3 text-lg font-extrabold tracking-tight text-foreground">
        {t.schedulerFlow.steps.what}
      </h3>
      <StepSettings
        name={name}
        onName={setName}
        settings={sched}
        onChange={updateSettingsByHand}
        guessed={planner.session.guessed}
      />
      <DanishTimeNote className="mt-4 px-1" />
      <DetailsStep
        extras={extras}
        onExtras={updateExtras}
        participants={{
          members: activeGroup?.members ?? [],
          choice: peopleChoice,
          onChange: updatePeople,
          meeting: !sched.multiDay,
          example: !activeGroup || activeGroup.isExample,
        }}
      />

      <BottomSheet
        open={picking}
        onClose={() => setPicking(false)}
        title={t.scheduler.group}
        doneLabel={t.schedulerFlow.done}
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
      </BottomSheet>
    </>
  );
}
