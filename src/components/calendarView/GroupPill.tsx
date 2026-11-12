import { lazy, Suspense, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Mail, UserPlus } from "lucide-react";

import { groupsQuery, invitationsQuery } from "@/api/groups";
import HomePill from "@/components/calendarView/HomePill";
import { useSignedInUser } from "@/context/auth";
import { useT } from "@/i18n/lang";
import { groupNudge, inviteWasSent } from "@/lib/groupNudge";
import { isNativeApp } from "@/lib/nativeApp";

// On the page as the pill appears, ready for the first press (#169). The new group's sheet
// slides up rather than growing out of the pill: it opens the keyboard at once, and growing
// while the keyboard came left the sheet out of sight behind it on an iPhone.
const NewGroupDialog = lazy(() => import("@/components/NewGroupDialog"));
const InviteDialog = lazy(() => import("@/components/InviteDialog"));
const InvitePasteSheet = lazy(() => import("@/components/invite/InvitePasteSheet"));

/**
 * The next step while nobody else is in (#210): Casy does nothing until a
 * person's friends are, so with no group the home page offers to make one,
 * and alone in your groups to invite someone. Gone once anyone has joined.
 * In the app, someone with no group may have come by an invite that got
 * lost on the way through the App Store (#237): a second pill over the first
 * hands the app its link (InvitePasteSheet).
 */
export default function GroupPill({ hidden }: { hidden: boolean }) {
  const t = useT();
  const userId = useSignedInUser().id;
  const { data: groups } = useQuery(groupsQuery(userId));
  const { data: invitations } = useQuery(invitationsQuery(userId));
  const [making, setMaking] = useState(false);
  const [inviting, setInviting] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const [pasting, setPasting] = useState(false);
  const pasteButton = useRef<HTMLButtonElement>(null);

  const nudge = groupNudge(groups, invitations, (id) => inviteWasSent(userId, id));
  // Kept while its sheet is open or closing: making the group changes the nudge.
  const [invited, setInvited] = useState<{ id: string; name: string } | null>(null);
  const [newWanted, setNewWanted] = useState(false);
  if (nudge?.kind === "new" && !newWanted) setNewWanted(true);
  if (nudge?.kind === "invite" && invited?.id !== nudge.group.id && !inviting) {
    setInvited(nudge.group);
  }

  return (
    <>
      {/* Kept while its sheet is open: the sheet grows out of it, and an
          invitation sent there ends the nudge. Gone as the sheet closes. */}
      {(nudge || inviting) && (
        <HomePill
          icon={UserPlus}
          hidden={hidden || making || inviting}
          buttonRef={button}
          onClick={() => (nudge?.kind === "new" ? setMaking(true) : setInviting(true))}
        >
          {nudge?.kind === "new" ? t.homeNudge.newGroup : t.homeNudge.invite(invited?.name ?? "")}
        </HomePill>
      )}
      {isNativeApp && (nudge?.kind === "new" || pasting) && (
        <HomePill
          icon={Mail}
          raised
          hidden={hidden || making || pasting}
          buttonRef={pasteButton}
          onClick={() => setPasting(true)}
        >
          {t.invitePaste.have}
        </HomePill>
      )}
      <Suspense fallback={null}>
        {isNativeApp && newWanted && (
          <InvitePasteSheet open={pasting} onClose={() => setPasting(false)} origin={pasteButton} />
        )}
        {newWanted && (
          <NewGroupDialog open={making} onClose={() => setMaking(false)} onCreated={() => {}} />
        )}
        {invited && (
          <InviteDialog
            group={invited}
            open={inviting}
            onClose={() => setInviting(false)}
            origin={button}
          />
        )}
      </Suspense>
    </>
  );
}
