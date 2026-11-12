import { lazy, Suspense, useId, useRef, useState } from "react";
import { RefreshCw, UserPlus } from "lucide-react";

import Avatar from "@/components/ui/Avatar";
import FlowButton from "@/components/ui/FlowButton";
import { ListGroup, ListPickRow, ListRow } from "@/components/ui/ListGroup";
import Sheet from "@/components/ui/Sheet";
import type { PlanStart } from "@/hooks/usePlanning";
import { useSearchAgain } from "@/hooks/useSearchAgain";
import { useT } from "@/i18n/lang";
import type { VoteEvent } from "@/lib/vote";

// The planner it runs is Planlæg's: fetched when "Søg igen" is pressed.
const SearchAgainSheet = lazy(() => import("@/components/myEvents/phone/SearchAgainSheet"));

/**
 * Searching an open vote again (#240, the app only), as rows in the vote's
 * last group, above cancelling or leaving (its ListGroup is the caller's): the
 * members of the group it leaves out ("2 i gruppen er ikke med"), who open a
 * sheet to pick them (all ticked), and "Søg igen" for a new look with the same
 * people, when no date suits everyone. Anyone in the group may: a group is
 * trusted. Either opens a sheet over the vote, grown out of the row pressed,
 * on the vote's own plan (SearchAgainSheet, #264: fewer people, other months
 * or a wider time), whose Find dato opens Planlæg's pile; nothing changes
 * until its new dates are sent, which says first that everyone votes again.
 */
export default function SearchAgain({ event }: { event: VoteEvent }) {
  const t = useT();
  const words = t.searchAgain;
  const { missing, ready, planFor, runPlan } = useSearchAgain(event);
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  // The vote's plan being loosened (#264), in a sheet grown out of the row pressed.
  const [plan, setPlan] = useState<PlanStart | null>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const id = useId();
  const rows = { missing: `${id}-missing`, again: `${id}-again` };
  const origin = useRef<HTMLElement | null>(null);
  function loosen(add: string[], row: string) {
    const start = planFor(add);
    if (!start) return;
    origin.current = document.getElementById(row);
    setPicking(false);
    setPlan(start);
    setPlanOpen(true);
  }

  const toggle = (id: string) =>
    setPicked((now) => (now.includes(id) ? now.filter((p) => p !== id) : [...now, id]));

  return (
    <>
      {missing.length > 0 && (
        <ListRow
          id={rows.missing}
          icon={UserPlus}
          label={words.missing(missing.length)}
          chevron
          onClick={() => {
            setPicked(missing.map((m) => m.profileId));
            setPicking(true);
          }}
        />
      )}
      <ListRow
        id={rows.again}
        icon={RefreshCw}
        label={words.button}
        onClick={ready ? () => loosen([], rows.again) : undefined}
      />

      <Sheet
        open={picking}
        onClose={() => setPicking(false)}
        title={words.pickTitle}
        closeLabel={t.common.cancel}
        footer={
          <FlowButton onClick={() => loosen(picked, rows.missing)} disabled={picked.length === 0}>
            {words.button}
          </FlowButton>
        }
      >
        <ListGroup className="mt-0">
          {missing.map((m, i) => (
            <ListPickRow
              key={m.profileId}
              type="checkbox"
              checked={picked.includes(m.profileId)}
              onChange={() => toggle(m.profileId)}
              leading={<Avatar name={m.name} index={i} size="row" src={m.avatarUrl ?? undefined} />}
              label={m.name}
            />
          ))}
        </ListGroup>
      </Sheet>
      {plan && (
        <Suspense fallback={null}>
          <SearchAgainSheet
            start={plan}
            open={planOpen}
            onClose={() => setPlanOpen(false)}
            onFind={(loosened) => {
              setPlanOpen(false);
              runPlan(loosened);
            }}
            origin={origin}
          />
        </Suspense>
      )}
    </>
  );
}
