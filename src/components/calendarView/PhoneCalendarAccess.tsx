import { Link } from "react-router-dom";
import { CalendarArrowDown, Loader2 } from "lucide-react";

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
export default function PhoneCalendarAccess({ phone }: { phone: Import }) {
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
      className="fixed inset-x-4 top-[24%] z-30 mx-auto max-w-sm rounded-3xl border bg-card p-5 text-center shadow-xl"
    >
      <CalendarArrowDown className="mx-auto h-8 w-8 text-primary" aria-hidden />
      <h2 className="mt-3 text-lg font-bold text-foreground">{words.needTitle}</h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
        {denied ? words.denied : words.needBody}
        {!denied && access === "prompt" && ` ${words.needAsk}`}
      </p>
      <button
        type="button"
        disabled={importing}
        onClick={denied ? () => void openPhoneSettings() : phone.importNow}
        className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-cta text-[15px] font-bold text-white transition hover:bg-cta-hover disabled:opacity-70"
      >
        {importing && <Loader2 className="h-4 w-4 animate-spin" />}
        {button}
      </button>
      {note && <p className="mt-3 text-sm text-red-600">{note}</p>}
      <Link to={home.to} className="mt-3 block text-sm font-semibold text-primary">
        {words.otherCalendar}
      </Link>
    </div>
  );
}
