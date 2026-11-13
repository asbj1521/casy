import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Outlet, Routes, Route, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "framer-motion";

import ConnectCalendarPrompt from "@/components/ConnectCalendarPrompt";
import Footer from "@/components/Footer";
import RequireAuth from "@/components/RequireAuth";
import UpdateRequired from "@/components/UpdateRequired";
import WeakPasswordNotice from "@/components/WeakPasswordNotice";
import { useAuth } from "@/context/auth";
import { useAccountLanguage } from "@/hooks/useAccountLanguage";
import { useAutoCategorize } from "@/hooks/useAutoCategorize";
import { useLiveUpdates } from "@/hooks/useLiveUpdates";
import { usePhoneLayout } from "@/hooks/usePhoneLayout";
import AuthProvider from "@/context/AuthProvider";
import LanguageProvider from "@/i18n/LanguageProvider";
import { openedFromAuthEmail, showsComputerAd } from "@/lib/computerAd";
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
  !showsComputerAd &&
  (window.location.pathname === "/" || window.location.pathname === "/plan") &&
  window.matchMedia("(min-width: 768px)").matches
) {
  void loadPage.findDate();
}
// The app opens on its home page, My calendar (#169), fetched at once in the
// same way. The website's phone doesn't: signed out, / is the landing page.
if (isNativeApp && window.location.pathname === "/") {
  void loadPage.calendarOverview();
  void loadPage.phoneCalendar();
}
const FindDate = lazy(loadPage.findDate);
const ComputerAd = lazy(loadPage.computerAd);
const AppLink = lazy(loadPage.appLink);
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
const FriendLink = lazy(loadPage.friendLink);
const Invitation = lazy(loadPage.invitation);
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
const ChatScenePlayground = import.meta.env.DEV
  ? lazy(() => import("@/pages/dev/ChatScenePlayground"))
  : null;
const TripsPlayground = import.meta.env.DEV
  ? lazy(() => import("@/pages/dev/TripsPlayground"))
  : null;

/**
 * casy.app itself: the landing page for signed-out visitors, the scheduler
 * for everyone signed in on a computer, so it never stands between a user and
 * their groups, and on a phone the home page, My calendar (#169).
 * Its "Go to Casy" button leads to /plan, the scheduler for anyone. The
 * iPhone app has a welcome screen of its own instead (#151). Until the
 * stored session is read this is a plain background, or a signed-in person
 * would see the landing page flash first. The app's welcome screen is drawn by
 * AppEntry around this, so it can stay open as sign-in opens.
 */
/**
 * A password-reset link that lands anywhere but the sign-in page (#242: an
 * older email, or one Supabase sent to the site's front page) still ends on
 * "choose a new password", which only the sign-in page shows.
 */
function PasswordRecoveryRedirect() {
  const { passwordRecovery } = useAuth();
  const { pathname } = useLocation();
  if (!passwordRecovery || pathname === "/sign-in") return null;
  return <Navigate to="/sign-in" replace />;
}

function Home() {
  const { user, loading } = useAuth();
  const phone = usePhoneLayout();
  if (loading) return <div className="min-h-screen bg-background" />;
  if (user) return phone ? <CalendarOverview /> : <FindDate />;
  return isNativeApp ? null : <Landing />;
}

/**
 * The iPhone app's two signed-out pages, / and /sign-in, kept in one open
 * AppWelcome across the addresses, so the phone on the one can turn into the card
 * on the other (#228). Signed in or still finding out, the pages are on their own.
 */
function AppEntry() {
  const { user, loading } = useAuth();
  const { pathname } = useLocation();
  if (user || loading) return <Outlet />;
  return (
    <AppWelcome signIn={pathname === "/sign-in"}>
      <Outlet />
    </AppWelcome>
  );
}

/**
 * Keeps open pages up to date with what others do (useLiveUpdates), the
 * account's saved language with the site's, for its emails (useAccountLanguage),
 * and new calendars given a category by AI in the background
 * (useAutoCategorize). The app's own background work is AppBackground.
 */
/**
 * Sign-in on a computer (#270): only to finish an email's link (confirm the
 * address, a new password, a new email), which most people open on a laptop;
 * otherwise the ad. Signed in, it lands on the ad, which says to carry on in
 * the app.
 */
function ComputerSignIn() {
  const { passwordRecovery } = useAuth();
  return openedFromAuthEmail || passwordRecovery ? <SignIn /> : <ComputerAd />;
}

/**
 * A computer's addresses (#270): the help pages, the terms and the privacy
 * policy as they are (the App Store, Google and the help guides need them),
 * an invite or friend link as the ad with its own QR code, everything else the
 * ad. The browser tests keep the old computer site until #273 removes it
 * (`lib/computerAd.ts`).
 */
function ComputerRoutes() {
  return (
    <Routes>
      <Route path="/sign-in" element={<ComputerSignIn />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/support" element={<Support />} />
      <Route path="/how-it-works" element={<HowItWorks />} />
      <Route path="/help/connect-icloud" element={<ConnectIcloudHelp />} />
      <Route path="/help/connect-ics" element={<ConnectIcsHelp />} />
      <Route path="/help/connect-google" element={<ConnectGoogleHelp />} />
      <Route path="/help/connect-outlook" element={<ConnectOutlookHelp />} />
      <Route path="/join/:token" element={<ComputerAd kind="invite" />} />
      <Route path="/friend/:token" element={<ComputerAd kind="friend" />} />
      {MotionPlayground && <Route path="/dev/motion" element={<MotionPlayground />} />}
      {ChatScenePlayground && <Route path="/dev/chat" element={<ChatScenePlayground />} />}
      <Route path="*" element={<ComputerAd />} />
    </Routes>
  );
}

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
    // Someone who asked for less motion gets fades, not movement, everywhere (#170).
    <MotionConfig reducedMotion="user">
      <LanguageProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            {/* Nothing runs behind the computer's ad (#270): no live updates, no AI sorting. */}
            {!showsComputerAd && <LiveUpdates />}
            {AppBackground && (
              <Suspense fallback={null}>
                <AppBackground />
              </Suspense>
            )}
            <BrowserRouter>
              {/* After signing in with a password that no longer meets the rules. */}
              <WeakPasswordNotice />
              <PasswordRecoveryRedirect />
              {/* Plain background rather than a spinner: these chunks are small, and
                a flash of "Loading…" would read as slower than a beat of nothing. */}
              <Suspense fallback={<div className="min-h-screen bg-background" />}>
                {showsComputerAd ? (
                  <ComputerRoutes />
                ) : (
                  <Routes>
                    <Route path="/app" element={<AppLink />} />
                    <Route element={isNativeApp ? <AppEntry /> : <Outlet />}>
                      <Route path="/" element={<Home />} />
                      <Route path="/sign-in" element={<SignIn />} />
                    </Route>
                    <Route path="/plan" element={<FindDate />} />
                    {MotionPlayground && (
                      <Route path="/dev/motion" element={<MotionPlayground />} />
                    )}
                    {TripsPlayground && <Route path="/dev/trips" element={<TripsPlayground />} />}
                    {/* Dev only: the joke's chat scene on the welcome phone (#275, #270). */}
                    {ChatScenePlayground && (
                      <Route path="/dev/chat" element={<ChatScenePlayground />} />
                    )}
                    {/* Dev only: the app's welcome screen in any browser, to tune it (#228). */}
                    {import.meta.env.DEV && <Route path="/dev/welcome" element={<AppWelcome />} />}
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
                    <Route path="/friend/:token" element={<FriendLink />} />
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
                    {/* The old swipe screen's address, in push notifications: to the vote over the month (#172). */}
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
                      path="/invited/:groupId"
                      element={
                        <RequireAuth>
                          <Invitation />
                        </RequireAuth>
                      }
                    />
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
                )}
              </Suspense>
              <Footer />
              {/* Computers only: asks someone with no calendar to connect one. */}
              {!showsComputerAd && <ConnectCalendarPrompt />}
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
    </MotionConfig>
  );
}

export default App;
