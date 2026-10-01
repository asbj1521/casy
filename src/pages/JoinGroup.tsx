import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, Loader2, Users, XCircle } from "lucide-react";

import { groupsQuery, groupsQueryKey, joinGroup, previewInvite } from "@/api/groups";
import Notice from "@/components/ui/Notice";
import { useAuth } from "@/context/auth";
import { useT } from "@/i18n/lang";
import TopNav from "@/components/TopNav";

/**
 * The page an invite link lands on.
 *
 * It answers the question anyone following a link from a chat actually has:
 * what am I joining, and who else is in it? That much is shown before signing
 * in, because asking someone to hand over an account to see what they were
 * sent is backwards. Only the name and the number of members are revealed,
 * and only to whoever already holds the link.
 *
 * Joining itself needs an account, since a member with no account is nobody.
 * The sign-in page is told to come back here, so the link keeps working
 * through the detour.
 */
export default function JoinGroup() {
  const { token = "" } = useParams();
  const { user, loading } = useAuth();
  const t = useT();
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
    },
  });

  const here = `/join/${encodeURIComponent(token)}`;

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main className="mx-auto flex max-w-md flex-col px-4 py-8 sm:px-6 sm:py-16">
        <div className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
          {preview.isPending || loading ? (
            <div className="flex items-center gap-3 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              {t.join.opening}
            </div>
          ) : !invited ? (
            <>
              <h1 className="flex items-center gap-2 text-lg font-bold text-foreground">
                <XCircle className="h-5 w-5 text-red-600" />
                {t.join.broken}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {t.join.brokenBody(preview.error?.message ?? "")}
              </p>
              <Link
                to="/"
                className="mt-5 inline-flex rounded-lg border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-secondary"
              >
                {t.join.goToCasy}
              </Link>
            </>
          ) : (
            <>
              <h1 className="text-lg font-bold text-foreground">{t.join.invitedTo}</h1>
              <p className="mt-1 text-2xl font-bold text-foreground">{invited.name}</p>
              <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                {t.join.membersSoFar(invited.memberCount)}
              </p>

              <p className="mt-5 text-sm text-muted-foreground">{t.join.privacy}</p>

              {alreadyIn ? (
                <>
                  <p className="mt-5 text-sm font-medium text-foreground">{t.join.alreadyIn}</p>
                  <Link
                    to="/"
                    className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
                  >
                    <CalendarCheck className="h-4 w-4" />
                    {t.join.findDate}
                  </Link>
                </>
              ) : user ? (
                <>
                  <button
                    type="button"
                    onClick={() => join.mutate()}
                    disabled={join.isPending}
                    className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
                  >
                    {join.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    {t.join.joinGroup}
                  </button>
                  {join.isError && (
                    <Notice tone="error" bare className="mt-3">
                      {join.error.message}
                    </Notice>
                  )}
                </>
              ) : (
                <>
                  <Link
                    to={`/sign-in?next=${encodeURIComponent(here)}`}
                    className="mt-5 inline-flex rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
                  >
                    {t.join.signInToJoin}
                  </Link>
                  <p className="mt-3 text-xs text-muted-foreground">{t.join.comeBack}</p>
                </>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
