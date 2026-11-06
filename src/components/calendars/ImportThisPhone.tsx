import OnlyTimesDemo from "@/components/calendarView/OnlyTimesDemo";
import FlowButton from "@/components/ui/FlowButton";
import { useT } from "@/i18n/lang";
import { openPhoneSettings } from "@/lib/phoneCalendar";

/**
 * The way in, in the app with nothing connected yet (#229): what the home page's
 * import sheet says (PhoneCalendarAccess), with its one button. One press and iOS
 * asks, and every calendar on the phone comes in; nothing else to choose, so
 * nothing else competes with it here.
 */
export default function ImportThisPhone({
  importing,
  denied,
  onImport,
}: {
  importing: boolean;
  /** iOS said no: only its Settings can change that. */
  denied: boolean;
  onImport: () => void;
}) {
  const words = useT().phoneCalendar;
  return (
    <section className="mt-2">
      <h2 className="px-1 text-[1.5rem] font-extrabold tracking-tight text-foreground">
        {words.needTitle}
      </h2>
      <div className="mt-3">
        <OnlyTimesDemo />
      </div>
      <p className="mb-4 px-1 text-[0.9375rem] text-muted-foreground">{words.needBody}</p>
      <FlowButton
        busy={importing}
        disabled={importing}
        onClick={denied ? () => void openPhoneSettings() : onImport}
      >
        {denied ? words.openSettings : importing ? words.importing : words.importCalendar}
      </FlowButton>
    </section>
  );
}
