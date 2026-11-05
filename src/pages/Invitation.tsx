import { useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { groupsQuery, invitationsQuery, type Invitation as InvitationData } from "@/api/groups";
import {
  InviteAction,
  InviteBroken,
  InviteDetails,
  InviteLoading,
  InviteShell,
} from "@/components/invite/InviteScreen";
import PhoneSubHeader from "@/components/PhoneSubHeader";
import ConfirmPanel from "@/components/ui/ConfirmPanel";
import FlowButton from "@/components/ui/FlowButton";
import Notice from "@/components/ui/Notice";
import { useSignedInUser } from "@/context/auth";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useInvitationAnswers } from "@/hooks/useInvitationAnswers";
import { usePhoneLayout } from "@/hooks/usePhoneLayout";
import { useT } from "@/i18n/lang";
import { sheetAddress } from "@/lib/profileScreens";

/**
 * An invitation by name (/invited/:groupId) on the one invite page (#224),
 * opened from its row under Grupper or its notification. A computer answers
 * on its cards under Groups instead.
 */
export default function Invitation() {
  const { groupId = "" } = useParams();
  const phone = usePhoneLayout();
  if (!phone) return <Navigate to="/groups" replace />;
  return <PhoneInvitation key={groupId} groupId={groupId} />;
}

function PhoneInvitation({ groupId }: { groupId: string }) {
  const t = useT();
  useDocumentTitle(t.events.invitations);
  const userId = useSignedInUser().id;
  const { data: invitations, isError } = useQuery(invitationsQuery(userId));
  const { data: groups } = useQuery(groupsQuery(userId));
  const found = invitations?.find((i) => i.groupId === groupId);
  // Kept once seen: answering takes it off the list on the way out of here.
  const [seen, setSeen] = useState<InvitationData | null>(null);
  if (found && found !== seen) setSeen(found);
  const invitation = found ?? seen;

  const header = <PhoneSubHeader back={sheetAddress("groups")} backLabel={t.groupsPage.title} />;
  // In the group already, from another phone or its link: nothing left to answer.
  if (!invitation && groups?.some((g) => g.id === groupId)) {
    return <Navigate to={`/groups/${groupId}`} replace />;
  }
  return (
    <InviteShell header={header}>
      {invitation ? (
        <Answer invitation={invitation} />
      ) : invitations || isError ? (
        <InviteBroken title={t.join.gone} body={t.join.goneBody} />
      ) : (
        <InviteLoading />
      )}
    </InviteShell>
  );
}

function Answer({ invitation }: { invitation: InvitationData }) {
  const t = useT();
  const navigate = useNavigate();
  const { accept, decline, block, busy, error } = useInvitationAnswers(invitation.groupId, {
    joined: () => navigate("/", { replace: true }),
    left: () => navigate(sheetAddress("groups"), { replace: true }),
  });
  const [blocking, setBlocking] = useState(false);
  const sender = invitation.invitedBy;

  return (
    <InviteDetails
      invite={{
        name: invitation.groupName,
        description: invitation.groupDescription,
        memberCount: invitation.memberCount,
        invitedBy: sender,
        pictureUrl: invitation.pictureUrl,
      }}
      help={
        sender &&
        (blocking ? (
          <ConfirmPanel
            className="mt-4"
            message={t.safety.blockSenderConfirm(sender)}
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
            className="hit mt-4 text-[0.9375rem] font-medium text-red-700 disabled:opacity-60"
          >
            {t.safety.blockSender}
          </button>
        ))
      }
    >
      <InviteAction
        onClick={() => {
          decline.reset();
          accept.mutate();
        }}
        disabled={busy}
        busy={accept.isPending}
      >
        {t.join.joinGroup}
      </InviteAction>
      <FlowButton
        quiet
        onClick={() => {
          accept.reset();
          decline.mutate();
        }}
        disabled={busy}
        busy={decline.isPending}
      >
        {t.events.noThanks}
      </FlowButton>
      {error && (
        <Notice tone="error" bare className="mt-1">
          {error}
        </Notice>
      )}
    </InviteDetails>
  );
}
