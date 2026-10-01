import { useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarOff, Link2, Loader2, LogOut, Users } from "lucide-react";

import { createInvite, groupsQueryKey, leaveGroup } from "@/api/groups";
import InfoTip from "@/components/InfoTip";
import Avatar from "@/components/ui/Avatar";
import Collapse from "@/components/ui/Collapse";
import ConfirmPanel from "@/components/ui/ConfirmPanel";
import CopyField from "@/components/ui/CopyField";
import Notice from "@/components/ui/Notice";
import { useSignedInUser } from "@/context/auth";
import type { SchedulingGroup } from "@/hooks/useSchedulingGroups";
import { useT } from "@/i18n/lang";
import { inviteExpiryLabel } from "@/lib/groups";

/**
 * Who is in the real group you are scheduling for, how to get more people
 * in, and how to get out: one full-width box under the answer, members as a
 * row of names with the invite and leave buttons beside the heading. The page
 * keys it by group, so an invite link never outlives the group it was for.
 *
 * The member list is honest about a gap real groups can have: someone who has
 * joined but linked no calendar yet, so nothing is known about their time.
 * That is said out loud rather than quietly folded into a result, because a
 * scheduling answer is only worth anything if you know whose calendars it was
 * based on.
 */
export default function GroupPanel({
  group,
  busyLoading,
  note,
  onLeft,
}: {
  group: SchedulingGroup;
  busyLoading: boolean;
  /** A line under the heading: where the times come from. */
  note: ReactNode;
  /** You left (or, as its last member, deleted) the group. */
  onLeft: () => void;
}) {
  const t = useT();
  const youId = useSignedInUser().id;
  const queryClient = useQueryClient();
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  // A fresh link every time: only a fingerprint of each is stored (see the
  // groups function), so an earlier one can't be shown again.
  const invite = useMutation({ mutationFn: () => createInvite(group.id) });
  const leave = useMutation({
    mutationFn: () => leaveGroup(group.id),
    onSuccess: (data) => {
      queryClient.setQueryData(groupsQueryKey(youId), data.groups);
      onLeft();
    },
  });

  // Until the calendars are in, nobody is known to lack one: everyone is
  // listed alike with a spinner, not all as "no calendar yet".
  const listed = busyLoading ? [...group.participants, ...group.waitingFor] : group.participants;
  const waiting = busyLoading ? [] : group.waitingFor;
  const lastOneIn = group.memberCount <= 1;

  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
          <Users className="h-4 w-4 text-primary" />
          {t.groupPanel.members(group.memberCount)}
          <InfoTip label={t.groupPanel.whatMembersSee}>{t.groupPanel.whatMembersSeeBody}</InfoTip>
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => invite.mutate()}
            disabled={invite.isPending}
            className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium text-foreground transition hover:bg-secondary disabled:opacity-50"
          >
            {invite.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Link2 className="h-4 w-4" />
            )}
            {invite.data ? t.groupPanel.newInvite : t.groupPanel.invite}
          </button>
          {!confirmingLeave && (
            <button
              type="button"
              onClick={() => {
                leave.reset();
                setConfirmingLeave(true);
              }}
              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-red-50 hover:text-red-700"
            >
              <LogOut className="h-4 w-4" />
              {t.groupPanel.leaveGroup}
            </button>
          )}
        </div>
      </div>

      <p className="mt-1 text-xs text-muted-foreground">{note}</p>

      <ul className="mt-3 flex flex-wrap gap-2">
        {listed.map((p, i) => (
          <li
            key={p.profileId}
            className="flex items-center gap-2 rounded-full border bg-card py-1 pl-1 pr-3 text-sm"
          >
            <Avatar name={p.name} index={i} />
            <span className="truncate text-foreground">{p.name}</span>
            {busyLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
          </li>
        ))}
        {waiting.map((m) => (
          <li
            key={m.profileId}
            className="flex items-center gap-2 rounded-full border border-dashed bg-card py-1 pl-1 pr-3 text-sm"
          >
            <Avatar name={m.name} index={0} className="bg-secondary text-muted-foreground" />
            <span className="truncate text-muted-foreground">{m.name}</span>
            <span className="flex items-center gap-1 whitespace-nowrap text-xs text-muted-foreground">
              <CalendarOff className="h-3 w-3" />
              {t.groupPanel.noCalendarYet}
            </span>
          </li>
        ))}
      </ul>

      {waiting.length > 0 && (
        <p className="mt-3 rounded-lg bg-secondary p-2.5 text-xs text-muted-foreground">
          {waiting.length === 1
            ? t.groupPanel.waitingOne(waiting[0].name)
            : t.groupPanel.waitingMany(waiting.length)}{" "}
          {t.groupPanel.waitingWhy}
        </p>
      )}

      <Collapse open={!!invite.data}>
        {invite.data && (
          <>
            <CopyField
              value={invite.data.url}
              label={t.groupsSection.inviteLink}
              className="mt-4 max-w-2xl border-t pt-4"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              {t.groupPanel.inviteInfo(inviteExpiryLabel(invite.data.expiresAt, t.inviteExpiry))}
            </p>
          </>
        )}
      </Collapse>

      {invite.isError && (
        <Notice tone="error" bare className="mt-2">
          {invite.error.message}
        </Notice>
      )}

      {confirmingLeave && (
        <ConfirmPanel
          className="mt-4 max-w-2xl"
          message={
            lastOneIn ? t.groupPanel.lastMember(group.name) : t.groupPanel.leaveConfirm(group.name)
          }
          confirmLabel={lastOneIn ? t.groupPanel.deleteGroup : t.groupPanel.leaveGroup}
          busy={leave.isPending}
          error={leave.error?.message}
          onConfirm={() => leave.mutate()}
          onCancel={() => setConfirmingLeave(false)}
        />
      )}
    </div>
  );
}
