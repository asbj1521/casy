import { useState } from "react";

import { FlowButton } from "@/components/findDate/phoneFlow/FlowShell";
import NewGroupDialog from "@/components/NewGroupDialog";
import BottomSheet from "@/components/ui/BottomSheet";
import { usePlanning } from "@/hooks/usePlanning";
import { useT } from "@/i18n/lang";

import PileScreen from "./PileScreen";
import PlanSetup from "./PlanSetup";

/**
 * Planning from My calendar (#126): "Planlæg" opens a sheet over the
 * calendar to say what is planned, and "Find dato" shows the paper pile
 * finding the dates, ending in the button that sends them. The same plan as
 * the scheduler's (usePlanning): begun here, it is there too, and the other
 * way round. Loaded only once Planlæg is pressed, so opening My calendar
 * never fetches a group's calendars.
 */
export default function PlanFromCalendar({ onClose }: { onClose: () => void }) {
  const t = useT();
  const planning = usePlanning();
  const [stage, setStage] = useState<"setup" | "pile">("setup");

  return (
    <>
      <BottomSheet
        open={stage === "setup"}
        onClose={onClose}
        title={t.planFromCalendar.button}
        doneLabel={t.common.cancel}
        footer={
          <FlowButton onClick={() => setStage("pile")} disabled={!planning.activeGroup}>
            {t.planFromCalendar.findDate}
          </FlowButton>
        }
      >
        <PlanSetup planning={planning} />
      </BottomSheet>

      {stage === "pile" && (
        <PileScreen planning={planning} onChange={() => setStage("setup")} onClose={onClose} />
      )}

      <NewGroupDialog
        open={planning.newGroupOpen}
        submitting={planning.create.isPending}
        error={planning.create.error?.message ?? null}
        onSubmit={(group) => planning.create.mutate(group)}
        onCancel={() => planning.setNewGroupOpen(false)}
      />
    </>
  );
}
