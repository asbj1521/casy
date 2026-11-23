/**
 * The bridge to the iPhone app's native screens (NativeBridgePlugin in ios/,
 * #192, #198). Until the home page is native, the page keeps the login, the
 * language and the theme, and tells the app each time they change; a native
 * screen that changes a choice tells the page, which applies it as its own
 * rows do. The app's only; the website never calls it (see isNativeApp).
 *
 * As in phoneCalendar.ts, @capacitor/core loads on first use and only the
 * module goes through promises, never the plugin (it answers to `then` too).
 */
import type { LabelBook, LabelCorrection } from "@/lib/eventLabels";
import type { LabelledEvent } from "@/lib/eventWarnings";
import type { LegBook } from "@/lib/tripLegBook";
import type { NativeAuthAnswer, NativeAuthAsk } from "@/lib/nativeAuth";
import type { GridItem } from "@/lib/monthGrid";
import type { PluginListenerHandle } from "@capacitor/core";

import type { Lang } from "@/i18n/locale";
import { APP_BUILD } from "@/lib/feedback";
import { isNativeApp } from "@/lib/nativeApp";
import type { ThemeChoice } from "@/lib/theme";
import type { TripMark } from "@/lib/tripView";

/** A screen the app may draw natively in place of the page's own. */
export type NativeScreen =
  | "settings"
  | "profile"
  | "events"
  | "calendars"
  | "tell"
  | "trip"
  | "prime"
  | "aiConsent"
  | "push"
  | "update"
  | "home"
  | "plan"
  | "signIn"
  | "welcome"
  | "invitePaste"
  | "join"
  /**
   * Background work the app does itself (#282), named among the screens so the
   * page leaves it: the event labels (useAutoLabel only keeps a copy then).
   */
  | "labels"
  /** The day facts (#119), shared by the app from its own labels. */
  | "dayFacts"
  /** The calendars sorted by AI (#118), with the phone's own titles. */
  | "categorize"
  /** The trips' legs read from the labelled journeys (#115); the page still pairs them into trips. */
  | "tripLegs";

/** What the page tells the native home page (#201), and what it adds to the month. */
export interface NativeHomeState {
  /** On the home page at all. */
  shown: boolean;
  /** Something only the page draws is over the month: the native one steps aside. */
  covered: boolean;
  /** The votes' pencilled dates and chips, the trips' bars. */
  extras: GridItem[];
  /** Their colours, "r, g, b", by calendar id. */
  colors: Record<string, string>;
  /** Starred days (Tid til hinanden), local midnights. */
  starred: number[];
  /** The vote pill's words, when votes are waiting. */
  pill: string | null;
  /** Tilføj til kalender is offered. */
  tell: boolean;
  holidaysHidden: boolean;
  /**
   * The counts on the home page's buttons (#281), as the page draws them:
   * calendars not set up yet on Kalendere, votes waiting on Aftaler,
   * invitations on Profil. 0 draws none.
   */
  badges: { calendars: number; events: number; profile: number };
  /**
   * Your events that matter (high or critical, #114), with the AI's labels
   * kept on this phone: what a vote's date is warned against (#282).
   */
  important: LabelledEvent[];
  /** Changes when the page fetched your calendars again: the app reads them again too. */
  dataAt: number;
}

/** A press on the native home page, done by the page as from its own buttons. */
export interface NativeHomeAction {
  /**
   * The app's buttons pressed, or a moment worth an ask (#282): the last date
   * of a vote answered ("answered", the push ask) or an agreed date landed in
   * the month ("landed", the rating ask).
   */
  action:
    "day" | "calendars" | "tell" | "events" | "plan" | "profile" | "pill" | "answered" | "landed";
  day?: number;
}

interface LentSession {
  accessToken: string;
  expiresAt: number;
  userId: string;
  email?: string;
}

/** A native screen has closed, and what the page should do about it. */
export interface NativeClosed {
  screen: NativeScreen;
  /** An address in the page: the screen handed over to the page's own. */
  next?: string;
  signOut?: boolean;
  /** Joined a group from a native invitation (#198): the moment to offer notifications. */
  joined?: boolean;
  /** The account was deleted from a native screen (#198): the page drops its login. */
  accountDeleted?: boolean;
  /** Tilføj til kalender kept something (#200): where the first of it starts, to glide to. */
  added?: string;
  /** The app's sign-in screen (#282) closed because the page is now signed in. */
  signedIn?: boolean;
  /** Tid til hinanden's Planlæg was pressed (#200): the page's own, with the group and the day. */
  plan?: boolean;
  /** An invite's page (#282): already a member, into this group. */
  group?: string;
  /** An invite's page, signed out (#282): Bliv medlem, so an account first. */
  signUp?: boolean;
  /** Planlæg sent its dates (#282): the events changed, and the others are asked now. */
  sent?: boolean;
}

interface Preferences {
  lang: Lang;
  theme: ThemeChoice;
}

interface NativeBridgePlugin {
  screens(): Promise<{ screens: string[] }>;
  setSession(options: {
    projectUrl: string;
    apiKey: string;
    session: LentSession | null;
    /** This phone's connection for the signed-in person, for the app's labels. */
    phoneConnection: string | null;
  }): Promise<void>;
  setPreferences(options: Preferences): Promise<void>;
  open(options: {
    screen: NativeScreen;
    build: string;
    userAgent: string;
    state?: Record<string, unknown>;
  }): Promise<void>;
  pushResult(options: { answer: "granted" | "denied" | "failed" }): Promise<void>;
  phoneFacts(options: { labels: number }): Promise<void>;
  phoneWritten(options: { id: number }): Promise<void>;
  phoneSynced(options: { id: number; outcome: NativePhoneSync }): Promise<void>;
  authAnswered(options: { id: number; answer: NativeAuthAnswer }): Promise<void>;
  setTrip(options: { mark: TripMark | null; addedTo?: string; error?: string }): Promise<void>;
  setHome(options: NativeHomeState): Promise<void>;
  labelsFromPage(options: {
    userId: string;
    labels: LabelBook;
    corrections: LabelCorrection[];
  }): Promise<void>;
  legsFromPage(options: { userId: string; legs: LegBook }): Promise<void>;
  addListener(
    event: "legs",
    listener: (book: { userId: string; legs: LegBook }) => void,
  ): Promise<PluginListenerHandle>;
  labelCorrected(options: {
    userId: string;
    correction: LabelCorrection;
    count: number;
  }): Promise<void>;
  clearPhoneAi(options: { userId?: string }): Promise<void>;
  addListener(
    event: "labels",
    listener: (book: { userId: string; labels: LabelBook }) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    event: "preferences",
    listener: (choice: Preferences) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    event: "closed",
    listener: (closed: NativeClosed) => void,
  ): Promise<PluginListenerHandle>;
  addListener(event: "needSession", listener: () => void): Promise<PluginListenerHandle>;
  addListener(event: "dataChanged", listener: () => void): Promise<PluginListenerHandle>;
  addListener(event: "enablePush", listener: () => void): Promise<PluginListenerHandle>;
  addListener(
    event: "aiConsent",
    listener: (change: { on: boolean }) => void,
  ): Promise<PluginListenerHandle>;
  addListener(event: "needPhoneFacts", listener: () => void): Promise<PluginListenerHandle>;
  addListener(
    event: "needPhoneWrite",
    listener: (asked: { id: number }) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    event: "calendarPrefs",
    listener: (prefs: NativeCalendarPrefs) => void,
  ): Promise<PluginListenerHandle>;
  addListener(event: "calendarsChanged", listener: () => void): Promise<PluginListenerHandle>;
  addListener(
    event: "needPhoneSync",
    listener: (asked: { id: number; create: boolean }) => void,
  ): Promise<PluginListenerHandle>;
  addListener(event: "phoneForgotten", listener: () => void): Promise<PluginListenerHandle>;
  addListener(
    event: "tripAction",
    listener: (action: NativeTripAction) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    event: "homeAction",
    listener: (action: NativeHomeAction) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    event: "authAsk",
    listener: (ask: NativeAuthAsk) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    event: "inviteSent",
    listener: (sent: { groupId: string }) => void,
  ): Promise<PluginListenerHandle>;
}

let plugin: NativeBridgePlugin | null = null;

async function bridgePlugin(): Promise<{ plugin: NativeBridgePlugin }> {
  if (!plugin) {
    const { registerPlugin } = await import("@capacitor/core");
    plugin = registerPlugin<NativeBridgePlugin>("NativeBridge");
  }
  return { plugin };
}

let screens: Promise<ReadonlySet<string>> | null = null;

/**
 * The screens this build of the app draws natively, asked once. None on the
 * website, or from an app without the bridge (`npm run ios:live` against an
 * older build).
 */
export function nativeScreens(): Promise<ReadonlySet<string>> {
  if (!isNativeApp) return Promise.resolve(new Set());
  screens ??= bridgePlugin()
    .then(({ plugin }) => plugin.screens())
    .then((answer) => new Set(answer.screens))
    .catch(() => new Set());
  return screens;
}

/**
 * Show a native screen over the page, with what only the page knows that the
 * screen needs (`state`, Kalendere's choices kept in the page's storage).
 */
export async function openNativeScreen(
  screen: NativeScreen,
  state?: Record<string, unknown>,
): Promise<void> {
  const { plugin } = await bridgePlugin();
  await plugin.open({ screen, build: APP_BUILD, userAgent: navigator.userAgent, state });
}

/** Kalendere's choices kept on this phone by the page (#200), changed on the native screen. */
export interface NativeCalendarPrefs {
  /** The built-in holidays' tick, off. */
  holidaysHidden?: boolean;
  /** The calendars the guided setup has been through. */
  tourSeen?: string[];
}

/** How the page's send of the phone's calendars went, for native Forbundne kalendere. */
export type NativePhoneSync =
  | { state: "synced"; calendars: number; busyBlocks: number; connectionId: string | null }
  | { state: "denied" | "gone" | "skipped"; connectionId: string | null }
  | { state: "failed"; error: string; connectionId: string | null };

/** Calls `onChange` when native Kalendere changed a choice the page keeps (#200). */
export async function onNativeCalendarPrefs(
  onChange: (prefs: NativeCalendarPrefs) => void,
): Promise<PluginListenerHandle> {
  const { plugin } = await bridgePlugin();
  return plugin.addListener("calendarPrefs", onChange);
}

/** Calls `onChange` when native Kalendere changed your calendars: the page's copies are fetched again. */
export async function onNativeCalendarsChanged(
  onChange: () => void,
): Promise<PluginListenerHandle> {
  const { plugin } = await bridgePlugin();
  return plugin.addListener("calendarsChanged", onChange);
}

/**
 * Answers native Forbundne kalendere's asks to send the phone's calendars
 * (#200): the page reads and sends them, as its own Importér and Synkronisér
 * nu do, and says how it went. `create` connects the phone if it isn't yet.
 */
export async function onNeedPhoneSync(
  sync: (create: boolean) => Promise<NativePhoneSync>,
): Promise<PluginListenerHandle> {
  const { plugin } = await bridgePlugin();
  return plugin.addListener("needPhoneSync", ({ id, create }) => {
    void sync(create)
      .then((outcome) => plugin.phoneSynced({ id, outcome }))
      // The app stops waiting by itself.
      .catch(() => {});
  });
}

/**
 * Answers the app's sign-in screen (#282): each step is done by the page,
 * which keeps the session (`answer`, nativeAuth.ts), and how it went is sent back.
 */
export async function onNativeAuthAsk(
  answer: (ask: NativeAuthAsk) => Promise<NativeAuthAnswer>,
): Promise<PluginListenerHandle> {
  const { plugin } = await bridgePlugin();
  return plugin.addListener("authAsk", (ask) => {
    void answer(ask)
      .then((said) => plugin.authAnswered({ id: ask.id, answer: said }))
      // The app stops waiting by itself.
      .catch(() => {});
  });
}

/** An answer given on the native trip sheet (#200), for the page, which keeps the trips. */
export type NativeTripAction =
  | { action: "accept" | "decline" | "addToCalendar"; id: string }
  | { action: "home"; city: string }
  | { action: "return" | "outbound"; id: string; day: number };

/** Calls `onAction` for each answer on the native trip sheet. */
export async function onNativeTripAction(
  onAction: (action: NativeTripAction) => void,
): Promise<PluginListenerHandle> {
  const { plugin } = await bridgePlugin();
  return plugin.addListener("tripAction", onAction);
}

/**
 * The trip as the page has it now, after an answer (null once it is gone), with
 * the calendar it was just put in or why that failed.
 */
export async function sendTrip(
  mark: TripMark | null,
  outcome: { addedTo?: string; error?: string } = {},
): Promise<void> {
  const { plugin } = await bridgePlugin();
  await plugin.setTrip({ mark, ...outcome });
}

/** The home page as the page has it, for the native one drawn over it (#201). */
export async function sendHome(state: NativeHomeState): Promise<void> {
  const { plugin } = await bridgePlugin();
  await plugin.setHome(state);
}

/** Calls `onAction` for each press on the native home page. */
export async function onNativeHomeAction(
  onAction: (action: NativeHomeAction) => void,
): Promise<PluginListenerHandle> {
  const { plugin } = await bridgePlugin();
  return plugin.addListener("homeAction", onAction);
}

/** Calls `onForget` when native Forbundne kalendere removed this phone's own connection. */
export async function onNativePhoneForgotten(onForget: () => void): Promise<PluginListenerHandle> {
  const { plugin } = await bridgePlugin();
  return plugin.addListener("phoneForgotten", onForget);
}

/**
 * Lend the app the login (null when signed out). Only the access token goes:
 * the page keeps refreshing it and sends each new one.
 */
export async function lendSession(
  session: LentSession | null,
  phoneConnection: string | null,
): Promise<void> {
  const { plugin } = await bridgePlugin();
  await plugin.setSession({
    projectUrl: import.meta.env.VITE_SUPABASE_URL,
    apiKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    session,
    phoneConnection,
  });
}

/**
 * The label book and corrections the page kept, handed to the app once it
 * labels itself (#282), so nothing is labelled twice.
 */
export async function handLabelsToApp(
  userId: string,
  labels: LabelBook,
  corrections: LabelCorrection[],
): Promise<void> {
  const { plugin } = await bridgePlugin();
  await plugin.labelsFromPage({ userId, labels, corrections });
}

/** The trips' legs the page kept, handed to the app once it reads them itself (#282). */
export async function handLegsToApp(userId: string, legs: LegBook): Promise<void> {
  const { plugin } = await bridgePlugin();
  await plugin.legsFromPage({ userId, legs });
}

/** Calls `onLegs` with the app's trip legs whenever they change (#282). */
export async function onAppLegs(
  onLegs: (book: { userId: string; legs: LegBook }) => void,
): Promise<PluginListenerHandle> {
  const { plugin } = await bridgePlugin();
  return plugin.addListener("legs", onLegs);
}

/** A label corrected on the page ("Forkert?"), for the app's book (#282). */
export async function tellAppCorrected(
  userId: string,
  correction: LabelCorrection,
  count: number,
): Promise<void> {
  const { plugin } = await bridgePlugin();
  await plugin.labelCorrected({ userId, correction, count });
}

/**
 * What the AI made of this phone's calendar gone in the app too: one person's
 * (the AI's consent withdrawn) or everyone's (signed out). Nothing without the app.
 */
export async function clearAppPhoneAi(userId: string | null): Promise<void> {
  if (!isNativeApp || !(await nativeScreens()).has("labels")) return;
  const { plugin } = await bridgePlugin();
  await plugin.clearPhoneAi(userId ? { userId } : {});
}

/** Calls `onBook` with the app's label book whenever it changes (#282). */
export async function onAppLabels(
  onBook: (book: { userId: string; labels: LabelBook }) => void,
): Promise<PluginListenerHandle> {
  const { plugin } = await bridgePlugin();
  return plugin.addListener("labels", onBook);
}

/** Tell the app the language and theme the page uses now. */
export async function sharePreferences(preferences: Preferences): Promise<void> {
  const { plugin } = await bridgePlugin();
  await plugin.setPreferences(preferences);
}

/** Calls `onChoose` when a native screen changes the language or theme. */
export async function onNativeChoice(
  onChoose: (choice: Preferences) => void,
): Promise<PluginListenerHandle> {
  const { plugin } = await bridgePlugin();
  return plugin.addListener("preferences", onChoose);
}

/** Calls `onClose` when a native screen has closed. */
export async function onNativeClosed(
  onClose: (closed: NativeClosed) => void,
): Promise<PluginListenerHandle> {
  const { plugin } = await bridgePlugin();
  return plugin.addListener("closed", onClose);
}

/** Calls `onChange` when a native screen changed your name, picture, groups or invitations. */
export async function onNativeDataChanged(onChange: () => void): Promise<PluginListenerHandle> {
  const { plugin } = await bridgePlugin();
  return plugin.addListener("dataChanged", onChange);
}

/**
 * Calls `onSent` when a native screen invited someone to a group in a way the
 * server can't tell the page (a link, a text, an email), for the home page's
 * nudge (groupNudge.ts), which the page keeps on this phone.
 */
export async function onNativeInviteSent(
  onSent: (groupId: string) => void,
): Promise<PluginListenerHandle> {
  const { plugin } = await bridgePlugin();
  return plugin.addListener("inviteSent", ({ groupId }) => onSent(groupId));
}

/**
 * Calls `onChange` when native Dine data gave or took back the yes to the AI
 * (#120): the page does what its own switch does after (afterAiConsent),
 * since the labels and trips it deletes are kept in the page.
 */
export async function onNativeAiConsent(
  onChange: (on: boolean) => void,
): Promise<PluginListenerHandle> {
  const { plugin } = await bridgePlugin();
  return plugin.addListener("aiConsent", ({ on }) => onChange(on));
}

/**
 * Answers native Dine data's question about what is kept only on this phone,
 * in the page (`count` of labels, #112).
 */
export async function onNeedPhoneFacts(
  count: () => Promise<{ labels: number }>,
): Promise<PluginListenerHandle> {
  const { plugin } = await bridgePlugin();
  return plugin.addListener("needPhoneFacts", () => {
    void count()
      .catch(() => ({ labels: 0 }))
      .then((facts) => plugin.phoneFacts(facts))
      // The app stops waiting by itself after a few seconds.
      .catch(() => {});
  });
}

/**
 * Calls `write` when a native screen put an event into a calendar on this
 * phone (#199): the page writes the phone's calendar, as it does for its own
 * Tilføj til min kalender, then tells the app it is done.
 */
export async function onNeedPhoneWrite(write: () => Promise<void>): Promise<PluginListenerHandle> {
  const { plugin } = await bridgePlugin();
  return plugin.addListener("needPhoneWrite", ({ id }) => {
    void write()
      .catch((err) => console.warn("writing the phone's calendar failed", err))
      // Which ask this answers, so the app ignores one that comes too late.
      .then(() => plugin.phoneWritten({ id }))
      // The app stops waiting by itself.
      .catch(() => {});
  });
}

/** Calls `onNeed` when a native screen's login has run out, so the page refreshes it. */
export async function onNeedSession(onNeed: () => void): Promise<PluginListenerHandle> {
  const { plugin } = await bridgePlugin();
  return plugin.addListener("needSession", onNeed);
}

/**
 * Calls `enable` when a native screen asks to turn notifications on, and tells
 * it how that went. The page does it: the phone's token reaches only the page.
 */
export async function onEnablePush(
  enable: () => Promise<"granted" | "denied">,
): Promise<PluginListenerHandle> {
  const { plugin } = await bridgePlugin();
  return plugin.addListener("enablePush", () => {
    void enable()
      .catch(() => "failed" as const)
      .then((answer) => plugin.pushResult({ answer }));
  });
}
