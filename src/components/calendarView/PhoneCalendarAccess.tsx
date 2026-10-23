import { Link } from "react-router-dom";
import { CalendarArrowDown } from "lucide-react";

import FlowButton from "@/components/ui/FlowButton";
import { useCalendarsHome } from "@/hooks/useCalendarsHome";
import type { usePhoneImport } from "@/hooks/usePhoneImport";
import { useT } from "@/i18n/lang";
import { openPhoneSettings } from "@/lib/phoneCalendar";

type Import = ReturnType<typeof usePhoneImport>;

/**
 * What the iPhone app says when nothing is connected (#132): a card over the
 * month, never above it, so the month keeps its place. It says Casy can't see
 * a calendar yet and has one button: import the phone's, which asks iOS first
 * when it hasn't been asked, or leads to Settings when it was refused.
 */
export default function PhoneCalendarAccess({
  phone,
  onNotNow,
}: {
  phone: Import;
  /** Only for someone with other calendars: put the card away for now. */
  onNotNow?: () => void;
}) {
  const t = useT();
  const words = t.phoneCalendar;
  const home = useCalendarsHome();
  const { access, importing, outcome, error } = phone;
  const denied = access === "denied" || outcome?.state === "denied";

  const button = importing
    ? words.importing
    : denied
      ? words.openSettings
      : access === "prompt"
        ? words.allowAndImport
        : words.importCalendar;
  // What the last press came to, under the button.
  const note = error
    ? error
    : outcome?.state === "synced" && outcome.calendars === 0
      ? words.nothingOnPhone
      : outcome && outcome.state !== "synced" && outcome.state !== "denied"
        ? words.couldntRead
        : null;

  return (
    <div
      role="status"
      className="glass fixed inset-x-4 top-[24%] z-30 mx-auto max-w-sm rounded-[28px] p-5 text-center"
    >
      <CalendarArrowDown className="mx-auto h-8 w-8 text-primary" aria-hidden />
      <h2 className="mt-3 text-lg font-bold text-foreground">
        {phone.others ? words.phoneTitle : words.needTitle}
      </h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
        {denied ? words.denied : words.needBody}
        {!denied && access === "prompt" && ` ${words.needAsk}`}
      </p>
      <div className="mt-4">
        <FlowButton
          disabled={importing}
          busy={importing}
          onClick={denied ? () => void openPhoneSettings() : phone.importNow}
        >
          {button}
        </FlowButton>
      </div>
      {note && <p className="mt-3 text-sm text-red-600">{note}</p>}
      {onNotNow ? (
        <button
          type="button"
          onClick={onNotNow}
          className="mt-3 block w-full text-sm font-semibold text-primary"
        >
          {words.notNow}
        </button>
      ) : (
        <Link to={home.to} className="mt-3 block text-sm font-semibold text-primary">
          {words.otherCalendar}
        </Link>
      )}
    </div>
  );
}
