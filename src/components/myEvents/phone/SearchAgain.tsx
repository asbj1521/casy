import { useState } from "react";
import { RefreshCw, UserPlus } from "lucide-react";

import Avatar from "@/components/ui/Avatar";
import FlowButton from "@/components/ui/FlowButton";
import { ListGroup, ListPickRow, ListRow } from "@/components/ui/ListGroup";
import Sheet from "@/components/ui/Sheet";
import { useSearchAgain } from "@/hooks/useSearchAgain";
import { useT } from "@/i18n/lang";
import type { VoteEvent } from "@/lib/vote";

/**
 * Searching an open vote again (#240, the app only), as rows in the vote's
 * last group, above cancelling or leaving (its ListGroup is the caller's): the
 * members of the group it leaves out ("2 i gruppen er ikke med"), who open a
 * sheet to pick them (all ticked), and "Søg igen" for a new look with the same
 * people, when no date suits everyone. Anyone in the group may: a group is
 * trusted. Either opens Planlæg's pile with the vote's plan; nothing changes
 * until its new dates are sent, which says first that everyone votes again.
 */
export default function SearchAgain({ event }: { event: VoteEvent }) {
  const t = useT();
  const words = t.searchAgain;
  const { missing, ready, searchAgain } = useSearchAgain(event);
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);

  const toggle = (id: string) =>
    setPicked((now) => (now.includes(id) ? now.filter((p) => p !== id) : [...now, id]));

  return (
    <>
      {missing.length > 0 && (
        <ListRow
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
        icon={RefreshCw}
        label={words.button}
        onClick={ready ? () => searchAgain([]) : undefined}
      />

      <Sheet
        open={picking}
        onClose={() => setPicking(false)}
        title={words.pickTitle}
        closeLabel={t.common.cancel}
        footer={
          <FlowButton onClick={() => searchAgain(picked)} disabled={picked.length === 0}>
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
    </>
  );
}
