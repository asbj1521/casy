import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { calendarStatusQuery } from "@/api/calendars";
import Modal from "@/components/ui/Modal";
import { useAuth } from "@/context/auth";
import { CALENDAR_ACCOUNTS_PATH, isCalendarArrival } from "@/hooks/useCalendarsHome";
import { usePhoneLayout } from "@/hooks/usePhoneLayout";
import {
  CONNECT_PARAM,
  dismissCalendarPrompt,
  hasConnectedCalendar,
  isCalendarPromptDismissed,
  promptsOnPage,
  shouldPromptForCalendar,
} from "@/lib/calendarPrompt";
import type { CalendarProvider } from "@/types";

/**
 * The box itself, with the providers' brand marks: kept out of the entry
 * chunk, which every visitor to the landing page downloads.
 */
const loadChoices = () => import("@/components/ConnectCalendarChoices");
const ConnectCalendarChoices = lazy(loadChoices);

/**
 * When this page load began: a calendar-status answer older than this is the
 * copy remembered from an earlier visit (queryPersistence.ts), which may
 * predate a calendar connected since. The pop-up waits for a fresh one.
 */
const LOADED_AT = Date.now();

/**
 * "Connect your calendar", on a computer, for someone signed in with no
 * calendar connected: without one, every date Casy finds is found without
 * them. Picking where the calendar lives opens the calendars page with that
 * provider ready (?connect=). Closed either way, it stays closed for the
 * rest of the visit (calendarPrompt.ts). Mounted once in App.tsx; a phone
 * gets the calendars page straight after sign-in instead (SignIn.tsx).
 */
export default function ConnectCalendarPrompt() {
  const phone = usePhoneLayout();
  const { user } = useAuth();
  if (phone || !user) return null;
  return <Prompt key={user.id} userId={user.id} />;
}

function Prompt({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const [dismissed, setDismissed] = useState(() => isCalendarPromptDismissed(userId));

  // Back from Google or Outlook, the profile is about to pass the visit on to
  // the calendars page, so this page is not one to ask on.
  const onPage = promptsOnPage(pathname) && !isCalendarArrival(new URLSearchParams(search));
  // Not asked for at all once closed, so the rest of the visit costs nothing.
  const { data, dataUpdatedAt } = useQuery({
    ...calendarStatusQuery(userId),
    enabled: onPage && !dismissed,
  });
  const open =
    onPage &&
    shouldPromptForCalendar({
      pathname,
      connections: dataUpdatedAt >= LOADED_AT ? data : undefined,
      dismissed,
    });

  // Fetch the box while the fresh answer is on its way, so it opens whole.
  // Not for anyone a remembered answer already shows a calendar for.
  const likely = onPage && !dismissed && !(data && hasConnectedCalendar(data));
  useEffect(() => {
    if (likely) void loadChoices();
  }, [likely]);

  const close = useCallback(() => {
    dismissCalendarPrompt(userId);
    setDismissed(true);
  }, [userId]);

  function choose(provider: CalendarProvider) {
    close();
    navigate(`${CALENDAR_ACCOUNTS_PATH}?${CONNECT_PARAM}=${provider}`);
  }

  // Escape closes it, like "Not now".
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  return (
    <Modal open={open} onClose={close}>
      <Suspense fallback={null}>
        <ConnectCalendarChoices onChoose={choose} onClose={close} />
      </Suspense>
    </Modal>
  );
}
