import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Loader2, Users, X } from "lucide-react";

import { invitationsQuery, type Invitation } from "@/api/groups";
import Avatar from "@/components/ui/Avatar";
import ConfirmPanel from "@/components/ui/ConfirmPanel";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import Notice from "@/components/ui/Notice";
import { useSignedInUser } from "@/context/auth";
import { useInvitationAnswers } from "@/hooks/useInvitationAnswers";
import { usePhoneLayout } from "@/hooks/usePhoneLayout";
import { useT } from "@/i18n/lang";

/**
 * Invitations to groups, at the top of Groups: joining is the one thing here
 * that needs your yes before anyone sees your busy times, so a computer's card
 * says so. A phone's rows open the one invite page, which has it behind the ?.
 * Nothing at all when there are none.
 */
export default function InvitationsSection() {
  const t = useT();
  const userId = useSignedInUser().id;
  const { data: invitations = [] } = useQuery(invitationsQuery(userId));
  const phone = usePhoneLayout();
  if (invitations.length === 0) return null;

  // A phone lists them; each opens the one invite page (#224).
  if (phone) {
    return (
      <ListGroup title={t.events.invitations}>
        {invitations.map((invitation, i) => (
          <ListRow
            key={invitation.groupId}
            to={`/invited/${invitation.groupId}`}
            leading={
              <Avatar
                name={invitation.groupName}
                index={i}
                size="row"
                src={invitation.pictureUrl}
              />
            }
            label={invitation.groupName}
            detail={[invitation.invitedBy, t.counts.members(invitation.memberCount)]
              .filter(Boolean)
              .join(" · ")}
          />
        ))}
      </ListGroup>
    );
  }

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
  const { accept, decline, block, busy, error } = useInvitationAnswers(invitation.groupId);
  const [blocking, setBlocking] = useState(false);

  const blockRow =
    invitation.invitedBy &&
    (blocking ? (
      <ConfirmPanel
        className="mt-3"
        message={t.safety.blockSenderConfirm(invitation.invitedBy)}
        confirmLabel={t.safety.block}
        busy={block.isPending}
        error={block.error?.message}
        onConfirm={() => block.mutate()}
        onCancel={() => setBlocking(false)}
      />
    ) : (
      <button
        type="button"
        onClick={() => setBlocking(true)}
        disabled={busy}
        className="hit mt-3 text-xs font-medium text-muted-foreground transition hover:text-red-700 disabled:opacity-60"
      >
        {t.safety.blockSender}
      </button>
    ));

  return (
    <li className="rounded-2xl border border-primary/30 bg-card p-4 shadow-sm sm:p-5">
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-primary">
        <Users className="h-3.5 w-3.5" />
        {invitation.invitedBy ? t.events.invitedBy(invitation.invitedBy) : t.events.invitedAnon}
      </p>
      <p className="mt-1 break-words text-xl font-bold text-foreground">{invitation.groupName}</p>
      <p className="text-sm text-muted-foreground">{t.counts.members(invitation.memberCount)}</p>
      {invitation.groupDescription && (
        <p className="mt-2 break-words text-[0.9375rem] text-foreground">
          {invitation.groupDescription}
        </p>
      )}
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

      {blockRow}
    </li>
  );
}
