import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useSignedInUser } from "@/context/auth";
import { syncPhone } from "@/hooks/usePhoneCalendarSync";
import { isNativeApp } from "@/lib/nativeApp";
import { phoneAccess, phoneConnectionId, type PhoneAccess } from "@/lib/phoneCalendar";

/**
 * Bringing the phone's calendar into Casy from My calendar, in the iPhone app
 * (#132): whenever this phone isn't connected, the page shows a card with one
 * button, whatever iOS has been told so far and whatever else is connected. Pressing it connects This phone: iOS's
 * own question first if it hasn't been asked, then the calendars are read and
 * sent, and the month fills in. Nothing happens by itself, so the card is
 * never waiting on something that can't be seen.
 *
 * `calendars`: the person's calendars as the server lists them, or null while
 * they load (the card waits for them, so it never flashes up for someone
 * whose phone is connected).
 */
export function usePhoneImport(calendars: { connectionId: string }[] | null) {
  const userId = useSignedInUser().id;
  const queryClient = useQueryClient();
  // This phone is connected when the server lists a calendar of the connection
  // the app remembers. Anything else, an old phone, a removed connection or
  // only other accounts, gets the card: nothing else can be relied on to say
  // "your calendar isn't in Casy" (counting all calendars didn't: one leftover
  // account hid the card).
  const remembered = isNativeApp ? phoneConnectionId(userId) : null;
  const connected =
    remembered !== null && (calendars ?? []).some((c) => c.connectionId === remembered);
  const on = isNativeApp && calendars !== null && !connected;

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
    /** Show the card: the app, and this phone not connected. */
    on,
    /** Other calendars are connected: the card can be put away for now. */
    others: (calendars ?? []).length > 0,
    /** What iOS has been told, once read. */
    access: (access.data ?? null) as PhoneAccess | null,
    importing: run.isPending,
    /** What the last press came to: the calendars sent, or why not. */
    outcome: run.data ?? null,
    error: run.error?.message ?? null,
    importNow: () => run.mutate(),
  };
}
