import { useId, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Loader2, XCircle } from "lucide-react";

import Avatar from "@/components/ui/Avatar";
import HelpButton from "@/components/ui/HelpButton";
import { useT } from "@/i18n/lang";
import { doorUrl, inviteLinkUrl } from "@/lib/appLinks";
import { onIPhoneBrowser } from "@/lib/iphoneBrowser";
import { APP_STORE_URL } from "@/lib/appStore";

/** What an invite shows, wherever it came from (a link or a named invitation). */
export interface InviteFacts {
  name: string;
  description?: string | null;
  memberCount: number;
  invitedBy?: string | null;
  /** The group's picture, else the inviter's; none shows the group's first letter. */
  pictureUrl?: string | null;
}

/**
 * The invite page on a phone and in the app (#224), full screen for a link: it
 * is what a friend meets first, so only the picture, who asked, the group and
 * the answer are on it, centred; what joining means is behind the ?. An
 * invitation by name shows the same details as a screen in the Profil sheet
 * (InvitationContent).
 */
export function InviteShell({ header, children }: { header: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {header}
      <main className="flex flex-1 flex-col justify-center px-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-4 text-center">
        {children}
      </main>
    </div>
  );
}

export function InviteDetails({
  invite,
  help,
  note,
  children,
}: {
  invite: InviteFacts;
  /** More behind the ?, under what joining means; `close` shuts the panel. */
  help?: (close: () => void) => ReactNode;
  /** A line above the answer. */
  note?: ReactNode;
  /** The answer. */
  children: ReactNode;
}) {
  const t = useT();
  const helpAnchor = useId();
  return (
    <>
      <Avatar
        name={invite.name}
        index={0}
        size="lg"
        src={invite.pictureUrl}
        className="mx-auto h-28 w-28 text-[2.5rem] shadow-sm"
      />
      <h1 className="mt-5 text-[0.9375rem] font-medium text-muted-foreground">
        {invite.invitedBy ? t.join.invitedBy(invite.invitedBy) : t.join.invitedTo}
      </h1>
      <p className="mt-0.5 break-words text-[1.75rem] font-bold leading-tight text-foreground">
        {invite.name}
      </p>
      {invite.description && (
        <p className="mt-2 break-words text-[0.9375rem] text-foreground">{invite.description}</p>
      )}
      <p
        id={helpAnchor}
        className="mt-2 flex items-center justify-center gap-2 text-[0.8125rem] text-muted-foreground"
      >
        {t.join.membersSoFar(invite.memberCount)}
        <HelpButton label={t.join.aboutTitle} anchorId={helpAnchor}>
          {(close) => (
            <>
              <p>{t.join.privacy}</p>
              {help?.(close)}
            </>
          )}
        </HelpButton>
      </p>
      {note && <p className="mt-4 text-[0.9375rem] text-foreground">{note}</p>}
      <div className="mt-8 flex flex-col gap-2">{children}</div>
    </>
  );
}

/**
 * The invite's answer: the one solid orange button besides Planlæg med AI's
 * (CLAUDE.md, design rule 2), since saying yes is what the page is for. A
 * link where it leads somewhere (`to`), a plain one where that is another
 * site (`href`: the door into the app, #257, which iOS must see tapped).
 */
export function InviteAction({
  to,
  href,
  onClick,
  disabled = false,
  busy = false,
  children,
}: {
  to?: string;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  busy?: boolean;
  children: ReactNode;
}) {
  const look =
    "inline-flex h-14 w-full items-center justify-center gap-2 rounded-full bg-cta text-[1.0625rem] font-bold text-white transition active:opacity-90 disabled:opacity-60";
  if (href)
    return (
      <a href={href} onClick={onClick} className={look}>
        {children}
      </a>
    );
  if (to)
    return (
      <Link to={to} className={look}>
        {children}
      </Link>
    );
  return (
    <button type="button" onClick={onClick} disabled={disabled || busy} className={look}>
      {busy && <Loader2 className="h-5 w-5 animate-spin" />}
      {children}
    </button>
  );
}

const TEXT_LINK = "hit mx-auto mt-3 text-[0.9375rem] font-semibold text-primary";

/**
 * Into the app with this invite (#257), for a friend on an iPhone's browser
 * who has Casy: iOS kept the link in the browser, so this leads to the same
 * invite at the door (lib/appLinks.ts), a tap to another site, which is what
 * iOS opens the app for. `path`: the invite's own, "/join/…".
 */
export function OpenInApp({ path }: { path: string }) {
  const t = useT();
  if (!onIPhoneBrowser) return null;
  return (
    <a href={doorUrl(path)} className={TEXT_LINK}>
      {t.join.openInApp}
    </a>
  );
}

/**
 * The way to the App Store under the answer, for a friend on an iPhone's browser
 * who may not have the app. Nothing anywhere else: a computer has no app to get,
 * and the app is already there. On the way, the invite's link is copied
 * (#237), so the app just installed can be handed it with one "Indsæt link"
 * (InvitePasteSheet): iOS carries nothing through the App Store by itself.
 */
export function GetTheApp({ path, big = false }: { path?: string; big?: boolean }) {
  const t = useT();
  if (!onIPhoneBrowser) return null;
  const copy = () => {
    if (!path) return;
    // Best effort: a browser without a clipboard just goes to the App Store.
    try {
      void navigator.clipboard?.writeText(inviteLinkUrl(path)).catch(() => {});
    } catch {
      // No clipboard here.
    }
  };
  // The invite page's one way on, on an iPhone (#277): the profile is made in the app.
  if (big)
    return (
      <InviteAction href={APP_STORE_URL} onClick={copy}>
        {t.join.appStore}
      </InviteAction>
    );
  return (
    <a href={APP_STORE_URL} onClick={copy} className={TEXT_LINK}>
      {t.join.getTheApp}
    </a>
  );
}

export function InviteLoading() {
  const t = useT();
  return (
    <p className="flex items-center justify-center gap-3 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" />
      {t.join.opening}
    </p>
  );
}

/** An invite that no longer leads anywhere. */
export function InviteBroken({ title, body }: { title: string; body: string }) {
  const t = useT();
  return (
    <>
      <XCircle aria-hidden className="mx-auto h-12 w-12 text-red-600" />
      <h1 className="mt-4 text-[1.0625rem] font-bold text-foreground">{title}</h1>
      <p className="mt-2 text-[0.9375rem] text-muted-foreground">{body}</p>
      <Link
        to="/"
        className="glass-pill mx-auto mt-6 rounded-full px-5 py-3 text-[0.9375rem] font-semibold text-primary"
      >
        {t.join.goToCasy}
      </Link>
    </>
  );
}
