/**
 * The pages loaded on demand, one loader each. The same function lazy-loads a
 * page for its route (App.tsx) and warms it early, when a link to it is
 * hovered or a card is about to fly there, so both always fetch one chunk.
 *
 * The landing page is not here: it is what visitors land on, so it ships in
 * the entry chunk. The scheduler (FindDate) is (#157): phones and the app
 * never show it, and on a computer App.tsx starts fetching it at once.
 */
export const loadPage = {
  findDate: () => import("@/pages/FindDate"),
  profile: () => import("@/pages/Profile"),
  calendarOverview: () => import("@/pages/CalendarOverview"),
  calendarAccounts: () => import("@/pages/CalendarAccounts"),
  myEvents: () => import("@/pages/MyEvents"),
  swipeDates: () => import("@/pages/SwipeDates"),
  groups: () => import("@/pages/Groups"),
  profileScreen: () => import("@/pages/ProfileScreen"),
  myData: () => import("@/pages/MyData"),
  settings: () => import("@/pages/Settings"),
  signIn: () => import("@/pages/SignIn"),
  joinGroup: () => import("@/pages/JoinGroup"),
  privacy: () => import("@/pages/Privacy"),
  terms: () => import("@/pages/Terms"),
  support: () => import("@/pages/Support"),
  howItWorks: () => import("@/pages/HowItWorks"),
  connectIcloud: () => import("@/pages/ConnectIcloudHelp"),
  connectIcs: () => import("@/pages/ConnectIcsHelp"),
  connectGoogle: () => import("@/pages/ConnectGoogleHelp"),
  connectOutlook: () => import("@/pages/ConnectOutlookHelp"),
};
