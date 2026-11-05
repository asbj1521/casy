import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { friendsQuery, friendsQueryKey, groupsQuery, removeFriend } from "@/api/groups";
import Avatar from "@/components/ui/Avatar";
import ConfirmPanel from "@/components/ui/ConfirmPanel";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import { useSignedInUser } from "@/context/auth";
import { useT } from "@/i18n/lang";
import { friendsOutsideGroups } from "@/lib/groups";

/**
 * People you no longer share a group with (#222), who can still be invited:
 * everyone else is listed under their group already. Each can be removed.
 * Nothing at all until there is someone to list.
 */
export default function FriendsSection() {
  const t = useT();
  const words = t.friends;
  const userId = useSignedInUser().id;
  const queryClient = useQueryClient();
  const { data: friends } = useQuery(friendsQuery(userId));
  const { data: groups } = useQuery(groupsQuery(userId));
  const [removing, setRemoving] = useState<string | null>(null);
  const remove = useMutation({
    mutationFn: removeFriend,
    onSuccess: (list) => {
      queryClient.setQueryData(friendsQueryKey(userId), list);
      setRemoving(null);
    },
  });

  // Until the groups are known, anyone could still be in one of them.
  const shown = groups ? friendsOutsideGroups(friends ?? [], groups) : [];
  if (shown.length === 0) return null;

  return (
    <ListGroup title={words.title} footnote={words.note}>
      {shown.map((friend, i) => (
        <ListRow
          key={friend.profileId}
          leading={
            <Avatar name={friend.name} index={i} size="row" src={friend.avatarUrl ?? undefined} />
          }
          label={friend.name}
          value={
            removing === friend.profileId ? undefined : (
              <button
                type="button"
                onClick={() => {
                  remove.reset();
                  setRemoving(friend.profileId);
                }}
                className="hit text-[0.8125rem] font-medium text-muted-foreground"
              >
                {words.remove}
                <span className="sr-only"> {friend.name}</span>
              </button>
            )
          }
          detail={
            removing === friend.profileId ? (
              <ConfirmPanel
                className="mt-2 whitespace-normal"
                message={words.removeAsk(friend.name)}
                confirmLabel={words.remove}
                busy={remove.isPending}
                error={remove.error?.message}
                onConfirm={() => remove.mutate(friend.profileId)}
                onCancel={() => setRemoving(null)}
              />
            ) : undefined
          }
        />
      ))}
    </ListGroup>
  );
}
