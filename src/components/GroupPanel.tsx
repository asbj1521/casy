import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { CalendarOff, Link2, Loader2, LogOut, UserPlus, Users } from "lucide-react";

import InfoTip from "@/components/InfoTip";
import Avatar from "@/components/ui/Avatar";
import Collapse from "@/components/ui/Collapse";
import ConfirmPanel from "@/components/ui/ConfirmPanel";
import CopyField from "@/components/ui/CopyField";
import Notice from "@/components/ui/Notice";
import { useAuth } from "@/context/auth";
import { useT } from "@/i18n/lang";
import { inviteExpiryLabel } from "@/lib/groups";
import type { SchedulingGroup } from "@/hooks/useSchedulingGroups";

/**
 * Who is in the group you are scheduling for, how to get more people in, and
 * how to get out: one full-width box under the answer, members as a row of
 * names with the invite and leave buttons beside the heading.
 *
 * The member list is honest about a gap real groups can have: someone who has
 * joined but linked no calendar yet, so nothing is known about their time.
 * That is said out loud rather than quietly folded into a result, because a
 * scheduling answer is only worth anything if you know whose calendars it was
 * based on. Real groups only: the page draws its own box for an example,
 * with SignUpNudge (below) beside it for a signed-out visitor.
 */
export default function GroupPanel({
  group,
  busyLoading,
  inviteUrl,
  inviteExpiresAt,
  invitePending,
  inviteError,
  onInvite,
  leavePending,
  onLeave,
  note,
}: {
  group: SchedulingGroup;
  busyLoading: boolean;
  inviteUrl: string | null;
  inviteExpiresAt: string | null;
  invitePending: boolean;
  inviteError: string | null;
  onInvite: () => void;
  leavePending: boolean;
  onLeave: () => void;
  /** A line under the heading, e.g. where the times come from. */
  note?: ReactNode;
}) {
  const t = useT();
  const [confirmingLeave, setConfirmingLeave] = useState(false);

  const memberCount = group.participants.length + group.waitingFor.length;
  // Until the calendars are in, nobody is known to lack one: everyone is
  // listed alike with a spinner, not all as "no calendar yet".
  const listed = busyLoading ? [...group.participants, ...group.waitingFor] : group.participants;
  const waiting = busyLoading ? [] : group.waitingFor;
  const lastOneIn = memberCount <= 1;

  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
          <Users className="h-4 w-4 text-primary" />
          {t.groupPanel.members(memberCount)}
          <InfoTip label={t.groupPanel.whatMembersSee}>{t.groupPanel.whatMembersSeeBody}</InfoTip>
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onInvite}
            disabled={invitePending}
            className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium text-foreground transition hover:bg-secondary disabled:opacity-50"
          >
            {invitePending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Link2 className="h-4 w-4" />
            )}
            {inviteUrl ? t.groupPanel.newInvite : t.groupPanel.invite}
          </button>
          {!confirmingLeave && (
            <button
              onClick={() => setConfirmingLeave(true)}
              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-red-50 hover:text-red-700"
            >
              <LogOut className="h-4 w-4" />
              {t.groupPanel.leaveGroup}
            </button>
          )}
        </div>
      </div>

      {/* Whose times the page is working from (or why it can't yet). */}
      {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}

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

      <Collapse open={!!inviteUrl}>
        <CopyField
          value={inviteUrl ?? ""}
          label={t.groupsSection.inviteLink}
          className="mt-4 max-w-2xl border-t pt-4"
        />
        <p className="mt-2 text-xs text-muted-foreground">
          {t.groupPanel.inviteInfo(
            inviteExpiresAt
              ? inviteExpiryLabel(inviteExpiresAt, t.inviteExpiry)
              : t.inviteExpiry.days(7),
          )}
        </p>
      </Collapse>

      {inviteError && (
        <Notice tone="error" bare className="mt-2">
          {inviteError}
        </Notice>
      )}

      {confirmingLeave && (
        <ConfirmPanel
          className="mt-4 max-w-2xl"
          message={
            lastOneIn ? t.groupPanel.lastMember(group.name) : t.groupPanel.leaveConfirm(group.name)
          }
          confirmLabel={lastOneIn ? t.groupPanel.deleteGroup : t.groupPanel.leaveGroup}
          busy={leavePending}
          onConfirm={onLeave}
          onCancel={() => setConfirmingLeave(false)}
        />
      )}
    </div>
  );
}

/**
 * For a logged-out visitor looking at the example groups: the one thing they
 * could do next. A signed-in person with no real groups yet already has a
 * profile, so it shows nothing for them.
 */
export function SignUpNudge() {
  const { user } = useAuth();
  const t = useT();
  if (user) return null;
  return (
    <div className="rounded-2xl border bg-card p-4">
      <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
        <UserPlus className="h-4 w-4 text-primary" />
        {t.groupPanel.noProfileTitle}
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">{t.groupPanel.noProfileBody}</p>
      <Link
        to="/sign-in?next=/&signup=1"
        className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
      >
        {t.groupPanel.signUp}
      </Link>
    </div>
  );
}
