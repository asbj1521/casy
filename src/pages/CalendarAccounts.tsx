import { Link, Navigate, useLocation } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

import CalendarReturnNotice from "@/components/CalendarReturnNotice";
import CalendarsSection from "@/components/CalendarsSection";
import TopNav from "@/components/TopNav";
import { useSignedInUser } from "@/context/auth";
import { useCalendarReturn } from "@/hooks/useCalendarReturn";
import { usePhoneLayout } from "@/hooks/usePhoneLayout";
import { useT } from "@/i18n/lang";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

/**
 * Connecting and managing calendars (/calendar-overview/accounts), opened from
 * My calendar: the primary calendar, every account, adding more, syncing.
 * Coming back from Google or Outlook, or new from sign-in, lands here too
 * (passed on by the profile, where the OAuth callbacks still return). A
 * computer shows it as a page under the header; a phone inside its sheet (#219).
 */
export default function CalendarAccounts() {
  // A phone has it inside the Kalendere sheet (#219), what the link carried kept.
  return usePhoneLayout() ? <PhoneRedirect /> : <ComputerPage />;
}

function PhoneRedirect() {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  params.set("calendars", "accounts");
  return <Navigate to={`/?${params}`} replace />;
}

function ComputerPage() {
  const t = useT();
  useDocumentTitle(t.profile.connectedCalendars);
  const oauthReturn = useCalendarReturn(useSignedInUser().id);
  const notice = oauthReturn && <CalendarReturnNotice outcome={oauthReturn} className="mt-2" />;

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main className="px-4 pb-20 pt-4 sm:px-6 lg:px-8">
        <Link
          to="/calendar-overview"
          className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t.nav.calendar}
        </Link>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-foreground">
          {t.profile.connectedCalendars}
        </h1>
        {notice}
        <CalendarsSection />
      </main>
    </div>
  );
}
