import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";

import { createGroup, groupsQuery, groupsQueryKey, type Group } from "@/api/groups";
import NewGroupDialog from "@/components/NewGroupDialog";
import Avatar from "@/components/ui/Avatar";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import Notice from "@/components/ui/Notice";
import { useSignedInUser } from "@/context/auth";
import { useT } from "@/i18n/lang";

/**
 * Your groups as an iPhone list: one row each, opening the group
 * (/groups/:groupId), and a row at the end to make a new one. A phone's whole
 * Groups tab; the left pane of a computer's, with the open group `selected`.
 */
export default function GroupList({
  selectedId,
  privacyNote = true,
}: {
  selectedId?: string;
  /** What members see, under the list; a computer has it under the open group instead. */
  privacyNote?: boolean;
}) {
  const t = useT();
  const youId = useSignedInUser().id;
  const queryClient = useQueryClient();
  const { data: groups, isPending, isError } = useQuery(groupsQuery(youId));
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const create = useMutation({
    mutationFn: createGroup,
    onSuccess: (data) => {
      queryClient.setQueryData(groupsQueryKey(youId), data.groups);
      setNewGroupOpen(false);
    },
  });

  if (isPending) {
    return (
      <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t.groupsSection.loading}
      </p>
    );
  }
  if (isError) {
    return (
      <Notice tone="error" bare className="mt-6">
        {t.groupsSection.loadFailed}
      </Notice>
    );
  }

  return (
    <>
      <ListGroup
        title={t.groupsSection.title}
        footnote={
          groups.length === 0
            ? t.groupsPage.empty
            : privacyNote
              ? t.groupPanel.whatMembersSeeBody
              : undefined
        }
      >
        {groups.map((group, i) => (
          <ListRow
            key={group.id}
            to={`/groups/${group.id}`}
            selected={group.id === selectedId}
            leading={<Avatar name={group.name} index={i} size="row" />}
            label={group.name}
            detail={memberLine(group, t.groupsPage.you)}
          />
        ))}
        <ListRow
          icon={Plus}
          tone="primary"
          label={t.groupsSection.makeGroup}
          onClick={() => {
            create.reset();
            setNewGroupOpen(true);
          }}
        />
      </ListGroup>

      <NewGroupDialog
        open={newGroupOpen}
        submitting={create.isPending}
        error={create.error?.message ?? null}
        onSubmit={(group) => create.mutate(group)}
        onCancel={() => setNewGroupOpen(false)}
      />
    </>
  );
}

/** Who's in it, you first: "Dig, Simon, Maja". */
function memberLine(group: Group, you: string): string {
  return [...group.members]
    .sort((a, b) => Number(b.isYou) - Number(a.isYou))
    .map((m) => (m.isYou ? you : m.name))
    .join(", ");
}
