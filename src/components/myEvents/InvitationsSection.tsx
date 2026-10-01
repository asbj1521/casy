import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Users, X } from "lucide-react";

import {
  acceptInvitation,
  declineInvitation,
  groupsQueryKey,
  invitationsQuery,
  invitationsQueryKey,
  type Invitation,
} from "@/api/groups";
import Notice from "@/components/ui/Notice";
import { useSignedInUser } from "@/context/auth";
import { useT } from "@/i18n/lang";

/**
 * Invitations to groups, at the top of My events: joining is the one thing
 * here that needs your yes before anyone sees your busy times, so it says so
 * on every card. Nothing at all when there are none.
 */
export default function InvitationsSection() {
  const t = useT();
  const userId = useSignedInUser().id;
  const { data: invitations = [] } = useQuery(invitationsQuery(userId));
  if (invitations.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-foreground">
        {t.events.invitations}
        <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
          {invitations.length}
        </span>
      </h2>
      <ul className="mt-3 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
        {invitations.map((invitation) => (
          <InvitationCard key={invitation.groupId} invitation={invitation} />
        ))}
      </ul>
    </section>
  );
}

function InvitationCard({ invitation }: { invitation: Invitation }) {
  const t = useT();
  const userId = useSignedInUser().id;
  const queryClient = useQueryClient();
  // Each answer comes back with your invitations as they now are; joining
  // also hands back your groups, the new one included.
  const accept = useMutation({
    mutationFn: () => acceptInvitation(invitation.groupId),
    onSuccess: (data) => {
      queryClient.setQueryData(groupsQueryKey(userId), data.groups);
      queryClient.setQueryData(invitationsQueryKey(userId), data.invitations);
    },
    onError: () => refresh(),
  });
  const decline = useMutation({
    mutationFn: () => declineInvitation(invitation.groupId),
    onSuccess: (data) => queryClient.setQueryData(invitationsQueryKey(userId), data.invitations),
    onError: () => refresh(),
  });
  // Gone meanwhile (the group was deleted, say): the fresh list drops this card.
  const refresh = () => queryClient.invalidateQueries({ queryKey: invitationsQueryKey(userId) });
  const busy = accept.isPending || decline.isPending;
  const error = (accept.error ?? decline.error)?.message;

  return (
    <li className="rounded-2xl border border-primary/30 bg-card p-4 shadow-sm sm:p-5">
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-primary">
        <Users className="h-3.5 w-3.5" />
        {invitation.invitedBy ? t.events.invitedBy(invitation.invitedBy) : t.events.invitedAnon}
      </p>
      <p className="mt-1 break-words text-xl font-bold text-foreground">{invitation.groupName}</p>
      <p className="text-sm text-muted-foreground">{t.counts.members(invitation.memberCount)}</p>
      <p className="mt-3 text-sm text-muted-foreground">{t.events.joinMeans}</p>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => {
            decline.reset();
            accept.mutate();
          }}
          disabled={busy}
          className="flex items-center justify-center gap-2 rounded-full bg-primary py-2.5 font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition hover:opacity-90 disabled:opacity-60"
        >
          {accept.isPending ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Check className="h-5 w-5" />
          )}
          {t.events.join}
        </button>
        <button
          type="button"
          onClick={() => {
            accept.reset();
            decline.mutate();
          }}
          disabled={busy}
          className="flex items-center justify-center gap-2 rounded-full border bg-background py-2.5 font-semibold text-foreground transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-60"
        >
          {decline.isPending ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <X className="h-5 w-5" />
          )}
          {t.events.noThanks}
        </button>
      </div>

      {error && (
        <Notice tone="error" bare className="mt-3">
          {error}
        </Notice>
      )}
    </li>
  );
}
