import { useId, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlignLeft,
  CalendarHeart,
  Flag,
  LogOut,
  Pencil,
  Plus,
  Trash2,
  UserPlus,
} from "lucide-react";

import {
  deleteGroup,
  groupsQueryKey,
  leaveGroup,
  renameGroup,
  setPrimeDates,
  type Group,
} from "@/api/groups";
import InlineTextEdit from "@/components/InlineTextEdit";
import EditGroupSheet from "@/components/groups/EditGroupSheet";
import GroupDescriptionSheet from "@/components/groups/GroupDescriptionSheet";
import InviteDialog from "@/components/InviteDialog";
import PictureButton from "@/components/pictures/PictureButton";
import { removeGroupPicture, setGroupPicture } from "@/api/pictures";
import ReportDialog from "@/components/safety/ReportDialog";
import Avatar from "@/components/ui/Avatar";
import ConfirmPanel from "@/components/ui/ConfirmPanel";
import HelpButton from "@/components/ui/HelpButton";
import { ListGroup, ListRow, ListSwitchRow } from "@/components/ui/ListGroup";
import { useLang, useT } from "@/i18n/lang";
import { formatMonthYear } from "@/lib/format";
import { MAX_GROUP_NAME_LENGTH } from "@/lib/groups";
import { MIN_GROUP_SIZE } from "@/lib/primeDates";

/**
 * One group: who's in it, and inviting, renaming, leaving or deleting it. A
 * phone's group screen ("screen": the heading centred under the avatar, its
 * picture, name and description changed in one sheet, #227) and
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
  const [describing, setDescribing] = useState(false);
  const [editing, setEditing] = useState(false);
  const membersHelp = useId();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  // The group's picture (#188): any member sets or removes it; the list is
  // fetched again so every row shows the new one.
  const [unreadable, setUnreadable] = useState<string | null>(null);
  const pictureChanged = () =>
    void queryClient.invalidateQueries({ queryKey: groupsQueryKey(youId) });
  const picture = useMutation({
    mutationFn: (image: string) => setGroupPicture(group.id, image),
    onSuccess: pictureChanged,
  });
  const unpicture = useMutation({
    mutationFn: () => removeGroupPicture(group.id),
    onSuccess: pictureChanged,
  });
  const pictureError = unreadable ?? (picture.error ?? unpicture.error)?.message ?? null;
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
  // Tid til hinanden (#171): your own home page's stars for this group, on
  // the switch at once while the choice is saved.
  const prime = useMutation({
    mutationFn: (on: boolean) => setPrimeDates(group.id, on),
    onSuccess: groupsChanged,
  });
  const primeOn = prime.isPending ? prime.variables : group.primeDates !== false;
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
      {centred ? (
        <div className="mt-2 text-center">
          <Avatar
            name={group.name}
            index={index}
            size="lg"
            src={group.pictureUrl}
            className="mx-auto h-24 w-24 text-[2rem]"
          />
          <p className="mt-3 break-words text-xl font-bold text-foreground">{group.name}</p>
          <p className="text-sm text-muted-foreground">
            {t.counts.members(group.members.length)} ·{" "}
            {t.groupsSection.made(formatMonthYear(group.createdAt, lang))}
          </p>
          {group.description && (
            <p className="mt-1 break-words text-[0.9375rem] text-foreground">{group.description}</p>
          )}
        </div>
      ) : (
        <div className="mt-6 flex min-w-0 items-center gap-4">
          <PictureButton
            label={group.pictureUrl ? t.pictures.changeGroup : t.pictures.addGroup}
            busy={picture.isPending}
            onPicked={(image) => {
              setUnreadable(null);
              picture.mutate(image);
            }}
            onError={setUnreadable}
          >
            <Avatar name={group.name} index={index} size="lg" src={group.pictureUrl} />
          </PictureButton>
          <div className="min-w-0 flex-1">
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
            {group.description && (
              <p className="mt-1 break-words text-[0.9375rem] text-foreground">
                {group.description}
              </p>
            )}
            {group.pictureUrl && (
              <button
                type="button"
                onClick={() => unpicture.mutate()}
                disabled={unpicture.isPending}
                className="mt-1 text-[0.8125rem] font-medium text-primary disabled:opacity-50"
              >
                {t.pictures.remove}
              </button>
            )}
            {pictureError && <p className="mt-1 text-[0.8125rem] text-red-600">{pictureError}</p>}
          </div>
        </div>
      )}

      <ListGroup
        title={
          centred ? (
            <span id={membersHelp} className="flex items-center gap-2">
              {t.groupsPage.members}
              <HelpButton label={t.groupsPage.whatMembersSee} anchorId={membersHelp}>
                {() => t.groupPanel.whatMembersSeeBody}
              </HelpButton>
            </span>
          ) : (
            t.groupsPage.members
          )
        }
        footnote={centred ? undefined : t.groupPanel.whatMembersSeeBody}
      >
        {group.members.map((m, i) => (
          <ListRow
            key={m.profileId}
            leading={<Avatar name={m.name} index={i} size="row" src={m.avatarUrl} />}
            label={m.isYou ? t.common.withYou(m.name) : m.name}
          />
        ))}
        {centred && (
          <ListRow
            icon={Plus}
            tone="primary"
            label={t.groupsPage.invitePeople}
            onClick={() => setInviteOpen(true)}
          />
        )}
      </ListGroup>

      {centred ? (
        <ListGroup>
          <ListRow icon={Pencil} label={t.groupsSection.edit} onClick={() => setEditing(true)} />
        </ListGroup>
      ) : (
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
          <ListRow
            icon={AlignLeft}
            label={group.description ? t.groupDescription.change : t.groupDescription.add}
            onClick={() => setDescribing(true)}
          />
        </ListGroup>
      )}

      {/* Stars are the phone's home page's (#171), and only groups of four or more get them. */}
      {centred && group.members.length >= MIN_GROUP_SIZE && (
        <ListGroup footnote={prime.error?.message ?? t.prime.switchFootnote}>
          <ListSwitchRow
            icon={CalendarHeart}
            label={t.prime.title}
            checked={primeOn}
            disabled={prime.isPending}
            onChange={(on) => prime.mutate(on)}
          />
        </ListGroup>
      )}

      <ListGroup>
        {/* Report or block (#142): only once there is someone else to report. */}
        {!soleMember && (
          <ListRow
            icon={Flag}
            label={t.safety.reportOrBlock}
            detail={centred ? undefined : t.safety.reportOrBlockDetail}
            onClick={() => setReporting(true)}
          />
        )}
        <ListRow
          icon={centred && soleMember ? Trash2 : LogOut}
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

      {centred ? (
        <EditGroupSheet
          group={group}
          index={index}
          userId={youId}
          open={editing}
          onClose={() => setEditing(false)}
        />
      ) : (
        <GroupDescriptionSheet
          group={group}
          userId={youId}
          open={describing}
          onClose={() => setDescribing(false)}
        />
      )}
      <InviteDialog group={group} open={inviteOpen} onClose={() => setInviteOpen(false)} />
      <ReportDialog
        open={reporting}
        onClose={() => setReporting(false)}
        group={group}
        choices={[
          {
            label: t.safety.targetGroup(group.name),
            target: { kind: "group", groupId: group.id },
          },
          ...group.members
            .filter((m) => !m.isYou)
            .map((m) => ({
              label: m.name,
              target: { kind: "member" as const, groupId: group.id, memberId: m.profileId },
              person: { id: m.profileId, name: m.name },
            })),
        ]}
      />
    </>
  );
}
