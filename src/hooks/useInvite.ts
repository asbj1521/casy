import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createInvite,
  groupsQuery,
  groupsQueryKey,
  inviteMembers,
  type Invitees,
} from "@/api/groups";
import { useSignedInUser } from "@/context/auth";
import { useT } from "@/i18n/lang";
import { inviteFromContacts } from "@/lib/contactInvite";
import { knownPeople } from "@/lib/groups";
import { isNativeApp } from "@/lib/nativeApp";
import { askForPush } from "@/lib/pushAsk";

const NOBODY: Invitees = { profileIds: [], emails: [] };

/**
 * Bringing people into a group (#153): its sheet's body (InviteBody) and its
 * main button share this. Three ways: tick people you know from your other
 * groups or type an email (an invitation they answer), a link anyone holding
 * it can join by (also as a QR code, #150), and in the app the contacts,
 * texted the link (#149).
 */
export function useInvite(group: { id: string; name: string }) {
  const t = useT();
  const userId = useSignedInUser().id;
  const queryClient = useQueryClient();
  const { data: groups = [] } = useQuery(groupsQuery(userId));
  const [invitees, setInvitees] = useState<Invitees>(NOBODY);
  // What the last send said, kept after the picks are cleared.
  const [sentNote, setSentNote] = useState<"sent" | "sentWithEmail" | null>(null);
  const count = invitees.profileIds.length + invitees.emails.length;

  const send = useMutation({
    mutationFn: () => inviteMembers(group.id, invitees),
    // The answer marks the people as invited in your groups, so the list
    // shows them so once the picks are cleared.
    onSuccess: (data) => {
      queryClient.setQueryData(groupsQueryKey(userId), data.groups);
      setSentNote(invitees.emails.length > 0 ? "sentWithEmail" : "sent");
      setInvitees(NOBODY);
      // Waiting for their answers: the moment to offer notifications (#139).
      askForPush("joined");
    },
  });
  // A fresh link every time: only a fingerprint of each is stored (see the
  // groups function), so an earlier one can't be shown again.
  const link = useMutation({ mutationFn: () => createInvite(group.id) });
  const [showQr, setShowQr] = useState(false);
  const message = t.invite.message(group.name);
  // Contacts picked, the link made here if there is none yet, and Messages
  // opened with them; a phone that can't text gets the share sheet instead.
  const contacts = useMutation({
    mutationFn: async () => {
      const url = (link.data ?? (await link.mutateAsync())).url;
      return await inviteFromContacts(
        { id: group.id, url },
        { message, shareTitle: t.invite.shareTitle(group.name) },
      );
    },
  });

  return {
    group,
    groups,
    people: knownPeople(groups, group.id),
    invited: groups.find((g) => g.id === group.id)?.invited ?? [],
    invitees,
    setInvitees: (value: Invitees) => {
      setInvitees(value);
      setSentNote(null);
    },
    count,
    send,
    /** Enter in a field, or the sheet's main button, sends the picks. */
    submit: (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (count > 0) send.mutate();
    },
    sentNote,
    link,
    contacts,
    showQr,
    setShowQr,
    canShare: isNativeApp || typeof navigator.share === "function",
    message,
  };
}

export type Invite = ReturnType<typeof useInvite>;
