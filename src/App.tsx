import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import ConnectCalendarPrompt from "@/components/ConnectCalendarPrompt";
import Footer from "@/components/Footer";
import RequireAuth from "@/components/RequireAuth";
import TabBar from "@/components/TabBar";
import UpdateRequired from "@/components/UpdateRequired";
import WeakPasswordNotice from "@/components/WeakPasswordNotice";
import { useAuth } from "@/context/auth";
import { useAccountLanguage } from "@/hooks/useAccountLanguage";
import { useAutoCategorize } from "@/hooks/useAutoCategorize";
import { useLiveUpdates } from "@/hooks/useLiveUpdates";
import AuthProvider from "@/context/AuthProvider";
import LanguageProvider from "@/i18n/LanguageProvider";
import { isNativeApp } from "@/lib/nativeApp";
import { persistQueries } from "@/lib/queryPersistence";
import Landing from "@/pages/Landing";
import { loadPage } from "@/pages/lazyPages";

/**
 * The landing page is what visitors land on, so it ships in the entry chunk.
 * Every other page loads on its own, the scheduler included (#157): a phone
 * and the app never show it (they plan from My calendar), so they never
 * download it. On a computer opening / or /plan it is fetched at once,
 * alongside the session check, so a signed-in person doesn't wait for it.
 */
if (
  !isNativeApp &&
  (window.location.pathname === "/" || window.location.pathname === "/plan") &&
  window.matchMedia("(min-width: 768px)").matches
) {
  void loadPage.findDate();
}
const FindDate = lazy(loadPage.findDate);
const Profile = lazy(loadPage.profile);
const CalendarOverview = lazy(loadPage.calendarOverview);
const CalendarAccounts = lazy(loadPage.calendarAccounts);
const MyEvents = lazy(loadPage.myEvents);
const SwipeDates = lazy(loadPage.swipeDates);
const Groups = lazy(loadPage.groups);
const ProfileScreen = lazy(loadPage.profileScreen);
const MyData = lazy(loadPage.myData);
const Settings = lazy(loadPage.settings);
const SignIn = lazy(loadPage.signIn);
const JoinGroup = lazy(loadPage.joinGroup);
const Privacy = lazy(loadPage.privacy);
const Terms = lazy(loadPage.terms);
const Support = lazy(loadPage.support);
const HowItWorks = lazy(loadPage.howItWorks);
const ConnectIcloudHelp = lazy(loadPage.connectIcloud);
const ConnectIcsHelp = lazy(loadPage.connectIcs);
const ConnectGoogleHelp = lazy(loadPage.connectGoogle);
const ConnectOutlookHelp = lazy(loadPage.connectOutlook);
// Dev only: `import.meta.env.DEV` is false in a build, so the page and its route vanish.
const MotionPlayground = import.meta.env.DEV
  ? lazy(() => import("@/pages/dev/MotionPlayground"))
  : null;
// The app's own first screen (#151): never downloaded by the website.
const AppWelcome = lazy(() => import("@/components/welcome/AppWelcome"));
const TripsPlayground = import.meta.env.DEV
  ? lazy(() => import("@/pages/dev/TripsPlayground"))
  : null;

/**
 * casy.app itself: the landing page for signed-out visitors, the scheduler
 * for everyone signed in, so it never stands between a user and their groups.
 * Its "Go to Casy" button leads to /plan, the scheduler for anyone. The
 * iPhone app has a welcome screen of its own instead (#151). Until the
 * stored session is read this is a plain background, or a signed-in person
 * would see the landing page flash first.
 */
function Home() {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-background" />;
  if (user) return <FindDate />;
  return isNativeApp ? <AppWelcome /> : <Landing />;
}

/**
 * Keeps open pages up to date with what others do (useLiveUpdates), the
 * account's saved language with the site's, for its emails (useAccountLanguage),
 * and new calendars given a category by AI in the background
 * (useAutoCategorize). The app's own background work is AppBackground.
 */
function LiveUpdates() {
  useLiveUpdates();
  useAccountLanguage();
  useAutoCategorize();
  return null;
}

// The iPhone app's background work (phone calendars, labels, trips, day
// facts): never downloaded by the website (#157).
const AppBackground = isNativeApp ? lazy(() => import("@/components/AppBackground")) : null;
// Push notifications' part of the page (#139): taps, registering, the question.
const PushLinks = isNativeApp ? lazy(() => import("@/components/push/PushLinks")) : null;
// Invite links that open the app (#140), also the app's own.
const AppLinks = isNativeApp ? lazy(() => import("@/components/AppLinks")) : null;

// Server answers count as fresh for 30 s (#158): moving between pages or
// tabs within that time reuses them instead of asking again. Older ones are
// refetched on return to the tab as before; what others change arrives
// through the live pulse (useLiveUpdates), and mutations update or
// invalidate what they touch, whatever its age.
const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } });
// Last known groups, calendar status and admin flag, shown at once on load
// and refreshed in the background (see queryPersistence.ts).
persistQueries(queryClient);

function App() {
  return (
    <LanguageProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <LiveUpdates />
          {AppBackground && (
            <Suspense fallback={null}>
              <AppBackground />
            </Suspense>
          )}
          <BrowserRouter>
            {/* After signing in with a password that no longer meets the rules. */}
            <WeakPasswordNotice />
            {/* Plain background rather than a spinner: these chunks are small, and
                a flash of "Loading…" would read as slower than a beat of nothing. */}
            <Suspense fallback={<div className="min-h-screen bg-background" />}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/plan" element={<FindDate />} />
                <Route path="/sign-in" element={<SignIn />} />
                {MotionPlayground && <Route path="/dev/motion" element={<MotionPlayground />} />}
                {TripsPlayground && <Route path="/dev/trips" element={<TripsPlayground />} />}
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/support" element={<Support />} />
                <Route path="/how-it-works" element={<HowItWorks />} />
                <Route path="/help/connect-icloud" element={<ConnectIcloudHelp />} />
                <Route path="/help/connect-ics" element={<ConnectIcsHelp />} />
                <Route path="/help/connect-google" element={<ConnectGoogleHelp />} />
                <Route path="/help/connect-outlook" element={<ConnectOutlookHelp />} />
                {/* The invite link. Signing in happens on the page itself, so
                    someone can see what they were invited to before deciding. */}
                <Route path="/join/:token" element={<JoinGroup />} />
                {/* Everything tied to one person's calendars needs a login. */}
                <Route
                  path="/profile"
                  element={
                    <RequireAuth>
                      <Profile />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/events"
                  element={
                    <RequireAuth>
                      <MyEvents />
                    </RequireAuth>
                  }
                />
                {/* One event open beside the list (a computer; a phone goes back to /events). */}
                <Route
                  path="/events/:eventId"
                  element={
                    <RequireAuth>
                      <MyEvents />
                    </RequireAuth>
                  }
                />
                {/* Swiping through a vote's dates, the whole screen (a phone). */}
                <Route
                  path="/events/:eventId/dates"
                  element={
                    <RequireAuth>
                      <SwipeDates />
                    </RequireAuth>
                  }
                />
                {/* Your groups, and one group (both the same page, Groups.tsx). */}
                <Route
                  path="/groups"
                  element={
                    <RequireAuth>
                      <Groups />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/groups/:groupId"
                  element={
                    <RequireAuth>
                      <Groups />
                    </RequireAuth>
                  }
                />
                {/* Everything Casy holds about you: a screen on a phone, a page on a computer. */}
                <Route
                  path="/profile/data"
                  element={
                    <RequireAuth>
                      <MyData />
                    </RequireAuth>
                  }
                />
                {/* Language and light or dark, under the profile: every device. */}
                <Route
                  path="/profile/settings"
                  element={
                    <RequireAuth>
                      <Settings />
                    </RequireAuth>
                  }
                />
                {/* The phone profile's screens, opened from its hub. */}
                <Route
                  path="/profile/:screen"
                  element={
                    <RequireAuth>
                      <ProfileScreen />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/calendar-overview"
                  element={
                    <RequireAuth>
                      <CalendarOverview />
                    </RequireAuth>
                  }
                />
                {/* Connecting calendars, opened from My calendar (the Calendar tab). */}
                <Route
                  path="/calendar-overview/accounts"
                  element={
                    <RequireAuth>
                      <CalendarAccounts />
                    </RequireAuth>
                  }
                />
              </Routes>
            </Suspense>
            <Footer />
            {/* Phones only: the main links along the bottom. */}
            <TabBar />
            {/* Computers only: asks someone with no calendar to connect one. */}
            <ConnectCalendarPrompt />
            {/* The iPhone app only: an app too old for Casy is asked to update (#143). */}
            <UpdateRequired />
            {PushLinks && (
              <Suspense fallback={null}>
                <PushLinks />
              </Suspense>
            )}
            {AppLinks && (
              <Suspense fallback={null}>
                <AppLinks />
              </Suspense>
            )}
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    </LanguageProvider>
  );
}

export default App;
