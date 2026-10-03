import { Navigate, useLocation } from "react-router-dom";

import CalendarReturnNotice from "@/components/CalendarReturnNotice";
import CalendarsSection from "@/components/CalendarsSection";
import PhoneSubHeader from "@/components/PhoneSubHeader";
import { useSignedInUser } from "@/context/auth";
import { useCalendarReturn } from "@/hooks/useCalendarReturn";
import { usePhoneLayout } from "@/hooks/usePhoneLayout";
import { useT } from "@/i18n/lang";

/**
 * Connecting and managing calendars on a phone (/calendar-overview/accounts),
 * opened from the Calendar tab: the primary calendar, every account, adding
 * more, syncing. Coming back from Google or Outlook lands here too (sent on by
 * ProfileHub). A computer has all of this on the profile page, so it is sent
 * there, with any link parameters, which that page understands.
 */
export default function CalendarAccounts() {
  const { search } = useLocation();
  return usePhoneLayout() ? <AccountsScreen /> : <Navigate to={`/profile${search}`} replace />;
}

function AccountsScreen() {
  const t = useT();
  const oauthReturn = useCalendarReturn(useSignedInUser().id);
  return (
    <div className="min-h-screen bg-background">
      <PhoneSubHeader
        title={t.profile.connectedCalendars}
        back="/calendar-overview"
        backLabel={t.nav.calendarShort}
      />
      <main className="px-4 pb-8">
        {oauthReturn && <CalendarReturnNotice outcome={oauthReturn} className="mt-2" />}
        <CalendarsSection titled={false} />
      </main>
    </div>
  );
}
