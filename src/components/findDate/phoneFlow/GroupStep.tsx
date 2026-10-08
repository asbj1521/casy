import { Check, Plus, Users } from "lucide-react";

import Avatar from "@/components/ui/Avatar";
import Bone from "@/components/ui/Bone";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import type { SchedulingGroup } from "@/hooks/useSchedulingGroups";
import { useLang, useT } from "@/i18n/lang";
import { nameList } from "@/lib/format";

/**
 * The flow's first step (#101): your groups as a list, a tap on one picks it
 * and moves on, "New group" under them. Someone with no groups yet gets
 * "New group" first, with a line on why, and the labelled examples under it.
 */
export default function GroupStep({
  groups,
  selectedId,
  signedIn,
  onPick,
  onCreate,
}: {
  groups: SchedulingGroup[];
  selectedId: string | null;
  signedIn: boolean;
  onPick: (id: string) => void;
  onCreate: () => void;
}) {
  const t = useT();
  const { lang } = useLang();
  const examples = groups.some((g) => g.isExample);

  const newGroup = (
    <ListGroup
      className={examples ? "mt-0" : undefined}
      footnote={
        examples ? (signedIn ? t.scheduler.hintExample : t.scheduler.hintSignIn) : undefined
      }
    >
      <ListRow
        icon={Plus}
        tone="primary"
        label={t.schedulerFlow.newGroup}
        detail={t.schedulerFlow.newGroupDetail}
        onClick={onCreate}
      />
    </ListGroup>
  );

  const list = (
    <ListGroup
      className={examples ? undefined : "mt-0"}
      title={examples ? t.schedulerFlow.examples : undefined}
    >
      {groups.length === 0
        ? // The groups are on their way: their rows, held.
          [0, 1, 2].map((i) => (
            <ListRow
              key={i}
              leading={
                <span className="flex w-14 shrink-0">
                  <span className="h-10 w-10 rounded-full bg-secondary" />
                </span>
              }
              label={<Bone chars={14} />}
              detail={<Bone chars={22} />}
            />
          ))
        : groups.map((g) => (
            <ListRow
              key={g.id}
              leading={<GroupMark group={g} />}
              label={
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate">{g.name}</span>
                  {g.isExample && (
                    <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                      {t.common.example}
                    </span>
                  )}
                </span>
              }
              detail={
                g.members.length > 0
                  ? nameList(
                      g.members.map((m) => (m.isYou ? t.common.withYou(m.name) : m.name)),
                      lang,
                    )
                  : t.counts.members(g.memberCount)
              }
              value={
                g.id === selectedId ? (
                  <Check aria-hidden className="h-5 w-5 text-primary" />
                ) : undefined
              }
              chevron
              selected={g.id === selectedId}
              onClick={() => onPick(g.id)}
            />
          ))}
    </ListGroup>
  );

  // Your own groups first; with none yet, making one comes before the examples.
  return examples ? (
    <>
      {newGroup}
      {list}
    </>
  ) : (
    <>
      {list}
      {newGroup}
    </>
  );
}

/**
 * Up to three members' letters, overlapping, or an example's group icon, in
 * a slot of one width, so every row's name starts in the same place.
 */
function GroupMark({ group }: { group: SchedulingGroup }) {
  return (
    <span className="flex w-14 shrink-0 items-center">
      {group.members.length === 0 ? (
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-50 text-primary">
          <Users className="h-5 w-5" />
        </span>
      ) : (
        <span className="flex -space-x-2">
          {group.members.slice(0, 3).map((m, i) => (
            <Avatar key={m.profileId} name={m.name} index={i} className="ring-2 ring-card" />
          ))}
        </span>
      )}
    </span>
  );
}
