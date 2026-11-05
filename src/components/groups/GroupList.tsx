import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";

import { deleteGroup, groupsQuery, groupsQueryKey, leaveGroup, type Group } from "@/api/groups";
import NewGroupDialog from "@/components/NewGroupDialog";
import Avatar from "@/components/ui/Avatar";
import ConfirmPanel from "@/components/ui/ConfirmPanel";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import Notice from "@/components/ui/Notice";
import SwipeReveal from "@/components/ui/SwipeReveal";
import { useSignedInUser } from "@/context/auth";
import { usePhoneLayout } from "@/hooks/usePhoneLayout";
import { useT } from "@/i18n/lang";
import { groupSwipe } from "@/lib/groups";

/**
 * Your groups as an iPhone list: one row each, opening the group
 * (/groups/:groupId), and a row at the end to make a new one. A phone's whole
 * Groups tab; the left pane of a computer's, with the open group `selected`.
 * On a phone a row swipes left to delete or leave the group (#223; groupSwipe):
 * asked first only when it takes the group from other people. The group's own
 * screen has the same, for anyone who can't swipe.
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
  const navigate = useNavigate();
  const { data: groups, isPending, isError } = useQuery(groupsQuery(youId));
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const phone = usePhoneLayout();
  const queryClient = useQueryClient();
  const [swiped, setSwiped] = useState<string | null>(null);
  const [asking, setAsking] = useState<Group | null>(null);
  const done = (data: { groups: Group[] }) => {
    queryClient.setQueryData(groupsQueryKey(youId), data.groups);
    setSwiped(null);
    setAsking(null);
  };
  const leave = useMutation({ mutationFn: leaveGroup, onSuccess: done });
  const remove = useMutation({ mutationFn: deleteGroup, onSuccess: done });
  const failed = (leave.error ?? remove.error)?.message;

  function pressed(group: Group) {
    leave.reset();
    remove.reset();
    const action = groupSwipe(group, youId);
    if (action === "delete-for-all") setAsking(group);
    else leave.mutate(group.id);
  }

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
            leading={<Avatar name={group.name} index={i} size="row" src={group.pictureUrl} />}
            label={group.name}
            detail={memberLine(group, t.groupsPage.you)}
            wrap={
              phone
                ? (row) => (
                    <>
                      <SwipeReveal
                        label={
                          groupSwipe(group, youId) === "leave"
                            ? t.groupsSection.swipeLeave
                            : t.groupsSection.swipeDelete
                        }
                        open={swiped === group.id}
                        onOpenChange={(open) =>
                          setSwiped((now) => (open ? group.id : now === group.id ? null : now))
                        }
                        onPress={() => pressed(group)}
                      >
                        {row}
                      </SwipeReveal>
                      {/* Under its own row, where it can't end up out of sight. */}
                      {asking?.id === group.id && (
                        <ConfirmPanel
                          className="mx-4 mb-3"
                          message={t.groupsSection.deleteConfirm(
                            asking.name,
                            asking.members.length,
                          )}
                          confirmLabel={t.groupsSection.swipeDelete}
                          busy={remove.isPending}
                          error={remove.error?.message}
                          onConfirm={() => remove.mutate(asking.id)}
                          onCancel={() => {
                            setAsking(null);
                            setSwiped(null);
                          }}
                        />
                      )}
                    </>
                  )
                : undefined
            }
          />
        ))}
        <ListRow
          icon={Plus}
          tone="primary"
          label={t.groupsSection.makeGroup}
          onClick={() => setNewGroupOpen(true)}
        />
      </ListGroup>

      {failed && !asking && (
        <Notice tone="error" bare className="mt-3">
          {failed}
        </Notice>
      )}

      {/* Made and invited to in its sheet (#153); the group opens once that closes. */}
      <NewGroupDialog
        open={newGroupOpen}
        onClose={() => setNewGroupOpen(false)}
        onCreated={() => {}}
        onDone={(id) => navigate(`/groups/${id}`)}
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
