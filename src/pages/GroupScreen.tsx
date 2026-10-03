import { useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut, Pencil, Trash2, UserPlus } from "lucide-react";

import {
  deleteGroup,
  groupsQuery,
  groupsQueryKey,
  leaveGroup,
  renameGroup,
  type Group,
} from "@/api/groups";
import InlineTextEdit from "@/components/InlineTextEdit";
import InviteDialog from "@/components/InviteDialog";
import PhoneSubHeader from "@/components/PhoneSubHeader";
import Avatar from "@/components/ui/Avatar";
import ConfirmPanel from "@/components/ui/ConfirmPanel";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import { useSignedInUser } from "@/context/auth";
import { usePhoneLayout } from "@/hooks/usePhoneLayout";
import { useLang, useT } from "@/i18n/lang";
import { formatMonthYear } from "@/lib/format";
import { MAX_GROUP_NAME_LENGTH } from "@/lib/groups";

/**
 * One group on a phone (/groups/:groupId), opened from the Groups tab: who's
 * in it, and inviting, renaming, leaving or deleting it. A computer does all
 * of this in the profile's group rows (GroupsSection), so it is sent there.
 */
export default function GroupScreen() {
  const { groupId } = useParams();
  const phone = usePhoneLayout();
  const youId = useSignedInUser().id;
  const { data: groups, isError } = useQuery(groupsQuery(youId));

  if (!phone) return <Navigate to="/profile" replace />;
  // The list says why it couldn't load them.
  if (isError) return <Navigate to="/groups" replace />;
  if (!groups) return null; // the groups are almost always cached already
  const index = groups.findIndex((g) => g.id === groupId);
  // Gone (left or deleted, here or elsewhere): back to the list.
  if (index === -1) return <Navigate to="/groups" replace />;
  return <GroupDetails group={groups[index]} index={index} youId={youId} />;
}

function GroupDetails({ group, index, youId }: { group: Group; index: number; youId: string }) {
  const t = useT();
  const { lang } = useLang();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirm, setConfirm] = useState<"leave" | "delete" | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);

  // Every change answers with your groups as they now are, straight into the
  // cache, as in GroupsSection. Leaving or deleting goes back to the list.
  const groupsChanged = (data: { groups: Group[] }) =>
    queryClient.setQueryData(groupsQueryKey(youId), data.groups);
  const gone = (data: { groups: Group[] }) => {
    groupsChanged(data);
    navigate("/groups", { replace: true });
  };
  const leave = useMutation({ mutationFn: () => leaveGroup(group.id), onSuccess: gone });
  const remove = useMutation({ mutationFn: () => deleteGroup(group.id), onSuccess: gone });
  const rename = useMutation({
    mutationFn: (name: string) => renameGroup(group.id, name),
    onSuccess: (data) => {
      groupsChanged(data);
      setRenaming(false);
    },
  });
  // As in GroupsSection: leaving as the only member already deletes it.
  const soleMember = group.members.length <= 1;
  const canDelete = group.createdBy === youId && !soleMember;

  function ask(action: "leave" | "delete") {
    leave.reset();
    remove.reset();
    setConfirm(action);
  }

  return (
    <div className="min-h-screen bg-background">
      <PhoneSubHeader title={group.name} back="/groups" backLabel={t.groupsPage.title} />
      <main className="px-4 pb-8">
        <div className="mt-2 flex flex-col items-center text-center">
          {/* Coloured by its place in the list, as its row there is. */}
          <Avatar name={group.name} index={index} size="lg" />
          {renaming ? (
            <div className="mt-3 w-full">
              <InlineTextEdit
                value={group.name}
                maxLength={MAX_GROUP_NAME_LENGTH}
                submitting={rename.isPending}
                error={rename.error?.message ?? null}
                inputClassName="text-lg font-bold"
                onSubmit={(name) => rename.mutate(name)}
                onCancel={() => setRenaming(false)}
              />
            </div>
          ) : (
            <p className="mt-3 max-w-full break-words text-xl font-bold text-foreground">
              {group.name}
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            {t.counts.members(group.members.length)} ·{" "}
            {t.groupsSection.made(formatMonthYear(group.createdAt, lang))}
          </p>
        </div>

        <ListGroup title={t.groupsPage.members} footnote={t.groupPanel.whatMembersSeeBody}>
          {group.members.map((m, i) => (
            <ListRow
              key={m.profileId}
              leading={<Avatar name={m.name} index={i} size="row" />}
              label={m.isYou ? t.common.withYou(m.name) : m.name}
            />
          ))}
        </ListGroup>

        <ListGroup>
          <ListRow
            icon={UserPlus}
            label={t.groupsPage.invitePeople}
            onClick={() => setInviteOpen(true)}
          />
          <ListRow
            icon={Pencil}
            label={t.groupsSection.renameTitle}
            onClick={() => {
              rename.reset();
              setRenaming(true);
            }}
          />
        </ListGroup>

        <ListGroup>
          <ListRow
            icon={LogOut}
            label={soleMember ? t.groupPanel.deleteGroup : t.groupPanel.leaveGroup}
            tone="danger"
            onClick={() => ask("leave")}
          />
          {canDelete && (
            <ListRow
              icon={Trash2}
              label={t.groupsSection.deleteTitle}
              tone="danger"
              onClick={() => ask("delete")}
            />
          )}
        </ListGroup>

        {confirm && (
          <ConfirmPanel
            className="mt-3"
            message={
              confirm === "delete"
                ? t.groupsSection.deleteConfirm(group.name, group.members.length)
                : soleMember
                  ? t.groupsSection.leaveSole(group.name)
                  : t.groupPanel.leaveConfirm(group.name)
            }
            confirmLabel={
              confirm === "delete" || soleMember
                ? t.groupPanel.deleteGroup
                : t.groupPanel.leaveGroup
            }
            busy={leave.isPending || remove.isPending}
            error={(leave.error ?? remove.error)?.message}
            onConfirm={() => (confirm === "delete" ? remove : leave).mutate()}
            onCancel={() => setConfirm(null)}
          />
        )}
      </main>

      <InviteDialog group={group} open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </div>
  );
}
