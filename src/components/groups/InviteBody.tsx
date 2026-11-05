import { BookUser, Loader2 } from "lucide-react";

import { LinkOutcome, LinkRows } from "@/components/groups/LinkRows";
import InvitePicker, { EmailField, EmailRows, PeopleList } from "@/components/InvitePicker";
import FlowButton from "@/components/ui/FlowButton";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import Notice from "@/components/ui/Notice";
import { useEmailEntry } from "@/hooks/useEmailEntry";
import type { Invite } from "@/hooks/useInvite";
import { usePhoneLayout } from "@/hooks/usePhoneLayout";
import { useT } from "@/i18n/lang";
import { inviteExpiryLabel } from "@/lib/groups";
import { isNativeApp } from "@/lib/nativeApp";

/**
 * What an Invite sheet holds (#153), most used first: the contacts (in the
 * app), people from your groups and email, then a link or its QR code. Its
 * main button, sending the picks, is the sheet's (InviteDialog, NewGroupDialog).
 * On a phone the ways that need no list come first, in one group, and the
 * people after them, folded past a few (#227).
 */
export default function InviteBody({ invite }: { invite: Invite }) {
  const t = useT();
  const { group, link, contacts, showQr, setShowQr } = invite;
  const phone = usePhoneLayout();
  const email = useEmailEntry(invite.invitees, invite.setInvitees);

  const contactRow = (
    <ListRow
      icon={BookUser}
      tone="primary"
      label={t.invite.fromContacts}
      value={contacts.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}
      onClick={() => contacts.mutate()}
    />
  );
  const contactNotes = (
    <>
      {contacts.data === "sent" && (
        <Notice tone="success" className="mt-2">
          {t.invite.texted}
        </Notice>
      )}
      {(contacts.data === "failed" || contacts.isError) && (
        <Notice tone="error" className="mt-2">
          {t.invite.textFailed}
        </Notice>
      )}
    </>
  );
  const linkRows = (
    <LinkRows
      link={link}
      canShare={invite.canShare}
      shareTitle={t.invite.shareTitle(group.name)}
      message={invite.message}
      showQr={showQr}
      setShowQr={setShowQr}
    />
  );
  const linkOutcome = (
    <LinkOutcome
      link={link}
      showQr={showQr}
      qrLabel={t.invite.qrLabel(group.name)}
      qrHelp={t.invite.qrHelp}
    />
  );
  const sentNotices = (
    <>
      {invite.sentNote && (
        <Notice tone="success" className="mb-4">
          {t.invite[invite.sentNote]}
        </Notice>
      )}
      {invite.send.isError && (
        <Notice tone="error" className="mb-4">
          {invite.send.error.message}
        </Notice>
      )}
    </>
  );

  if (phone) {
    return (
      <>
        {sentNotices}
        <ListGroup className="mt-0">
          {isNativeApp && contactRow}
          <EmailRows email={email} value={invite.invitees} onChange={invite.setInvitees} />
          {linkRows}
        </ListGroup>
        {isNativeApp && contactNotes}
        <EmailField email={email} />
        {link.data && (
          <p className="mt-1.5 px-4 text-xs text-muted-foreground">
            {t.invite.linkHelp(inviteExpiryLabel(link.data.expiresAt, t.inviteExpiry))}
          </p>
        )}
        {linkOutcome}
        <PeopleList
          folded
          people={invite.people}
          invited={invite.invited}
          allInWhenEmpty={invite.groups.length > 1}
          value={invite.invitees}
          onChange={invite.setInvitees}
        />
      </>
    );
  }

  return (
    <>
      {sentNotices}

      {isNativeApp && (
        <>
          <ListGroup className="mt-0">{contactRow}</ListGroup>
          {contactNotes}
        </>
      )}

      <InvitePicker
        people={invite.people}
        invited={invite.invited}
        allInWhenEmpty={invite.groups.length > 1}
        value={invite.invitees}
        onChange={invite.setInvitees}
      />

      <ListGroup
        title={t.invite.orLink}
        footnote={
          link.data
            ? t.invite.linkHelp(inviteExpiryLabel(link.data.expiresAt, t.inviteExpiry))
            : undefined
        }
      >
        {linkRows}
      </ListGroup>
      {linkOutcome}
    </>
  );
}

/** The Invite's main button, for the sheet's footer: only once someone is picked. */
export function SendButton({ invite }: { invite: Invite }) {
  const t = useT();
  return invite.count > 0 ? (
    <FlowButton type="submit" busy={invite.send.isPending}>
      {t.invite.send(invite.count)}
    </FlowButton>
  ) : null;
}
