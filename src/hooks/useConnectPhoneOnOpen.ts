import { useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useSignedInUser } from "@/context/auth";
import { syncPhone } from "@/hooks/usePhoneCalendarSync";
import { isNativeApp } from "@/lib/nativeApp";

/** Accounts already asked on this launch: once, so a refusal isn't asked again on every visit. */
const askedThisLaunch = new Set<string>();

export type PhoneAccessState =
  /** iOS's question is on screen, or the phone is being read. */
  | "asking"
  /** The person said no (now, or earlier), or switched it off in Settings. */
  | "denied"
  /** The phone's calendars couldn't be read or sent. */
  | "failed"
  | null;

/**
 * The iPhone app asks for the phone's calendar the moment My calendar opens
 * with nothing connected (#132): iOS's own question appears over the empty
 * month, and on yes This phone is connected and the calendar fills in, without
 * a trip through a connect page. Only in the app, and only once per launch;
 * `retry` asks again (iOS answers by itself after a refusal, so that leads to
 * Settings), and so does coming back to the app after a visit to Settings.
 *
 * `none`: the person has no calendar of any kind connected.
 */
export function useConnectPhoneOnOpen(none: boolean): {
  state: PhoneAccessState;
  retry: () => void;
} {
  const userId = useSignedInUser().id;
  const queryClient = useQueryClient();
  const connect = useMutation({
    mutationFn: () => syncPhone(queryClient, userId, { create: true }),
  });
  const { mutate } = connect;

  const on = isNativeApp && none;
  useEffect(() => {
    if (!on || askedThisLaunch.has(userId)) return;
    askedThisLaunch.add(userId);
    mutate();
  }, [on, userId, mutate]);

  // Back from Settings with access switched on: no need to press anything.
  const denied = connect.data?.state === "denied";
  useEffect(() => {
    if (!on || !denied) return;
    const back = () => {
      if (document.visibilityState === "visible") mutate();
    };
    document.addEventListener("visibilitychange", back);
    return () => document.removeEventListener("visibilitychange", back);
  }, [on, denied, mutate]);

  const state: PhoneAccessState = !on
    ? null
    : connect.isPending
      ? "asking"
      : connect.isError
        ? "failed"
        : denied
          ? "denied"
          : null;
  return { state, retry: () => mutate() };
}
