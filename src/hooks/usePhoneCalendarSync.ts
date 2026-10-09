import { useEffect } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";

import { calendarsChanged, pushPhoneCalendars } from "@/api/calendars";
import { useAuth } from "@/context/auth";
import { currentMessages } from "@/i18n/current";
import { isNativeApp } from "@/lib/nativeApp";
import { phoneBusy, phoneWindow } from "@/lib/phoneBusy";
import {
  backgroundConfigured,
  clearPhoneBackground,
  deviceId,
  deviceLabel,
  forgetPhone,
  onPhoneCalendarChange,
  phoneAccess,
  phoneConnectionId,
  readPhoneCalendars,
  rememberPhoneConnection,
  requestPhoneAccess,
  setPhoneBackground,
} from "@/lib/phoneCalendar";

/** Back in the app sooner than this after the last send: nothing new is sent. */
const MIN_GAP_MS = 2 * 60_000;
/** The phone's calendars changed: wait this long for the rest of the change (an account syncing) before sending. */
const CHANGE_SETTLE_MS = 10_000;

export type PhoneSyncOutcome =
  | { state: "synced"; calendars: number; busyBlocks: number }
  /** Calendar access was refused, or switched off in Settings since. */
  | { state: "denied" }
  /** The connection was removed (on the website, say); this phone stops sending. */
  | { state: "gone" }
  /** A background read found no calendars at all, which is more likely a hiccup than the truth. */
  | { state: "skipped" };

/** Reading the phone takes a second or two; past this, something is stuck. */
const READ_LIMIT_MS = 30_000;

/** `promise`, or a failure once `ms` have passed without an answer. */
function within<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`no answer in ${ms / 1000} s`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

/** The run under way, so a tap and a background trigger at once share one send. */
let running: Promise<PhoneSyncOutcome> | null = null;

/**
 * Read the phone's calendars and send them. `create` is "Connect this phone":
 * it asks for access if iOS hasn't yet, and makes the connection; without it,
 * only an existing connection is updated.
 */
export function syncPhone(
  queryClient: QueryClient,
  userId: string,
  { create }: { create: boolean },
): Promise<PhoneSyncOutcome> {
  running ??= runSync(queryClient, userId, create).finally(() => {
    running = null;
  });
  return running;
}

async function runSync(
  queryClient: QueryClient,
  userId: string,
  create: boolean,
): Promise<PhoneSyncOutcome> {
  const access = create ? await requestPhoneAccess() : await phoneAccess();
  if (access !== "granted") return { state: "denied" };

  const window = phoneWindow(Date.now());
  let calendars;
  try {
    calendars = phoneBusy(
      await within(readPhoneCalendars(window.from, window.to), READ_LIMIT_MS),
      window,
    );
  } catch (err) {
    console.warn("reading the phone's calendars failed", err);
    throw new Error(currentMessages().phoneCalendar.couldntRead, { cause: err });
  }
  if (!create && calendars.length === 0) return { state: "skipped" };

  // The background refresh needs the phone's own token; asked for only when
  // the native side has none (a new token replaces the old one).
  const issueToken = !(await backgroundConfigured().catch(() => true));
  const result = await pushPhoneCalendars({
    deviceId: deviceId(),
    label: deviceLabel(),
    create,
    issueToken,
    calendars,
  });
  if (result.gone) {
    forgetPhone(userId);
    return { state: "gone" };
  }
  rememberPhoneConnection(userId, result.connectionId);
  if (result.deviceToken) {
    await setPhoneBackground(result.deviceToken).catch((err) =>
      console.warn("starting the background refresh failed", err),
    );
  }
  await calendarsChanged(queryClient);
  return { state: "synced", calendars: result.calendars, busyBlocks: result.busyBlocks };
}

/**
 * Keeps the phone's calendars in Casy current while the app is used (mounted
 * once, in App.tsx). The server can't fetch them, so the app sends them: when
 * it opens, when it comes back to the front (at most every two minutes), and
 * when the phone's calendars change while it is open. Only once this phone
 * is connected for the account signed in; nothing at all on the website.
 * Between opens, the app's native side sends them in the background when iOS
 * allows (PhoneCalendarBackground.swift); signing out stops that.
 */
export function usePhoneCalendarSync() {
  const { user, loading } = useAuth();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();

  // Signed out: the device token belongs to the account that was signed in.
  useEffect(() => {
    if (!isNativeApp || loading || userId) return;
    clearPhoneBackground().catch((err) =>
      console.warn("clearing the background refresh failed", err),
    );
  }, [loading, userId]);

  useEffect(() => {
    if (!isNativeApp || !userId) return;
    let last = 0;
    let settle: ReturnType<typeof setTimeout> | undefined;
    let stopListening: (() => void) | null = null;
    let ended = false;

    const send = (soon: boolean) => {
      if (!phoneConnectionId(userId)) return;
      if (soon && Date.now() - last < MIN_GAP_MS) return;
      last = Date.now();
      syncPhone(queryClient, userId, { create: false }).catch((err) =>
        console.warn("sending the phone's calendars failed", err),
      );
    };

    send(false);
    const onVisible = () => {
      if (document.visibilityState === "visible") send(true);
    };
    document.addEventListener("visibilitychange", onVisible);
    onPhoneCalendarChange(() => {
      clearTimeout(settle);
      settle = setTimeout(() => send(false), CHANGE_SETTLE_MS);
    }).then(
      (stop) => {
        if (ended) stop();
        else stopListening = stop;
      },
      (err) => console.warn("listening for phone calendar changes failed", err),
    );

    return () => {
      ended = true;
      document.removeEventListener("visibilitychange", onVisible);
      clearTimeout(settle);
      stopListening?.();
    };
  }, [userId, queryClient]);
}
