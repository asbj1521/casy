import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";

import { friendsQuery, friendsQueryKey, groupsQuery, removeFriend } from "@/api/groups";
import AddFriendSheet from "@/components/groups/AddFriendSheet";
import Avatar from "@/components/ui/Avatar";
import ConfirmPanel from "@/components/ui/ConfirmPanel";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import { useSignedInUser } from "@/context/auth";
import { useT } from "@/i18n/lang";
import { knownPeople } from "@/lib/groups";

/**
 * Your friends, a screen in a phone's Profil sheet (#227): everyone you share
 * a group with or once did, each with where from. Only someone from a group
 * since gone, or added by link, can be removed: anyone else would be back at
 * the next look. "Tilføj en ven" sends a link (#226).
 */
export default function FriendsContent() {
  const t = useT();
  const userId = useSignedInUser().id;
  const queryClient = useQueryClient();
  const { data: friends } = useQuery(friendsQuery(userId));
  const { data: groups } = useQuery(groupsQuery(userId));
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<{ id: string; name: string } | null>(null);
  const remove = useMutation({
    mutationFn: removeFriend,
    onSuccess: (list) => {
      queryClient.setQueryData(friendsQueryKey(userId), list);
      setRemoving(null);
    },
  });
  if (!groups) return null; // almost always cached already

  const people = knownPeople(groups, undefined, friends);
  return (
    <>
      <ListGroup footnote={people.length === 0 ? t.friends.empty : t.friends.note}>
        <ListRow
          icon={UserPlus}
          tone="primary"
          label={t.friendLink.add}
          onClick={() => setAdding(true)}
        />
        {people.map((person, i) => (
          <ListRow
            key={person.profileId}
            leading={<Avatar name={person.name} index={i} size="row" src={person.avatarUrl} />}
            label={person.name}
            detail={
              person.groupNames.length > 0
                ? t.invite.from(person.groupNames.join(", "))
                : t.invite.fromPast
            }
            value={
              person.groupNames.length === 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    remove.reset();
                    setRemoving({ id: person.profileId, name: person.name });
                  }}
                  className="hit text-[0.8125rem] font-medium text-muted-foreground"
                >
                  {t.friends.remove}
                  <span className="sr-only"> {person.name}</span>
                </button>
              ) : undefined
            }
          />
        ))}
      </ListGroup>
      <AddFriendSheet open={adding} onClose={() => setAdding(false)} />
      {removing && (
        <ConfirmPanel
          message={t.friends.removeAsk(removing.name)}
          confirmLabel={t.friends.remove}
          busy={remove.isPending}
          error={remove.error?.message}
          onConfirm={() => remove.mutate(removing.id)}
          onCancel={() => setRemoving(null)}
        />
      )}
    </>
  );
}
