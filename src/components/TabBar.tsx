import { Link, useLocation } from "react-router-dom";
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
import { calendarStatusQuery } from "@/api/calendars";
import { eventsQuery, needsYourAnswer } from "@/api/events";
import { groupsQuery, invitationsQuery } from "@/api/groups";
import { useAuth } from "@/context/auth";
import { usePhoneLayout } from "@/hooks/usePhoneLayout";
import { useT } from "@/i18n/lang";
import { loadPage } from "@/pages/lazyPages";
import { cn } from "@/lib/utils";

/**
 * The phone's main navigation: five tabs along the bottom of the screen,
 * where a thumb already is, as in the apps the phone layout follows. Mounted
 * once in App.tsx; nothing at all on a computer, which keeps TopNav's links.
 */
export default function TabBar() {
  return usePhoneLayout() ? <PhoneTabBar /> : null;
}

function PhoneTabBar() {
  const { pathname } = useLocation();
  const queryClient = useQueryClient();
  const { user, loading } = useAuth();
  const t = useT();

  // Each badge sits on the tab where the answer is given: events waiting on
  // you on Events, invitations on Groups.
  const { data: events } = useQuery({ ...eventsQuery(user?.id ?? ""), enabled: !!user });
  const { data: invitations } = useQuery({
    ...invitationsQuery(user?.id ?? ""),
    enabled: !!user,
  });

  // Signed out, the last tab can only lead to the sign-in page, so it says so.
  const signedOut = !loading && !user;

  // Groups first and the scheduler in the middle, where the thumb rests.
  const tabs: Tab[] = [
    {
      to: "/groups",
      label: t.nav.groupsShort,
      icon: Users,
      active: pathname.startsWith("/groups"),
      prefetch: () => void loadPage.groups(),
      badge: invitations?.length,
    },
    {
      to: "/events",
      label: t.nav.eventsShort,
      icon: CalendarCheck,
      active: pathname === "/events",
      prefetch: () => void loadPage.myEvents(),
      badge: events?.filter(needsYourAnswer).length,
    },
    {
      to: user ? "/" : "/plan",
      label: t.nav.schedulerShort,
      icon: CalendarSearch,
      active: pathname === "/plan" || (pathname === "/" && !!user),
    },
    {
      to: "/calendar-overview",
      label: t.nav.calendarShort,
      icon: CalendarDays,
      active: pathname === "/calendar-overview",
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
          active: pathname.startsWith("/profile"),
          // The page and the three answers it opens by asking for, as TopNav does.
          prefetch: () => {
            if (!user) return;
            void loadPage.profile();
            void queryClient.prefetchQuery(calendarStatusQuery(user.id));
            void queryClient.prefetchQuery(groupsQuery(user.id));
            void queryClient.prefetchQuery(adminStatusQuery(user.id));
          },
        },
  ];

  return (
    <>
      {/* Holds the end of every page clear of the bar, which floats over it. */}
      <div aria-hidden className="h-[var(--tab-bar-height)]" />
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-card pb-[env(safe-area-inset-bottom)]">
        <ul className="grid h-14 grid-cols-5">
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
                <span className="relative">
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
