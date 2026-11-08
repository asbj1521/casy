import { useState } from "react";
import { RefreshCw, TriangleAlert, UserPlus } from "lucide-react";

import Avatar from "@/components/ui/Avatar";
import ConfirmPanel from "@/components/ui/ConfirmPanel";
import FlowButton from "@/components/ui/FlowButton";
import { ListGroup, ListPickRow, ListRow } from "@/components/ui/ListGroup";
import Notice from "@/components/ui/Notice";
import Sheet from "@/components/ui/Sheet";
import { useSearchAgain } from "@/hooks/useSearchAgain";
import { useT } from "@/i18n/lang";
import type { VoteEvent } from "@/lib/vote";

/**
 * Searching an open vote again (#240, the app only), under its dates: the
 * members of the group it leaves out ("2 i gruppen er ikke med"), who open a
 * sheet to pick them (all ticked) and search with them, and "Søg igen" for a
 * new look with the same people, when no date suits everyone. Anyone in the
 * group may: a group is trusted. Both say first that everyone votes again: in
 * the picking sheet over its button, and otherwise in a small sheet of its
 * own, so one sheet never closes straight into another (#230).
 */
export default function SearchAgain({ event }: { event: VoteEvent }) {
  const t = useT();
  const words = t.searchAgain;
  const { missing, search } = useSearchAgain(event);
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [warning, setWarning] = useState(false);

  const openPicking = () => {
    search.reset();
    setPicked(missing.map((m) => m.profileId));
    setPicking(true);
  };
  const toggle = (id: string) =>
    setPicked((now) => (now.includes(id) ? now.filter((p) => p !== id) : [...now, id]));
  const warningText = (
    <span className="flex items-start gap-2">
      <TriangleAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
      <span>
        <span className="font-semibold">{words.warning}: </span>
        {words.warningText}
      </span>
    </span>
  );

  return (
    <>
      <ListGroup>
        {missing.length > 0 && (
          <ListRow
            icon={UserPlus}
            label={words.missing(missing.length)}
            chevron
            onClick={openPicking}
          />
        )}
        <ListRow
          icon={RefreshCw}
          label={words.button}
          onClick={() => {
            search.reset();
            setWarning(true);
          }}
        />
      </ListGroup>

      <Sheet
        open={picking}
        onClose={() => setPicking(false)}
        title={words.pickTitle}
        closeLabel={t.common.cancel}
        busy={search.isPending}
        footer={
          <FlowButton
            onClick={() => search.mutate(picked, { onSuccess: () => setPicking(false) })}
            disabled={picked.length === 0}
            busy={search.isPending}
          >
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
        <Notice tone="warning" icon={TriangleAlert} className="mt-4">
          <span className="font-semibold">{words.warning}: </span>
          {words.warningText}
        </Notice>
        {search.error && (
          <Notice tone="error" bare className="mt-3">
            {search.error.message}
          </Notice>
        )}
      </Sheet>

      {warning && (
        <ConfirmPanel
          tone="neutral"
          message={warningText}
          confirmLabel={words.button}
          busy={search.isPending}
          error={search.error?.message}
          onConfirm={() => search.mutate([], { onSuccess: () => setWarning(false) })}
          onCancel={() => setWarning(false)}
        />
      )}
    </>
  );
}
