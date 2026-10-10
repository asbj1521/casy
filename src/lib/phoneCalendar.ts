/**
 * The iPhone app's own calendar plugin (PhoneCalendarPlugin in ios/): the
 * phone's calendars through EventKit. Everything here is the app's only; the
 * website never calls it (see isNativeApp).
 *
 * @capacitor/core is loaded on first use, so the website never downloads it.
 * Only the module goes through promises, never the plugin: a Capacitor plugin
 * answers to every property name, `then` included, so a promise resolved with
 * one waits forever (as in useSpeechInput.ts).
 */
import type { PluginListenerHandle } from "@capacitor/core";
import { queryOptions } from "@tanstack/react-query";

import type { PhoneWork, PhoneWriteReport } from "@/api/calendars";
import type { PhoneRead } from "@/lib/phoneBusy";
import type { PhoneEventWithDetails } from "@/lib/phoneEvents";
import { readStored, writeStored } from "@/lib/storage";

export type PhoneAccess = "granted" | "prompt" | "denied";

interface PhoneCalendarPlugin {
  access(): Promise<{ state: PhoneAccess }>;
  requestAccess(): Promise<{ state: PhoneAccess }>;
  read(options: { from: number; to: number }): Promise<PhoneRead>;
  readDetails(options: { from: number; to: number }): Promise<{ events: PhoneEventWithDetails[] }>;
  openSettings(): Promise<void>;
  backgroundState(): Promise<{ configured: boolean }>;
  setBackground(options: {
    url: string;
    apiKey: string;
    deviceId: string;
    label: string;
    token: string;
  }): Promise<{ configured: boolean }>;
  clearBackground(): Promise<void>;
  applyWrites(work: PhoneWork): Promise<{ reports: PhoneWriteReport[] }>;
  addListener(event: "change", listener: () => void): Promise<PluginListenerHandle>;
}

const core = () => import("@capacitor/core");
let plugin: PhoneCalendarPlugin | null = null;

/** The plugin, registered once. Returned to callers that call it at once, never resolved through a promise. */
async function phonePlugin(): Promise<{ plugin: PhoneCalendarPlugin }> {
  if (!plugin) {
    const { registerPlugin } = await core();
    plugin = registerPlugin<PhoneCalendarPlugin>("PhoneCalendar");
  }
  // Wrapped: resolving a promise with the plugin itself would never settle.
  return { plugin };
}

export async function phoneAccess(): Promise<PhoneAccess> {
  const { plugin } = await phonePlugin();
  return (await plugin.access()).state;
}

/** iOS's question the first time; after that iOS answers with what was chosen. */
export async function requestPhoneAccess(): Promise<PhoneAccess> {
  const { plugin } = await phonePlugin();
  return (await plugin.requestAccess()).state;
}

export async function readPhoneCalendars(from: number, to: number): Promise<PhoneRead> {
  const { plugin } = await phonePlugin();
  return await plugin.read({ from, to });
}

/**
 * The phone's events with their titles, places and notes, for this phone's
 * own views only (phoneEvents.ts). Never sent: the push is built from
 * readPhoneCalendars.
 */
export async function readPhoneEventDetails(
  from: number,
  to: number,
): Promise<PhoneEventWithDetails[]> {
  const { plugin } = await phonePlugin();
  return (await plugin.readDetails({ from, to })).events;
}

/**
 * This phone's events with their details over `window`, as one cached query
 * shared by My calendar (useMyCalendarDays) and the labels (useEventLabels),
 * so the phone is read once for both. Not in the persisted queries
 * (queryPersistence.ts), so never written to storage.
 */
export function phoneEventDetailsQuery(userId: string, window: { start: string; end: string }) {
  return queryOptions({
    queryKey: ["phone-event-details", userId],
    queryFn: () => readPhoneEventDetails(Date.parse(window.start), Date.parse(window.end)),
    staleTime: 30_000,
    // An app build without readDetails: the blocks as the server has them.
    retry: false,
  });
}

export async function openPhoneSettings(): Promise<void> {
  const { plugin } = await phonePlugin();
  await plugin.openSettings();
}

/**
 * Carry out the server's calendar work on the phone (PhoneCalendarWriter.swift):
 * agreed events to add, change or take out, and entries to check are still there.
 */
export async function applyPhoneWrites(work: PhoneWork): Promise<PhoneWriteReport[]> {
  const { plugin } = await phonePlugin();
  return (await plugin.applyWrites(work)).reports;
}

/** Calls `listener` when the phone's calendars change; returns how to stop. */
export async function onPhoneCalendarChange(listener: () => void): Promise<() => void> {
  const { plugin } = await phonePlugin();
  const handle = await plugin.addListener("change", listener);
  return () => void handle.remove();
}

/* ----------------------------------------------------------------------------
 * The background refresh (PhoneCalendarBackground.swift): iOS wakes the app
 * now and then and its native side sends the phone's calendars without this
 * page, with the phone's own device token (calendar-phone).
 * ------------------------------------------------------------------------- */

/** Whether the native side has a token to send with; false where it can't say. */
export async function backgroundConfigured(): Promise<boolean> {
  const { plugin } = await phonePlugin();
  return (await plugin.backgroundState()).configured;
}

/** Hand the native side the token calendar-phone issued, with where to send. */
export async function setPhoneBackground(token: string): Promise<void> {
  const { plugin } = await phonePlugin();
  await plugin.setBackground({
    url: import.meta.env.VITE_SUPABASE_URL,
    apiKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    deviceId: deviceId(),
    label: deviceLabel(),
    token,
  });
}

/** Nothing is sent in the background any more (signed out, or this phone removed). */
export async function clearPhoneBackground(): Promise<void> {
  const { plugin } = await phonePlugin();
  await plugin.clearBackground();
}

/* ----------------------------------------------------------------------------
 * What this phone remembers: its own random id (which phone a connection is,
 * so a second phone is a second connection), and whether it is connected for
 * the account signed in, with the connection's id.
 * ------------------------------------------------------------------------- */

const DEVICE_KEY = "casy-device-id";
const connectedKey = (userId: string) => `casy-phone-calendar:${userId}`;

/** This phone's id, made the first time it is asked for. */
export function deviceId(): string {
  const stored = readStored(DEVICE_KEY);
  if (stored) return stored;
  const id = crypto.randomUUID();
  writeStored(DEVICE_KEY, id);
  return id;
}

/** What the account is listed as. */
export function deviceLabel(): string {
  return /iPad/.test(navigator.userAgent) ? "iPad" : "iPhone";
}

/** The connection this phone sends to for `userId`, or null if it isn't connected. */
export function phoneConnectionId(userId: string): string | null {
  return readStored(connectedKey(userId));
}

export function rememberPhoneConnection(userId: string, connectionId: string | null): void {
  writeStored(connectedKey(userId), connectionId);
}

/** This phone is no longer connected for `userId`: it stops sending, in the background too. */
export function forgetPhone(userId: string): void {
  rememberPhoneConnection(userId, null);
  clearPhoneBackground().catch((err) =>
    console.warn("clearing the background refresh failed", err),
  );
}
