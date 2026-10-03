import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import { calendarsChanged } from "@/api/calendars";
import { markCalendarOnboardingSeen } from "@/lib/calendarOnboarding";

/** What an OAuth callback sent the browser back with, if anything. */
export type OAuthOutcome = { connected: string } | { failed: string };

function oauthOutcome(params: URLSearchParams): OAuthOutcome | null {
  const connected = params.get("connected");
  if (connected) return { connected };
  const failed = params.get("error");
  return failed ? { failed } : null;
}

/**
 * Arrivals on the page that holds your calendars (the profile on a computer,
 * its calendars screen on a phone), with the outcome for CalendarReturnNotice.
 *
 * The OAuth callbacks send the browser back with ?connected=<provider> or
 * ?error=<provider>:<reason>, a fresh page load. The outcome is read once as
 * the page loads and stays on screen; the parameters are stripped from the
 * address, so a refresh doesn't show it again.
 *
 * ?onboarding=1 means straight from sign-in with no calendars connected yet
 * (see SignIn.tsx). Marked seen at once so this device isn't sent back on
 * every visit; the note itself shows whenever no calendar is linked.
 */
export function useCalendarReturn(userId: string): OAuthOutcome | null {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const [oauthReturn] = useState(() => oauthOutcome(searchParams));
  useEffect(() => {
    if (!oauthReturn) return;
    setSearchParams(
      (params) => {
        params.delete("connected");
        params.delete("error");
        return params;
      },
      { replace: true },
    );
    void calendarsChanged(queryClient);
  }, [oauthReturn, setSearchParams, queryClient]);

  const onboarding = searchParams.get("onboarding") === "1";
  useEffect(() => {
    if (onboarding) markCalendarOnboardingSeen(userId);
  }, [onboarding, userId]);

  return oauthReturn;
}
