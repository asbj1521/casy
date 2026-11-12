import type { RefObject } from "react";

import PlanSetup from "@/components/planFromCalendar/PlanSetup";
import BottomSheet from "@/components/ui/BottomSheet";
import FlowButton from "@/components/ui/FlowButton";
import { usePlanning, type PlanStart } from "@/hooks/usePlanning";
import { useT } from "@/i18n/lang";

/**
 * A vote's plan, loosened before it is searched again (#264): a sheet over
 * the vote, growing out of the row pressed, with the vote's own time, days,
 * months and how many need to come already set (PlanSetup's `again` mode:
 * no group, name field, Genveje or kind). What is changed here is what the
 * pile then searches: Find dato hands the plan on (`onFind`), and Planlæg
 * opens straight on its pile. Mounted only while open, so its planner starts
 * from the vote each time.
 */
export default function SearchAgainSheet({
  start,
  open,
  onClose,
  onFind,
  origin,
}: {
  start: PlanStart;
  open: boolean;
  onClose: () => void;
  onFind: (plan: PlanStart) => void;
  origin: RefObject<HTMLElement | null>;
}) {
  const t = useT();
  const planning = usePlanning({ start });

  function find() {
    onFind({
      ...start,
      settings: planning.sched,
      people: planning.peopleChoice,
    });
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t.searchAgain.button}
      doneLabel={t.common.cancel}
      origin={origin}
      footer={
        <FlowButton onClick={find} disabled={!planning.activeGroup}>
          {t.planFromCalendar.findDate}
        </FlowButton>
      }
    >
      <PlanSetup planning={planning} />
    </BottomSheet>
  );
}
