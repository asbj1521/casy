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

import type { PhoneRead } from "@/lib/phoneBusy";
import { readStored, writeStored } from "@/lib/storage";

export type PhoneAccess = "granted" | "prompt" | "denied";

interface PhoneCalendarPlugin {
  access(): Promise<{ state: PhoneAccess }>;
  requestAccess(): Promise<{ state: PhoneAccess }>;
  read(options: { from: number; to: number }): Promise<PhoneRead>;
  openSettings(): Promise<void>;
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

export async function openPhoneSettings(): Promise<void> {
  const { plugin } = await phonePlugin();
  await plugin.openSettings();
}

/** Calls `listener` when the phone's calendars change; returns how to stop. */
export async function onPhoneCalendarChange(listener: () => void): Promise<() => void> {
  const { plugin } = await phonePlugin();
  const handle = await plugin.addListener("change", listener);
  return () => void handle.remove();
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
