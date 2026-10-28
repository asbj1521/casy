import { lazy, Suspense } from "react";
import { Navigate, useLocation } from "react-router-dom";

import AiConsentPrompt from "@/components/ai/AiConsentPrompt";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { usePhoneLayout } from "@/hooks/usePhoneLayout";
import { useT } from "@/i18n/lang";
import { loadPage } from "@/pages/lazyPages";

// Each device downloads only its own month view (#157).
const ComputerCalendar = lazy(loadPage.computerCalendar);
const PhoneCalendar = lazy(loadPage.phoneCalendar);

/**
 * My calendar (/calendar-overview): your own busy time drawn like Apple
 * Calendar's month view (#104), the iPhone's on a phone (PhoneCalendar) and
 * the Mac's on a computer (ComputerCalendar), with the calendars and how
 * each counts beside it or in a sheet. On a phone it is the home page (#169),
 * at /, and its old address leads there, sheets (?plan, ?calendars) and all.
 */
export default function CalendarOverview() {
  const t = useT();
  const phone = usePhoneLayout();
  useDocumentTitle(phone ? t.nav.home : t.nav.calendar);
  const { pathname, search } = useLocation();
  if (phone && pathname !== "/") return <Navigate to={{ pathname: "/", search }} replace />;
  return (
    <>
      <Suspense fallback={<div className="min-h-screen bg-background" />}>
        {phone ? <PhoneCalendar /> : <ComputerCalendar />}
      </Suspense>
      {/* Asked once, before Casy's AI reads anything from a calendar (#120). */}
      <AiConsentPrompt />
    </>
  );
}
