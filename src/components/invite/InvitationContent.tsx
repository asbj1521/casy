import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { groupsQuery, invitationsQuery, type Invitation } from "@/api/groups";
import {
  InviteAction,
  InviteBroken,
  InviteDetails,
  InviteLoading,
} from "@/components/invite/InviteScreen";
import ConfirmPanel from "@/components/ui/ConfirmPanel";
import FlowButton from "@/components/ui/FlowButton";
import Notice from "@/components/ui/Notice";
import { useSignedInUser } from "@/context/auth";
import { useInvitationAnswers } from "@/hooks/useInvitationAnswers";
import { useT } from "@/i18n/lang";
import { sheetAddress } from "@/lib/profileScreens";

/**
 * An invitation by name as a screen in the Profil sheet (#224), pushed from
 * its row under Grupper or arrived at from its notification: the invite page's
 * contents, centred in the sheet. Declining or blocking goes back to Grupper
 * (`onLeft`); joining closes the sheet the way Færdig does (`onJoined`, #230).
 */
export default function InvitationContent({
  groupId,
  onLeft,
  onJoined,
}: {
  groupId: string;
  onLeft: () => void;
  onJoined: () => void;
}) {
  const t = useT();
  const userId = useSignedInUser().id;
  const { data: invitations, isError } = useQuery(invitationsQuery(userId));
  const { data: groups } = useQuery(groupsQuery(userId));
  const found = invitations?.find((i) => i.groupId === groupId);
  // Kept once seen: answering takes it off the list on the way out of here.
  const [seen, setSeen] = useState<Invitation | null>(null);
  if (found && found !== seen) setSeen(found);
  const invitation = found ?? seen;

  // In the group already, from another phone or its link: nothing left to answer.
  if (!invitation && groups?.some((g) => g.id === groupId)) {
    return <Navigate to={sheetAddress(`groups/${groupId}`)} replace />;
  }
  return (
    <div className="flex flex-auto flex-col justify-center py-6 text-center">
      {invitation ? (
        <Answer invitation={invitation} onLeft={onLeft} onJoined={onJoined} />
      ) : invitations || isError ? (
        <InviteBroken title={t.join.gone} body={t.join.goneBody} />
      ) : (
        <InviteLoading />
      )}
    </div>
  );
}

function Answer({
  invitation,
  onLeft,
  onJoined,
}: {
  invitation: Invitation;
  onLeft: () => void;
  onJoined: () => void;
}) {
  const t = useT();
  const { accept, decline, block, busy, error } = useInvitationAnswers(invitation.groupId, {
    joined: onJoined,
    left: onLeft,
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
        sender
          ? (close) => (
              <button
                type="button"
                onClick={() => {
                  close();
                  block.reset();
                  setBlocking(true);
                }}
                disabled={busy}
                className="hit mt-4 font-medium text-red-700 disabled:opacity-60"
              >
                {t.safety.blockSender}
              </button>
            )
          : undefined
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
      {blocking && sender && (
        <ConfirmPanel
          message={t.safety.blockSenderConfirm(sender)}
          confirmLabel={t.safety.block}
          busy={block.isPending}
          error={block.error?.message}
          onConfirm={() => block.mutate()}
          onCancel={() => setBlocking(false)}
        />
      )}
    </InviteDetails>
  );
}
