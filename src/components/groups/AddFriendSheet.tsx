import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { BookUser, Loader2 } from "lucide-react";

import { createFriendLink } from "@/api/groups";
import { LinkOutcome, LinkRows } from "@/components/groups/LinkRows";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import Notice from "@/components/ui/Notice";
import Sheet from "@/components/ui/Sheet";
import { useOpenRound } from "@/hooks/useOpenRound";
import { useT } from "@/i18n/lang";
import { inviteFromContacts } from "@/lib/contactInvite";
import { inviteExpiryLabel } from "@/lib/groups";
import { isNativeApp } from "@/lib/nativeApp";

/**
 * Adding a friend (#226), the way a member is invited: from the contacts (a
 * text with the link), a link to share, or its QR code. Whoever opens it says
 * yes there (pages/FriendLink).
 */
export default function AddFriendSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  // A new round each time it opens: no link from last time.
  return <AddFriend key={useOpenRound(open)} open={open} onClose={onClose} />;
}

function AddFriend({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const words = t.friendLink;
  const [showQr, setShowQr] = useState(false);
  const link = useMutation({ mutationFn: () => createFriendLink() });
  const contacts = useMutation({
    mutationFn: async () => {
      const url = (link.data ?? (await link.mutateAsync())).url;
      return await inviteFromContacts(url, {
        message: words.message,
        shareTitle: words.shareTitle,
      });
    },
  });
  const canShare = isNativeApp || typeof navigator.share === "function";

  return (
    <Sheet open={open} onClose={onClose} title={words.add} closeLabel={t.common.done}>
      <ListGroup className="mt-0">
        {isNativeApp && (
          <ListRow
            icon={BookUser}
            tone="primary"
            label={t.invite.fromContacts}
            value={contacts.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}
            onClick={() => contacts.mutate()}
          />
        )}
        <LinkRows
          link={link}
          canShare={canShare}
          shareTitle={words.shareTitle}
          message={words.message}
          showQr={showQr}
          setShowQr={setShowQr}
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
      {link.data && (
        <p className="mt-1.5 px-4 text-xs text-muted-foreground">
          {words.linkHelp(inviteExpiryLabel(link.data.expiresAt, t.inviteExpiry))}
        </p>
      )}
      <LinkOutcome link={link} showQr={showQr} qrLabel={words.shareTitle} qrHelp={words.qrHelp} />
    </Sheet>
  );
}
