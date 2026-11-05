import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { groupsQuery, groupsQueryKey, joinGroup, previewInvite } from "@/api/groups";
import { useAuth } from "@/context/auth";
import { askForPush } from "@/lib/pushAsk";

/** What an invite link leads to, and joining by it. */
export function useLinkInvite(token: string) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const preview = useQuery({
    queryKey: ["invite-preview", token],
    queryFn: () => previewInvite(token),
    retry: false,
  });
  const invited = preview.data?.group;

  // Someone who is already a member gets a different button: the link is not
  // an error for them, it simply has nothing left to do. Their groups are
  // usually remembered from an earlier visit (queryPersistence.ts), so this
  // rarely waits on the network.
  const { data: myGroups } = useQuery({ ...groupsQuery(user?.id ?? ""), enabled: !!user });
  const alreadyIn = !!invited && !!myGroups?.some((g) => g.id === invited.id);

  const join = useMutation({
    mutationFn: () => joinGroup(token),
    onSuccess: (data) => {
      // The reply carries the new list, so the scheduling page has it already
      // and doesn't ask again the moment it opens.
      if (user) queryClient.setQueryData(groupsQueryKey(user.id), data.groups);
      navigate("/", { replace: true });
      // Joined: the moment to offer notifications (#139).
      askForPush("joined");
    },
  });

  return {
    user,
    loading,
    preview,
    invited,
    alreadyIn,
    join,
    here: `/join/${encodeURIComponent(token)}`,
  };
}
