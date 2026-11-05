import { Link, useParams } from "react-router-dom";
import { CalendarCheck, Loader2, Users, XCircle } from "lucide-react";

import {
  InviteAction,
  InviteBroken,
  InviteDetails,
  InviteLoading,
  InviteShell,
} from "@/components/invite/InviteScreen";
import PhoneSubHeader from "@/components/PhoneSubHeader";
import Notice from "@/components/ui/Notice";
import { useLinkInvite } from "@/hooks/useLinkInvite";
import { usePhoneLayout } from "@/hooks/usePhoneLayout";
import { useT } from "@/i18n/lang";
import TopNav from "@/components/TopNav";

/**
 * The page an invite link lands on.
 *
 * It answers the question anyone following a link from a chat actually has:
 * what am I joining, and who else is in it? That much is shown before signing
 * in, because asking someone to hand over an account to see what they were
 * sent is backwards. Only who made the link, the name, what the group is for,
 * its picture (or the maker's) and the number of members are revealed, and only to whoever already holds
 * the link. A friend following it may never have heard of Casy, so signed out
 * it says in one line what Casy is (#211).
 *
 * Joining itself needs an account, since a member with no account is nobody.
 * The sign-in page is told to come back here, so the link keeps working
 * through the detour. A phone shows it as the one invite page (#224).
 */
export default function JoinGroup() {
  const { token = "" } = useParams();
  const phone = usePhoneLayout();
  return phone ? <PhoneJoin token={token} /> : <ComputerJoin token={token} />;
}

/** A link on the one invite page (#224). */
function PhoneJoin({ token }: { token: string }) {
  const t = useT();
  const { user, loading, preview, invited, alreadyIn, join, here } = useLinkInvite(token);
  return (
    <InviteShell
      // A signed-in phone has no other way home from here (#169): the app has no header.
      header={user ? <PhoneSubHeader back="/" backLabel={t.nav.home} /> : <TopNav />}
    >
      {preview.isPending || loading ? (
        <InviteLoading />
      ) : !invited ? (
        <InviteBroken
          title={t.join.broken}
          body={t.join.brokenBody(preview.error?.message ?? "")}
        />
      ) : (
        <InviteDetails
          invite={invited}
          note={alreadyIn ? t.join.alreadyIn : !user ? t.join.whatIsCasy : undefined}
          help={
            !user && (
              <p className="mt-3 text-[0.9375rem] text-muted-foreground">{t.join.comeBack}</p>
            )
          }
        >
          {alreadyIn ? (
            <InviteAction to="/">{t.join.findDate}</InviteAction>
          ) : user ? (
            <>
              <InviteAction onClick={() => join.mutate()} busy={join.isPending}>
                {t.join.joinGroup}
              </InviteAction>
              {join.isError && (
                <Notice tone="error" bare className="mt-1">
                  {join.error.message}
                </Notice>
              )}
            </>
          ) : (
            <InviteAction to={`/sign-in?next=${encodeURIComponent(here)}`}>
              {t.join.signInToJoin}
            </InviteAction>
          )}
        </InviteDetails>
      )}
    </InviteShell>
  );
}

function ComputerJoin({ token }: { token: string }) {
  const t = useT();
  const { user, loading, preview, invited, alreadyIn, join, here } = useLinkInvite(token);

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
              <h1 className="text-lg font-bold text-foreground">
                {invited.invitedBy ? t.join.invitedBy(invited.invitedBy) : t.join.invitedTo}
              </h1>
              <p className="mt-1 text-2xl font-bold text-foreground">{invited.name}</p>
              {invited.description && (
                <p className="mt-2 break-words text-[0.9375rem] text-foreground">
                  {invited.description}
                </p>
              )}
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
                  <p className="mt-3 text-sm text-foreground">{t.join.whatIsCasy}</p>
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
