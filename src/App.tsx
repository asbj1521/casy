import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import Footer from "@/components/Footer";
import RequireAuth from "@/components/RequireAuth";
import TabBar from "@/components/TabBar";
import WeakPasswordNotice from "@/components/WeakPasswordNotice";
import { useAuth } from "@/context/auth";
import { useLiveUpdates } from "@/hooks/useLiveUpdates";
import AuthProvider from "@/context/AuthProvider";
import LanguageProvider from "@/i18n/LanguageProvider";
import { persistQueries } from "@/lib/queryPersistence";
import FindDate from "@/pages/FindDate";
import Landing from "@/pages/Landing";
import { loadPage } from "@/pages/lazyPages";

/**
 * The scheduler and the landing page are what people land on, so they ship
 * in the entry chunk: splitting them out only buys a second round trip before
 * anything renders. Every other page is reached by a deliberate click (or an
 * invite link), and loads on its own, so the landing page never downloads
 * code it has no use for.
 */
const Profile = lazy(loadPage.profile);
const CalendarOverview = lazy(loadPage.calendarOverview);
const MyEvents = lazy(loadPage.myEvents);
const Groups = lazy(loadPage.groups);
const SignIn = lazy(loadPage.signIn);
const JoinGroup = lazy(loadPage.joinGroup);
const Privacy = lazy(loadPage.privacy);
const HowItWorks = lazy(loadPage.howItWorks);
const ConnectIcloudHelp = lazy(loadPage.connectIcloud);
const ConnectIcsHelp = lazy(loadPage.connectIcs);
const ConnectGoogleHelp = lazy(loadPage.connectGoogle);
const ConnectOutlookHelp = lazy(loadPage.connectOutlook);

/**
 * casy.app itself: the landing page for signed-out visitors, the scheduler
 * for everyone signed in, so it never stands between a user and their groups.
 * Its "Go to Casy" button leads to /plan, the scheduler for anyone. Until the
 * stored session is read this is a plain background, or a signed-in person
 * would see the landing page flash first.
 */
function Home() {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-background" />;
  return user ? <FindDate /> : <Landing />;
}

/** Keeps open pages up to date with what others do (useLiveUpdates). */
function LiveUpdates() {
  useLiveUpdates();
  return null;
}

const queryClient = new QueryClient();
// Last known groups, calendar status and admin flag, shown at once on load
// and refreshed in the background (see queryPersistence.ts).
persistQueries(queryClient);

function App() {
  return (
    <LanguageProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <LiveUpdates />
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
                <Route path="/privacy" element={<Privacy />} />
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
                {/* The phone's Groups tab (TabBar). */}
                <Route
                  path="/groups"
                  element={
                    <RequireAuth>
                      <Groups />
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
              </Routes>
            </Suspense>
            <Footer />
            {/* Phones only: the main links along the bottom. */}
            <TabBar />
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    </LanguageProvider>
  );
}

export default App;
