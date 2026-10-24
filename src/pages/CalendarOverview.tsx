import { lazy, Suspense } from "react";

import AiConsentPrompt from "@/components/ai/AiConsentPrompt";
import { usePhoneLayout } from "@/hooks/usePhoneLayout";

// Each device downloads only its own month view (#157).
const ComputerCalendar = lazy(() => import("@/components/calendarView/ComputerCalendar"));
const PhoneCalendar = lazy(() => import("@/components/calendarView/PhoneCalendar"));

/**
 * My calendar (/calendar-overview): your own busy time drawn like Apple
 * Calendar's month view (#104), the iPhone's on a phone (PhoneCalendar) and
 * the Mac's on a computer (ComputerCalendar), with the calendars and how
 * each counts beside it or in a sheet.
 */
export default function CalendarOverview() {
  const phone = usePhoneLayout();
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
