import { Link, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, CalendarDays, LogIn, User, type LucideIcon } from "lucide-react";

import { adminStatusQuery } from "@/api/admin";
import { invitationsQuery, whoAmIQuery } from "@/api/groups";
import { useAuth } from "@/context/auth";
import { useEventsBadge } from "@/hooks/useEventsBadge";
import { usePhoneLayout } from "@/hooks/usePhoneLayout";
import { useT } from "@/i18n/lang";
import { isNativeApp } from "@/lib/nativeApp";
import { loadPage } from "@/pages/lazyPages";
import { cn } from "@/lib/utils";

/**
 * The phone's main navigation: three tabs along the bottom of the screen,
 * where a thumb already is, as in the apps the phone layout follows: Events on
 * the left, the calendar in the middle, the profile on the right. Groups are a
 * row of the profile. Mounted once in App.tsx; nothing at all on a computer,
 * which keeps TopNav's links.
 */
export default function TabBar() {
  return usePhoneLayout() ? <PhoneTabBar /> : null;
}

function PhoneTabBar() {
  const { pathname } = useLocation();
  const queryClient = useQueryClient();
  const { user, loading } = useAuth();
  const t = useT();

  // Each badge sits on the tab that leads to the answer: events waiting on you
  // on Events, group invitations on the profile (its Groups row says which).
  // Answers waiting on you, and dates you said yes to that now clash (useEventsBadge).
  const eventsBadge = useEventsBadge();
  const { data: invitations } = useQuery({
    ...invitationsQuery(user?.id ?? ""),
    enabled: !!user,
  });

  // Signed out, the last tab can only lead to the sign-in page, so it says so.
  const signedOut = !loading && !user;

  // The calendar in the middle. No scheduler tab: a phone plans from My calendar (#126, #127).
  const tabs: Tab[] = [
    {
      to: "/events",
      label: t.nav.eventsShort,
      icon: CalendarCheck,
      active: pathname.startsWith("/events"),
      prefetch: () => void loadPage.myEvents(),
      badge: eventsBadge,
    },
    {
      to: "/calendar-overview",
      label: t.nav.calendarShort,
      icon: CalendarDays,
      active: pathname.startsWith("/calendar-overview"),
      prefetch: () => void loadPage.calendarOverview(),
    },
    signedOut
      ? {
          to: "/sign-in",
          label: t.nav.signIn,
          icon: LogIn,
          active: pathname === "/sign-in",
          prefetch: () => void loadPage.signIn(),
        }
      : {
          to: "/profile",
          label: t.nav.profileShort,
          icon: User,
          // Groups are opened from the profile, so they stay under its tab.
          active: pathname.startsWith("/profile") || pathname.startsWith("/groups"),
          // The page and the two answers it opens by asking for, as TopNav does.
          prefetch: () => {
            if (!user) return;
            void loadPage.profile();
            void queryClient.prefetchQuery(whoAmIQuery(user.id));
            void queryClient.prefetchQuery(adminStatusQuery(user.id));
          },
          badge: invitations?.length,
        },
  ];

  // The app has no tab bar until someone signs in (#151): the welcome screen
  // and sign-in stand on their own, with their own way back (AppBackLink).
  if (isNativeApp && !user) return null;

  return (
    <>
      {/* Holds the end of every page clear of the bar, which floats over it. */}
      <div aria-hidden className="h-[var(--tab-bar-height)]" />
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-card pb-[env(safe-area-inset-bottom)]">
        <ul className="grid h-14 grid-cols-3">
          {tabs.map((tab) => (
            <li key={tab.to}>
              <Link
                to={tab.to}
                onTouchStart={tab.active ? undefined : tab.prefetch}
                onFocus={tab.active ? undefined : tab.prefetch}
                aria-current={tab.active ? "page" : undefined}
                className={cn(
                  "flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground transition-colors",
                  tab.active && "text-primary",
                )}
              >
                {/* data-tab-icon: where Planlæg's sent dates fly to (#102). */}
                <span className="relative" data-tab-icon={tab.to}>
                  <tab.icon className="h-6 w-6" strokeWidth={tab.active ? 2.25 : 1.75} />
                  {!!tab.badge && (
                    <span
                      aria-label={t.nav.waitingForAnswer(tab.badge)}
                      className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground"
                    >
                      {tab.badge}
                    </span>
                  )}
                </span>
                <span className="whitespace-nowrap">{tab.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}

interface Tab {
  to: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  prefetch?: () => void;
  badge?: number;
}
