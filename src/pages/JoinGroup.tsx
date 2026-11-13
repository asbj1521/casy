import { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { CalendarCheck, Loader2, Users, XCircle } from "lucide-react";

import {
  GetTheApp,
  InviteAction,
  InviteBroken,
  InviteDetails,
  InviteLoading,
  InviteShell,
  OpenInApp,
} from "@/components/invite/InviteScreen";
import PhoneSubHeader from "@/components/PhoneSubHeader";
import Notice from "@/components/ui/Notice";
import { useLinkInvite } from "@/hooks/useLinkInvite";
import { usePhoneLayout } from "@/hooks/usePhoneLayout";
import { useT } from "@/i18n/lang";
import { fromDoorUrl, inviteLinkUrl } from "@/lib/appLinks";
import { insideChatBrowser, onIPhoneBrowser } from "@/lib/iphoneBrowser";
import { sheetAddress } from "@/lib/profileScreens";
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
  // Back from signing up: they already said yes before the detour, so they are in.
  const [params] = useSearchParams();
  const said = params.has("join");
  // The door into the app (#257, lib/appLinks.ts): here because the app
  // didn't open by itself on the way; its one button tries once more, from
  // this other site.
  const door = params.has("door");
  // Back from the door, still in a browser: the app is not on the phone, is
  // too old to know the door, or this browser hands nothing on.
  const noApp = params.has("noapp") && onIPhoneBrowser && !user;
  // On an iPhone the profile is made in the app (#277): the App Store is the
  // one way on, and joining in the browser is for Android, behind its own question.
  const [android, setAndroid] = useState(false);
  const toAppStore = onIPhoneBrowser && !user && !android;
  const joining = useRef(false);
  useEffect(() => {
    if (!said || !user || loading || !invited || alreadyIn || joining.current) return;
    joining.current = true;
    join.mutate();
  }, [said, user, loading, invited, alreadyIn, join]);
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
          note={
            door
              ? undefined
              : alreadyIn
                ? t.join.alreadyIn
                : toAppStore
                  ? t.join.inTheApp
                  : noApp
                    ? insideChatBrowser
                      ? t.join.noAppInside
                      : t.join.noApp
                    : !user
                      ? t.join.whatIsCasy
                      : undefined
          }
        >
          {door ? (
            <>
              <InviteAction href={fromDoorUrl(here)}>{t.join.openInApp}</InviteAction>
              <a
                href={inviteLinkUrl(here)}
                className="hit mx-auto mt-3 text-[0.9375rem] font-semibold text-primary"
              >
                {t.join.stayInBrowser}
              </a>
            </>
          ) : alreadyIn ? (
            // Into the group itself (#244), in the Profil sheet as everywhere on a phone.
            <InviteAction to={sheetAddress(`groups/${invited.id}`)}>{t.join.toGroup}</InviteAction>
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
          ) : toAppStore ? (
            <>
              <GetTheApp path={here} big />
              <button
                type="button"
                onClick={() => setAndroid(true)}
                className="hit mx-auto mt-4 text-[0.875rem] text-muted-foreground"
              >
                {t.join.onAndroid}
              </button>
            </>
          ) : (
            <>
              <InviteAction to={`/sign-in?signup=1&next=${encodeURIComponent(`${here}?join=1`)}`}>
                {t.join.joinGroup}
              </InviteAction>
              {/* Tried already when back from the door. */}
              {!noApp && <OpenInApp path={here} />}
              <GetTheApp path={here} />
            </>
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
