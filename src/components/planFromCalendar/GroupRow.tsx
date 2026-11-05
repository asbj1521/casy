import { useId, useState } from "react";
import { Users } from "lucide-react";

import AnchoredPanel from "@/components/ui/AnchoredPanel";
import GroupBubbles from "@/components/ui/GroupBubbles";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import type { Planning } from "@/hooks/usePlanning";
import { useT } from "@/i18n/lang";

import ExampleBadge from "./ExampleBadge";
import GroupStep from "./GroupStep";

/**
 * The plan's group as one row (#173, #185): show, don't tell, the members as
 * bubbles and the group's name big ("Gruppe" left to screen readers), the
 * groups unfolding from the row to pick another (#175). In Planlæg beside
 * Genveje, and under a genvej about to run, so its group is seen too.
 */
export default function GroupRow({
  planning,
  className,
}: {
  planning: Planning;
  className?: string;
}) {
  const t = useT();
  const { user, groups, activeGroup, activeGroupId, selectGroup, openNewGroup } = planning;
  const [picking, setPicking] = useState(false);
  const row = `${useId()}-group`;

  return (
    <>
      <ListGroup className={className}>
        <ListRow
          id={row}
          // An example's badge takes the room of the icon, so its name still fits (#210).
          icon={activeGroup?.isExample ? undefined : Users}
          leading={
            activeGroup && (activeGroup.pictureUrl || activeGroup.members.length > 0) ? (
              <span className="large-text:hidden">
                <GroupBubbles members={activeGroup.members} picture={activeGroup.pictureUrl} />
              </span>
            ) : undefined
          }
          label={
            <span className="flex min-w-0 items-center gap-2 text-[1.0625rem] font-semibold">
              <span className="truncate">
                <span className="sr-only">{t.scheduler.group} </span>
                {activeGroup?.name ?? t.scheduler.group}
              </span>
              {activeGroup?.isExample && <ExampleBadge />}
            </span>
          }
          chevron
          onClick={() => setPicking(true)}
        />
      </ListGroup>
      <AnchoredPanel
        open={picking}
        onClose={() => setPicking(false)}
        anchorId={row}
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
