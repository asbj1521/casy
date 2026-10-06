import { Link, useLocation, useNavigate } from "react-router-dom";
import type { MouseEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarCheck,
  CalendarDays,
  CalendarSearch,
  LogIn,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";

import { adminStatusQuery } from "@/api/admin";
import { groupsQuery, invitationsQuery, whoAmIQuery } from "@/api/groups";
import LanguageToggle from "@/components/LanguageToggle";
import PhoneHeader from "@/components/PhoneHeader";
import { useAuth } from "@/context/auth";
import { useEventsBadge } from "@/hooks/useEventsBadge";
import { usePhoneLayout } from "@/hooks/usePhoneLayout";
import { useT } from "@/i18n/lang";
import { flyOnClick } from "@/lib/cardTransition";
import { loadPage } from "@/pages/lazyPages";
import { cn } from "@/lib/utils";

/**
 * The top navigation bar on every page: the logo and language switch, a
 * link to each main page (My events with a badge for answers waiting on
 * you), and signing in or out.
 */
export default function TopNav() {
  const { pathname } = useLocation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user, loading, signOut } = useAuth();
  const t = useT();
  const phone = usePhoneLayout();
  // The scheduler is at /plan for everyone, and at / too once signed in (signed
  // out, / is the landing page, see App.tsx).
  const onHome = pathname === "/plan" || (pathname === "/" && !!user);
  const onProfile = pathname === "/profile";
  const onEvents = pathname.startsWith("/events");
  const onGroups = pathname.startsWith("/groups");
  const onCalendarOverview = pathname === "/calendar-overview";

  // What's waiting for your answer, each on the page where it's given:
  // suggested events on My events, group invitations on My groups.
  // Answers waiting on you, and dates you said yes to that now clash (useEventsBadge).
  const eventsBadge = useEventsBadge();
  const { data: invitations } = useQuery({
    ...invitationsQuery(user?.id ?? ""),
    enabled: !!user,
  });

  async function handleSignOut() {
    try {
      await signOut();
      navigate("/");
    } catch {
      // Still signed in (offline, say): stay where they are.
    }
  }

  /**
   * Warm both halves of the profile page as soon as someone shows intent to go
   * there: its code chunk, and the two answers it opens by asking for (the
   * name you chose, and whether you are an admin).
   * Supabase takes roughly a third of a second to answer, and a pointer
   * resting on a link is usually good for about that long, so the page tends
   * to have what it needs by the time it mounts. Hovering without clicking
   * costs one cheap read, and React Query dedupes it against the page's own
   * request.
   */
  const prefetchProfile = () => {
    // Signed out, the link leads to the sign-in page, so there's nothing to warm.
    if (onProfile || !user) return;
    void loadPage.profile();
    void queryClient.prefetchQuery(whoAmIQuery(user.id));
    void queryClient.prefetchQuery(adminStatusQuery(user.id));
  };

  const prefetchEvents = () => {
    if (onEvents || !user) return;
    void loadPage.myEvents();
  };

  const prefetchGroups = () => {
    if (onGroups || !user) return;
    void loadPage.groups();
    void queryClient.prefetchQuery(groupsQuery(user.id));
  };

  const prefetchCalendarOverview = () => {
    if (onCalendarOverview || !user) return;
    void loadPage.calendarOverview();
  };

  // Signed out, the profile tab can only lead to the sign-in page, so it says
  // "Sign in" and is the one sign-in link in the bar.
  const signedOut = !loading && !user;

  // On the landing page, its chart card flies into the sign-in box
  // (cardTransition.ts), as from the landing page's own "Sign in" link.
  const signInFromLanding = (e: MouseEvent) => {
    if (pathname === "/" && !user) flyOnClick(e, () => navigate("/sign-in"), loadPage.signIn);
  };

  const tabs: Tab[] = [
    // The logo also goes home, but that isn't obvious from Profile or My
    // events, so it gets its own labelled link like the others.
    {
      to: user ? "/" : "/plan",
      label: t.nav.scheduler,
      short: t.nav.schedulerShort,
      icon: CalendarSearch,
      active: onHome,
    },
    {
      to: "/events",
      label: t.nav.events,
      short: t.nav.eventsShort,
      icon: CalendarCheck,
      active: onEvents,
      prefetch: prefetchEvents,
      badge: eventsBadge,
    },
    {
      to: "/groups",
      label: t.nav.groups,
      short: t.nav.groupsShort,
      icon: Users,
      active: onGroups,
      prefetch: prefetchGroups,
      badge: invitations?.length,
    },
    {
      to: "/calendar-overview",
      label: t.nav.calendar,
      short: t.nav.calendarShort,
      icon: CalendarDays,
      active: onCalendarOverview,
      prefetch: prefetchCalendarOverview,
    },
    signedOut
      ? {
          // Straight to sign-in, which then picks the scheduler or the
          // profile by whether you have a calendar (SignIn.tsx).
          to: "/sign-in",
          label: t.nav.signIn,
          short: t.nav.signIn,
          icon: LogIn,
          active: pathname === "/sign-in",
          prefetch: () => void loadPage.signIn(),
          onClick: signInFromLanding,
        }
      : {
          to: "/profile",
          label: t.nav.profile,
          short: t.nav.profileShort,
          icon: User,
          active: onProfile,
          prefetch: prefetchProfile,
        },
  ];

  // On a phone the links are in the tab bar (TabBar), so the top is just the
  // logo and the language switch.
  if (phone) return <PhoneHeader />;

  return (
    // Edge to edge on every page, with the same responsive gutter as the
    // full-width pages' content, so the logo and links sit in the same place
    // wherever you are. vt-top-nav: it holds still while the landing page
    // turns into another page (cardTransition.ts).
    <nav className="vt-top-nav flex items-center justify-between gap-2 px-4 py-3 sm:gap-3 sm:px-6 sm:py-5 lg:px-8">
      <div className="flex items-center gap-2 sm:gap-3">
        <Link to="/" className="flex items-center">
          <span className="text-xl font-bold tracking-tight sm:text-2xl">casy</span>
        </Link>
        <LanguageToggle />
      </div>
      {/* On a phone each link is an icon over a one-word label, which is the
          only way four of them fit beside the logo on a 360px screen. */}
      <div className="flex items-center gap-0.5 text-muted-foreground sm:gap-6 sm:text-sm">
        {tabs.map((tab) => (
          <Link
            key={tab.to}
            to={tab.to}
            onMouseEnter={tab.prefetch}
            onFocus={tab.prefetch}
            onTouchStart={tab.prefetch}
            onClick={tab.onClick}
            aria-current={tab.active ? "page" : undefined}
            className={cn(
              "flex min-w-12 flex-col items-center gap-0.5 rounded-lg px-1 py-1 text-[11px] font-medium transition hover:text-foreground max-[359px]:min-w-0 max-[359px]:px-0.5 max-[359px]:text-[10px] sm:min-w-0 sm:flex-row sm:gap-1.5 sm:p-0 sm:text-sm sm:font-normal",
              tab.active && "text-primary sm:text-foreground",
            )}
          >
            <span className="relative">
              <tab.icon className="h-5 w-5 sm:h-4 sm:w-4" />
              {!!tab.badge && (
                <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground sm:hidden">
                  {tab.badge}
                </span>
              )}
            </span>
            {/* Five full names only fit from lg; narrower computers get the
                phone's one-word names. */}
            <span className="whitespace-nowrap lg:hidden">{tab.short}</span>
            <span className="hidden whitespace-nowrap lg:inline">{tab.label}</span>
            {!!tab.badge && (
              <span
                aria-label={t.nav.waitingForAnswer(tab.badge)}
                className="hidden h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground sm:flex"
              >
                {tab.badge}
              </span>
            )}
          </Link>
        ))}
        {/* On a phone, signing out lives on the profile page instead. */}
        {user && (
          <button
            type="button"
            onClick={() => void handleSignOut()}
            className="hidden whitespace-nowrap transition hover:text-foreground sm:block"
          >
            {t.nav.signOut}
          </button>
        )}
      </div>
    </nav>
  );
}

interface Tab {
  to: string;
  label: string;
  /** The one-word label under the icon on a phone. */
  short: string;
  icon: LucideIcon;
  active: boolean;
  prefetch?: () => void;
  onClick?: (e: MouseEvent) => void;
  badge?: number;
}
