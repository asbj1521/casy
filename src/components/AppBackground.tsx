import NativeBridgeSync from "@/components/NativeBridgeSync";
import { useDayFactsSync } from "@/hooks/useDayFactsSync";
import { useAutoLabel } from "@/hooks/useEventLabels";
import { usePhoneCalendarSync } from "@/hooks/usePhoneCalendarSync";
import { useAutoTripLegs } from "@/hooks/useTrips";

/**
 * The iPhone app's background work: Casy kept in step with the phone's
 * calendars (usePhoneCalendarSync), the phone's events labelled by AI
 * (useAutoLabel), its flights, trains and buses read for trip detection
 * (useAutoTripLegs), and what ranks a vote's dates shared with the server
 * (useDayFactsSync), and the app's native screens told the login and the
 * preferences (NativeBridgeSync, #198). Loaded only in the app (App.tsx), so
 * the website never downloads it (#157); each hook also checks it is in the app.
 */
export default function AppBackground() {
  usePhoneCalendarSync();
  useAutoLabel();
  useAutoTripLegs();
  useDayFactsSync();
  return <NativeBridgeSync />;
}
