import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, LogOut, Pencil, Trash2, UserPlus, Users } from "lucide-react";

import {
  createGroup,
  deleteGroup,
  groupsQuery,
  groupsQueryKey,
  leaveGroup,
  renameGroup,
  type Group,
} from "@/api/groups";
import InfoTip from "@/components/InfoTip";
import InlineTextEdit from "@/components/InlineTextEdit";
import InviteDialog from "@/components/InviteDialog";
import NewGroupDialog from "@/components/NewGroupDialog";
import Avatar from "@/components/ui/Avatar";
import ConfirmPanel from "@/components/ui/ConfirmPanel";
import Notice from "@/components/ui/Notice";
import { useSignedInUser } from "@/context/auth";
import { useLang, useT } from "@/i18n/lang";
import { formatMonthYear } from "@/lib/format";
import { MAX_GROUP_NAME_LENGTH } from "@/lib/groups";
import { cn } from "@/lib/utils";

/**
 * The profile page's "Your groups": every group you're in, who else is in
 * each one, and a way out: leave any of them, or delete one you made
 * outright (which removes it for every member, not just you). Also where a
 * new group is made, and more people invited to one.
 */
export default function GroupsSection() {
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
  const openNewGroup = () => {
    create.reset();
    setNewGroupOpen(true);
  };

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="flex items-center gap-1.5 text-lg font-semibold text-foreground">
          {t.groupsSection.title}
          <InfoTip label={t.groupPanel.whatMembersSee}>{t.groupPanel.whatMembersSeeBody}</InfoTip>
        </h2>
        <button
          type="button"
          onClick={openNewGroup}
          className="flex shrink-0 items-center gap-2 rounded-full border bg-background px-3.5 py-1.5 text-sm font-semibold text-foreground transition hover:bg-secondary"
        >
          <Users className="h-4 w-4" />
          {t.groupsSection.makeGroup}
        </button>
      </div>

      {isPending ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t.groupsSection.loading}
        </p>
      ) : isError ? (
        <Notice tone="error" bare className="mt-4">
          {t.groupsSection.loadFailed}
        </Notice>
      ) : groups.length === 0 ? (
        <p className="mt-4 rounded-lg bg-secondary p-3 text-sm text-muted-foreground">
          {t.groupsSection.empty(
            <button
              type="button"
              onClick={openNewGroup}
              className="font-medium text-foreground underline underline-offset-2"
            >
              {t.groupsSection.makeOne}
            </button>,
          )}
        </p>
      ) : (
        <ul className="mt-4 divide-y border-t">
          {groups.map((g) => (
            <GroupRow key={g.id} group={g} youId={youId} />
          ))}
        </ul>
      )}

      <NewGroupDialog
        open={newGroupOpen}
        submitting={create.isPending}
        error={create.error?.message ?? null}
        onSubmit={(group) => create.mutate(group)}
        onCancel={() => setNewGroupOpen(false)}
      />
    </section>
  );
}

/**
 * One group: its member avatars, its name (click the pencil to rename it),
 * and the invite, leave and delete controls, each with its own state.
 */
function GroupRow({ group, youId }: { group: Group; youId: string }) {
  const { lang } = useLang();
  const t = useT();
  const queryClient = useQueryClient();
  const [confirm, setConfirm] = useState<"leave" | "delete" | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);

  // Every change answers with your groups as they now are, straight into the
  // cache; a group you left or deleted takes this row with it.
  const groupsChanged = (data: { groups: Group[] }) =>
    queryClient.setQueryData(groupsQueryKey(youId), data.groups);
  const leave = useMutation({ mutationFn: () => leaveGroup(group.id), onSuccess: groupsChanged });
  const remove = useMutation({ mutationFn: () => deleteGroup(group.id), onSuccess: groupsChanged });
  const rename = useMutation({
    mutationFn: (name: string) => renameGroup(group.id, name),
    onSuccess: (data) => {
      groupsChanged(data);
      setRenaming(false);
    },
  });
  // Leaving a group you're the only member of already deletes it (see
  // leave_friend_group), so a separate delete button would just be a second
  // way to do the same thing.
  const soleMember = group.members.length <= 1;
  const canDelete = group.createdBy === youId && !soleMember;

  function ask(action: "leave" | "delete") {
    leave.reset();
    remove.reset();
    setConfirm(action);
  }

  function startRename(open: boolean) {
    rename.reset();
    setRenaming(open);
  }

  return (
    <li className="py-4">
      {/* On a phone the actions wrap onto their own line under the name, so
          the name isn't squeezed down to a few letters. */}
      <div className="flex flex-wrap items-start gap-x-3 gap-y-3 sm:flex-nowrap">
        {/* Fixed width regardless of member count (1 to 4 avatars, plus a
            "+N" badge past 4), so the group name starts at the same spot
            on every row instead of drifting with the avatar count. Right
            aligned so the avatars sit right next to the name; any leftover
            space lands before the avatars instead of between them and the
            name. */}
        <div className="flex w-32 shrink-0 justify-end -space-x-2">
          {group.members.slice(0, 4).map((m, i) => (
            <Avatar
              key={m.profileId}
              name={m.name}
              index={i}
              size="md"
              labelled
              className="border-2 border-card"
            />
          ))}
          {group.members.length > 4 && (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-card bg-secondary text-xs font-semibold text-muted-foreground">
              +{group.members.length - 4}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          {renaming ? (
            <InlineTextEdit
              value={group.name}
              maxLength={MAX_GROUP_NAME_LENGTH}
              submitting={rename.isPending}
              error={rename.error?.message ?? null}
              onSubmit={(name) => rename.mutate(name)}
              onCancel={() => startRename(false)}
            />
          ) : (
            <p className="flex min-w-0 items-center gap-1 text-sm font-semibold text-foreground">
              <span className="truncate">{group.name}</span>
              <button
                type="button"
                onClick={() => startRename(true)}
                title={t.groupsSection.renameTitle}
                aria-label={t.groupsSection.renameTitle}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground"
              >
                <Pencil className="h-3 w-3" />
              </button>
            </p>
          )}
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t.counts.members(group.members.length)} ·{" "}
            {t.groupsSection.made(formatMonthYear(group.createdAt, lang))}
          </p>
        </div>

        <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto">
          <button
            type="button"
            onClick={() => setInviteOpen(true)}
            title={t.groupsSection.inviteTitle}
            className="flex items-center gap-1.5 rounded-full border bg-background px-3.5 py-1.5 text-sm font-semibold text-foreground transition hover:bg-secondary"
          >
            <UserPlus className="h-4 w-4" />
            {t.groupsSection.invite}
          </button>
          <button
            type="button"
            onClick={() => ask("leave")}
            title={t.groupsSection.leaveTitle}
            aria-label={t.groupsSection.leaveTitle}
            className="flex h-8 w-8 items-center justify-center rounded-full border bg-background text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
          {/* Always reserve this button's space, even when it doesn't apply
              to this group, so the invite button lines up at the same
              spot on every row instead of drifting with who can delete. */}
          <button
            type="button"
            onClick={canDelete ? () => ask("delete") : undefined}
            title={canDelete ? t.groupsSection.deleteTitle : undefined}
            aria-label={canDelete ? t.groupsSection.deleteTitle : undefined}
            aria-hidden={!canDelete}
            tabIndex={canDelete ? 0 : -1}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full border bg-background text-muted-foreground transition hover:bg-red-50 hover:text-red-700",
              !canDelete && "invisible",
            )}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <InviteDialog group={group} open={inviteOpen} onClose={() => setInviteOpen(false)} />

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
    </li>
  );
}
