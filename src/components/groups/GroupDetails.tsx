import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LogOut, Pencil, Trash2, UserPlus } from "lucide-react";

import { deleteGroup, groupsQueryKey, leaveGroup, renameGroup, type Group } from "@/api/groups";
import InlineTextEdit from "@/components/InlineTextEdit";
import InviteDialog from "@/components/InviteDialog";
import Avatar from "@/components/ui/Avatar";
import ConfirmPanel from "@/components/ui/ConfirmPanel";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import { useLang, useT } from "@/i18n/lang";
import { formatMonthYear } from "@/lib/format";
import { MAX_GROUP_NAME_LENGTH } from "@/lib/groups";
import { cn } from "@/lib/utils";

/**
 * One group: who's in it, and inviting, renaming, leaving or deleting it. A
 * phone's group screen ("screen": the heading centred under the avatar) and
 * the right pane of a computer's groups page ("pane": beside it). Leaving or
 * deleting goes back to /groups.
 */
export default function GroupDetails({
  group,
  index,
  youId,
  layout,
}: {
  group: Group;
  /** Its place in the list, which colours its avatar as its row there. */
  index: number;
  youId: string;
  layout: "screen" | "pane";
}) {
  const t = useT();
  const { lang } = useLang();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirm, setConfirm] = useState<"leave" | "delete" | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);

  // Every change answers with your groups as they now are, straight into the
  // cache. Leaving or deleting goes back to the list.
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
  // Leaving a group you're the only member of already deletes it (see
  // leave_friend_group), so a separate delete would be the same thing twice.
  const soleMember = group.members.length <= 1;
  const canDelete = group.createdBy === youId && !soleMember;

  function ask(action: "leave" | "delete") {
    leave.reset();
    remove.reset();
    setConfirm(action);
  }

  const centred = layout === "screen";

  return (
    <>
      <div
        className={cn(
          "flex items-center gap-4",
          centred ? "mt-2 flex-col gap-0 text-center" : "mt-6 min-w-0",
        )}
      >
        <Avatar name={group.name} index={index} size="lg" />
        <div className={cn("min-w-0", centred ? "mt-3 w-full" : "flex-1")}>
          {renaming ? (
            <InlineTextEdit
              value={group.name}
              maxLength={MAX_GROUP_NAME_LENGTH}
              submitting={rename.isPending}
              error={rename.error?.message ?? null}
              inputClassName="text-lg font-bold"
              onSubmit={(name) => rename.mutate(name)}
              onCancel={() => setRenaming(false)}
            />
          ) : (
            <p className="break-words text-xl font-bold text-foreground">{group.name}</p>
          )}
          <p className="text-sm text-muted-foreground">
            {t.counts.members(group.members.length)} ·{" "}
            {t.groupsSection.made(formatMonthYear(group.createdAt, lang))}
          </p>
        </div>
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
            confirm === "delete" || soleMember ? t.groupPanel.deleteGroup : t.groupPanel.leaveGroup
          }
          busy={leave.isPending || remove.isPending}
          error={(leave.error ?? remove.error)?.message}
          onConfirm={() => (confirm === "delete" ? remove : leave).mutate()}
          onCancel={() => setConfirm(null)}
        />
      )}

      <InviteDialog group={group} open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </>
  );
}
