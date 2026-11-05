import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  acceptInvitation,
  declineInvitation,
  groupsQueryKey,
  invitationsQueryKey,
} from "@/api/groups";
import { blockedQueryKey, blockPerson } from "@/api/safety";
import { useSignedInUser } from "@/context/auth";
import { askForPush } from "@/lib/pushAsk";

/** Saying yes or no to an invitation by name, or blocking who sent it. */
export function useInvitationAnswers(
  groupId: string,
  after?: { joined?: () => void; left?: () => void },
) {
  const userId = useSignedInUser().id;
  const queryClient = useQueryClient();
  // Gone meanwhile (the group was deleted, say): the fresh list drops it.
  const refresh = () => queryClient.invalidateQueries({ queryKey: invitationsQueryKey(userId) });
  // Each answer comes back with your invitations as they now are; joining
  // also hands back your groups, the new one included.
  const accept = useMutation({
    mutationFn: () => acceptInvitation(groupId),
    onSuccess: (data) => {
      queryClient.setQueryData(groupsQueryKey(userId), data.groups);
      queryClient.setQueryData(invitationsQueryKey(userId), data.invitations);
      after?.joined?.();
      // Joined: the moment to offer notifications (#139).
      askForPush("joined");
    },
    onError: () => refresh(),
  });
  const decline = useMutation({
    mutationFn: () => declineInvitation(groupId),
    onSuccess: (data) => {
      queryClient.setQueryData(invitationsQueryKey(userId), data.invitations);
      after?.left?.();
    },
    onError: () => refresh(),
  });
  // Blocking the sender (#142): the invitation is declined, and none come from them again.
  const block = useMutation({
    mutationFn: () => blockPerson({ invitationGroupId: groupId }),
    onSuccess: (data) => {
      queryClient.setQueryData(invitationsQueryKey(userId), data.invitations);
      queryClient.setQueryData(blockedQueryKey(userId), data.blocked);
      after?.left?.();
    },
  });
  return {
    accept,
    decline,
    block,
    busy: accept.isPending || decline.isPending,
    error: (accept.error ?? decline.error)?.message,
  };
}
