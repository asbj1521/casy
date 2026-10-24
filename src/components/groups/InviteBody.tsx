import { lazy, Suspense } from "react";
import { BookUser, Check, Copy, Link2, Loader2, QrCode as QrIcon, Share } from "lucide-react";

import InvitePicker from "@/components/InvitePicker";
import FlowButton from "@/components/ui/FlowButton";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import Notice from "@/components/ui/Notice";
import { useCopy } from "@/hooks/useCopy";
import type { Invite } from "@/hooks/useInvite";
import { useT } from "@/i18n/lang";
import { inviteExpiryLabel } from "@/lib/groups";
import { isNativeApp } from "@/lib/nativeApp";
import { shareLink } from "@/lib/share";

// The QR library is only fetched once a code is asked for (#157).
const QrCode = lazy(() => import("@/components/ui/QrCode"));

/**
 * What an Invite sheet holds (#153), most used first: the contacts (in the
 * app), people from your groups and email, then a link or its QR code. Its
 * main button, sending the picks, is the sheet's (InviteDialog, NewGroupDialog).
 */
export default function InviteBody({ invite }: { invite: Invite }) {
  const t = useT();
  const { group, link, contacts, showQr, setShowQr } = invite;
  const [copied, copy] = useCopy();

  function toggleQr() {
    setShowQr(!showQr);
    if (!link.data && !link.isPending) link.mutate();
  }

  return (
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

      {isNativeApp && (
        <>
          <ListGroup className="mt-0">
            <ListRow
              icon={BookUser}
              tone="primary"
              label={t.invite.fromContacts}
              value={contacts.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}
              onClick={() => contacts.mutate()}
            />
          </ListGroup>
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
        {link.data ? (
          <ListRow
            icon={Link2}
            label={link.data.url}
            value={
              <span className="flex items-center gap-1 text-primary">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? t.common.copied : t.common.copy}
              </span>
            }
            onClick={() => copy(link.data!.url)}
          />
        ) : (
          <ListRow
            icon={Link2}
            label={link.isPending ? t.invite.makingLink : t.invite.makeLink}
            value={link.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}
            onClick={() => !link.isPending && link.mutate()}
          />
        )}
        {link.data && invite.canShare && (
          <ListRow
            icon={Share}
            label={t.invite.shareLink}
            onClick={() =>
              void shareLink({
                title: t.invite.shareTitle(group.name),
                text: invite.message,
                url: link.data!.url,
              })
            }
          />
        )}
        <ListRow
          icon={QrIcon}
          label={showQr ? t.invite.hideQr : t.invite.showQr}
          expanded={showQr}
          onClick={toggleQr}
        />
      </ListGroup>
      {showQr && link.data && (
        <figure className="mt-3 flex flex-col items-center gap-2">
          <Suspense fallback={<div className="h-56 w-56 rounded-xl bg-white" />}>
            <QrCode
              value={link.data.url}
              label={t.invite.qrLabel(group.name)}
              className="h-56 w-56 rounded-xl"
            />
          </Suspense>
          <figcaption className="text-center text-xs text-muted-foreground">
            {t.invite.qrHelp}
          </figcaption>
        </figure>
      )}
      {link.isError && (
        <Notice tone="error" bare className="mt-2">
          {link.error.message}
        </Notice>
      )}
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
