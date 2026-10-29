import { useEffect, useRef, useState, type RefObject } from "react";

import FlowButton from "@/components/ui/FlowButton";
import NewGroupDialog from "@/components/NewGroupDialog";
import BottomSheet from "@/components/ui/BottomSheet";
import { usePlanning } from "@/hooks/usePlanning";
import { useT } from "@/i18n/lang";

import PileScreen from "./PileScreen";
import PlanSetup from "./PlanSetup";

/**
 * Planning from My calendar (#126): "Planlæg" opens a glass sheet over the
 * calendar to say what is planned, and "Find dato" shows the calendars
 * piling up and finding the dates, ending in the button that sends them.
 * The same plan as the scheduler's (usePlanning): begun here, it is there
 * too, and the other way round. Loaded only once Planlæg is pressed, so
 * opening My calendar never fetches a group's calendars.
 */
export default function PlanFromCalendar({
  open,
  onClose,
  onClosed,
  origin,
}: {
  /**
   * Whether the plan is open (?plan). Closed, it stays on the page until its
   * sheet has shrunk back into the pill (#169), then says so (`onClosed`).
   */
  open: boolean;
  onClose: () => void;
  onClosed: () => void;
  /** The home page's Planlæg pill, which the sheet grows out of (#169). */
  origin?: RefObject<HTMLElement | null>;
}) {
  const t = useT();
  // Sent, the plan closes onto the home page, the dates having flown into
  // its Aftaler button (#169).
  const planning = usePlanning({ onSent: onClose });
  const [stage, setStage] = useState<"setup" | "pile">("setup");
  // The sheet grows out of the pill and shrinks back into it, but once the
  // pile has begun it slides away and back as before: the pill is hidden
  // behind the plan then. Read by the sheet as it opens and as it closes.
  const sheetOrigin = useRef<HTMLElement | null>(origin?.current ?? null);
  const toPile = () => {
    sheetOrigin.current = null;
    setStage("pile");
  };
  // Closed from the pile, there is no sheet to wait for. The sheet's own
  // closing says when it is done, unless it closed only to make way for the pile.
  const stillOpen = useRef(open);
  useEffect(() => {
    stillOpen.current = open;
    if (!open && stage === "pile") onClosed();
  }, [open, stage, onClosed]);
  // A new pile each time it starts over (a shorter holiday picked at its end).
  const [run, setRun] = useState(0);

  return (
    <>
      <BottomSheet
        open={open && stage === "setup"}
        onClose={onClose}
        onClosed={() => {
          if (!stillOpen.current) onClosed();
        }}
        title={t.planFromCalendar.button}
        doneLabel={t.common.cancel}
        origin={sheetOrigin}
        footer={
          <FlowButton onClick={toPile} disabled={!planning.activeGroup || planning.planner.pending}>
            {t.planFromCalendar.findDate}
          </FlowButton>
        }
      >
        <PlanSetup planning={planning} />
      </BottomSheet>

      {open && stage === "pile" && (
        <PileScreen
          key={run}
          planning={planning}
          onChange={() => setStage("setup")}
          onRestart={() => setRun((n) => n + 1)}
          onClose={onClose}
        />
      )}

      <NewGroupDialog
        open={planning.newGroupOpen}
        onClose={() => planning.setNewGroupOpen(false)}
        onCreated={planning.groupCreated}
      />
    </>
  );
}
