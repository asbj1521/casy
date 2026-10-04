/**
 * The pages loaded on demand, one loader each. The same function lazy-loads a
 * page for its route (App.tsx) and warms it early, when a link to it is
 * hovered or a card is about to fly there, so both always fetch one chunk.
 *
 * The scheduler (FindDate) and the landing page are not here: they are what
 * people land on, so they ship in the entry chunk.
 */
export const loadPage = {
  profile: () => import("@/pages/Profile"),
  calendarOverview: () => import("@/pages/CalendarOverview"),
  calendarAccounts: () => import("@/pages/CalendarAccounts"),
  myEvents: () => import("@/pages/MyEvents"),
  groups: () => import("@/pages/Groups"),
  profileScreen: () => import("@/pages/ProfileScreen"),
  myData: () => import("@/pages/MyData"),
  signIn: () => import("@/pages/SignIn"),
  joinGroup: () => import("@/pages/JoinGroup"),
  privacy: () => import("@/pages/Privacy"),
  howItWorks: () => import("@/pages/HowItWorks"),
  connectIcloud: () => import("@/pages/ConnectIcloudHelp"),
  connectIcs: () => import("@/pages/ConnectIcsHelp"),
  connectGoogle: () => import("@/pages/ConnectGoogleHelp"),
  connectOutlook: () => import("@/pages/ConnectOutlookHelp"),
};
