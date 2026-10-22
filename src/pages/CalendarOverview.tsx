import AiConsentPrompt from "@/components/ai/AiConsentPrompt";
import ComputerCalendar from "@/components/calendarView/ComputerCalendar";
import PhoneCalendar from "@/components/calendarView/PhoneCalendar";
import { usePhoneLayout } from "@/hooks/usePhoneLayout";

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
      {phone ? <PhoneCalendar /> : <ComputerCalendar />}
      {/* Asked once, before Casy's AI reads anything from a calendar (#120). */}
      <AiConsentPrompt />
    </>
  );
}
