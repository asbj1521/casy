import { useEffect, useId, useRef } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { addFriend, friendsQueryKey, previewFriend } from "@/api/groups";
import {
  InviteAction,
  InviteBroken,
  InviteLoading,
  InviteShell,
} from "@/components/invite/InviteScreen";
import PhoneSubHeader from "@/components/PhoneSubHeader";
import TopNav from "@/components/TopNav";
import Avatar from "@/components/ui/Avatar";
import HelpButton from "@/components/ui/HelpButton";
import Notice from "@/components/ui/Notice";
import { useAuth } from "@/context/auth";
import { usePhoneLayout } from "@/hooks/usePhoneLayout";
import { useT } from "@/i18n/lang";
import { sheetAddress } from "@/lib/profileScreens";

/**
 * The page a friend link lands on (#226), looking as a group's invite does:
 * who is asking, and one answer. Tapping it is the yes. Someone with no account
 * says yes first, signs up, and comes back with `?add` to become friends at once.
 */
export default function FriendLink() {
  const { token = "" } = useParams();
  const { user, loading } = useAuth();
  const t = useT();
  const words = t.friendLink;
  const phone = usePhoneLayout();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const helpAnchor = useId();
  const [params] = useSearchParams();
  const preview = useQuery({
    queryKey: ["friend-preview", token],
    queryFn: () => previewFriend(token),
    retry: false,
  });
  const friend = preview.data?.friend;

  const add = useMutation({
    mutationFn: () => addFriend(token),
    onSuccess: (data) => {
      if (user) queryClient.setQueryData(friendsQueryKey(user.id), data.friends);
      navigate(phone ? sheetAddress("friends") : "/", { replace: true });
    },
  });

  const said = params.has("add");
  const adding = useRef(false);
  useEffect(() => {
    if (!said || !user || !friend || adding.current) return;
    adding.current = true;
    add.mutate();
  }, [said, user, friend, add]);

  const here = `/friend/${encodeURIComponent(token)}`;
  return (
    <InviteShell
      header={phone && user ? <PhoneSubHeader back="/" backLabel={t.nav.home} /> : <TopNav />}
    >
      {preview.isPending || loading ? (
        <InviteLoading />
      ) : !friend ? (
        <InviteBroken title={t.join.broken} body={preview.error?.message ?? ""} />
      ) : (
        <>
          <Avatar
            name={friend.name ?? "?"}
            index={0}
            size="lg"
            src={friend.avatarUrl}
            className="mx-auto h-28 w-28 text-[2.5rem] shadow-sm"
          />
          <h1 className="mt-5 text-[1.75rem] font-bold leading-tight text-foreground">
            {friend.name ? words.asks(friend.name) : words.asksAnon}
          </h1>
          <p
            id={helpAnchor}
            className="mt-2 flex items-center justify-center gap-2 text-[0.8125rem] text-muted-foreground"
          >
            {words.detail}
            <HelpButton label={words.about} anchorId={helpAnchor}>
              {() => words.promise}
            </HelpButton>
          </p>
          {!user && <p className="mt-4 text-[0.9375rem] text-foreground">{t.join.whatIsCasy}</p>}
          <div className="mt-8 flex flex-col gap-2">
            {user ? (
              <InviteAction onClick={() => add.mutate()} busy={add.isPending}>
                {words.accept}
              </InviteAction>
            ) : (
              <InviteAction to={`/sign-in?signup=1&next=${encodeURIComponent(`${here}?add=1`)}`}>
                {words.accept}
              </InviteAction>
            )}
            {add.isError && (
              <Notice tone="error" bare className="mt-1">
                {add.error.message}
              </Notice>
            )}
          </div>
        </>
      )}
    </InviteShell>
  );
}
