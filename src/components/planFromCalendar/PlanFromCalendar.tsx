import { useEffect, useState } from "react";

import { FlowButton } from "@/components/findDate/phoneFlow/FlowShell";
import NewGroupDialog from "@/components/NewGroupDialog";
import BottomSheet from "@/components/ui/BottomSheet";
import { usePlanning } from "@/hooks/usePlanning";
import { useT } from "@/i18n/lang";

import PileScreen from "./PileScreen";
import PlanSetup from "./PlanSetup";

/** How long an answered last question stays on screen before the settings come back. */
const HAND_BACK_MS = 600;

/**
 * Planning from My calendar (#126): "Planlæg" opens a glass sheet over the
 * calendar to say what is planned, and "Find dato" shows the calendars
 * piling up and finding the dates, ending in the button that sends them.
 * The same plan as the scheduler's (usePlanning): begun here, it is there
 * too, and the other way round. Loaded only once Planlæg is pressed, so
 * opening My calendar never fetches a group's calendars.
 */
export default function PlanFromCalendar({ onClose }: { onClose: () => void }) {
  const t = useT();
  const planning = usePlanning();
  const [stage, setStage] = useState<"setup" | "pile">("setup");
  const [aiMode, setAiMode] = useState(false);

  // Casy has answered and nothing is left to ask: the settings come back,
  // filled in, a moment after the last question is answered.
  const { planner } = planning;
  const { session } = planner;
  const aiDone =
    session.plan !== null &&
    !planner.pending &&
    session.questions.every((q) => q.picked !== null) &&
    session.names.every((n) => n.picked !== null);
  useEffect(() => {
    if (!aiMode || !aiDone) return;
    const id = window.setTimeout(() => setAiMode(false), HAND_BACK_MS);
    return () => window.clearTimeout(id);
  }, [aiMode, aiDone]);

  return (
    <>
      <BottomSheet
        glass
        open={stage === "setup"}
        onClose={onClose}
        title={t.planFromCalendar.button}
        doneLabel={t.common.cancel}
        footer={
          aiMode ? (
            <FlowButton quiet onClick={() => setAiMode(false)}>
              {t.planFromCalendar.byHand}
            </FlowButton>
          ) : (
            <FlowButton onClick={() => setStage("pile")} disabled={!planning.activeGroup}>
              {t.planFromCalendar.findDate}
            </FlowButton>
          )
        }
      >
        <PlanSetup planning={planning} aiMode={aiMode} onAiMode={setAiMode} />
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
