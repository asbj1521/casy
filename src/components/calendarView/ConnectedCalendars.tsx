import CalendarReturnNotice from "@/components/CalendarReturnNotice";
import CalendarsSection from "@/components/CalendarsSection";
import { useSignedInUser } from "@/context/auth";
import { useCalendarReturn } from "@/hooks/useCalendarReturn";

/** "Forbundne kalendere", the screen inside the phone's Kalendere sheet (#219). */
export default function ConnectedCalendars() {
  const oauthReturn = useCalendarReturn(useSignedInUser().id);
  return (
    <>
      {oauthReturn && <CalendarReturnNotice outcome={oauthReturn} className="mb-2" />}
      <CalendarsSection />
    </>
  );
}
