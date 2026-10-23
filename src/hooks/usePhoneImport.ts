import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useSignedInUser } from "@/context/auth";
import { syncPhone } from "@/hooks/usePhoneCalendarSync";
import { isNativeApp } from "@/lib/nativeApp";
import { phoneAccess, type PhoneAccess } from "@/lib/phoneCalendar";

/**
 * Bringing the phone's calendar into Casy from My calendar, in the iPhone app
 * (#132): when nothing is connected, the page shows a card with one button,
 * whatever iOS has been told so far. Pressing it connects This phone: iOS's
 * own question first if it hasn't been asked, then the calendars are read and
 * sent, and the month fills in. Nothing happens by itself, so the card is
 * never waiting on something that can't be seen.
 *
 * `none`: the person has no calendar of any kind connected.
 */
export function usePhoneImport(none: boolean) {
  const userId = useSignedInUser().id;
  const queryClient = useQueryClient();
  const on = isNativeApp && none;

  // What iOS has been told: decides what the button says.
  const access = useQuery({
    queryKey: ["phone-access", userId],
    queryFn: phoneAccess,
    enabled: on,
    staleTime: 0,
  });
  const { refetch } = access;
  const run = useMutation({
    mutationFn: () => syncPhone(queryClient, userId, { create: true }),
    onSettled: () => void refetch(),
  });

  // Back from Settings with access switched on: the button says so.
  useEffect(() => {
    if (!on) return;
    const back = () => {
      if (document.visibilityState === "visible") void refetch();
    };
    document.addEventListener("visibilitychange", back);
    return () => document.removeEventListener("visibilitychange", back);
  }, [on, refetch]);

  return {
    /** Show the card: the app, and nothing connected. */
    on,
    /** What iOS has been told, once read. */
    access: (access.data ?? null) as PhoneAccess | null,
    importing: run.isPending,
    /** What the last press came to: the calendars sent, or why not. */
    outcome: run.data ?? null,
    error: run.error?.message ?? null,
    importNow: () => run.mutate(),
  };
}
