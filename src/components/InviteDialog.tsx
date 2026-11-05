import type { RefObject } from "react";

import InviteBody, { SendButton } from "@/components/groups/InviteBody";
import Sheet from "@/components/ui/Sheet";
import { useInvite } from "@/hooks/useInvite";
import { useOpenRound } from "@/hooks/useOpenRound";
import { useT } from "@/i18n/lang";

/**
 * Bringing more people into a group you're in (#153): a sheet on a phone, a
 * dialog on a computer, holding InviteBody. Its one main button sends the
 * invitations picked, and appears only once someone is.
 */
export default function InviteDialog({
  group,
  open,
  onClose,
  origin,
}: {
  group: { id: string; name: string };
  open: boolean;
  onClose: () => void;
  /** On a phone: the button the sheet grows out of (#169). */
  origin?: RefObject<HTMLElement | null>;
}) {
  // A new round each time it opens: nobody picked, no link from last time.
  return (
    <InviteSheet
      key={useOpenRound(open)}
      group={group}
      open={open}
      onClose={onClose}
      origin={origin}
    />
  );
}

function InviteSheet({
  group,
  open,
  onClose,
  origin,
}: {
  group: { id: string; name: string };
  open: boolean;
  onClose: () => void;
  /** On a phone: the button the sheet grows out of (#169). */
  origin?: RefObject<HTMLElement | null>;
}) {
  const t = useT();
  const invite = useInvite(group);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t.invite.title(group.name)}
      closeLabel={t.common.done}
      onSubmit={invite.submit}
      origin={origin}
      footer={<SendButton invite={invite} />}
    >
      <InviteBody invite={invite} />
    </Sheet>
  );
}
