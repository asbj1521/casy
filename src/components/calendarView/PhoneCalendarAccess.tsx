import { Link } from "react-router-dom";
import { CalendarX2 } from "lucide-react";

import { useCalendarsHome } from "@/hooks/useCalendarsHome";
import type { PhoneAccessState } from "@/hooks/useConnectPhoneOnOpen";
import { useT } from "@/i18n/lang";
import { openPhoneSettings } from "@/lib/phoneCalendar";

/**
 * What the iPhone app says when My calendar is empty because the phone's
 * calendar can't be read (#132): a card over the month, never above it, so
 * the month keeps its place. Shown only after iOS's question has been
 * answered no (or failed); while it is being asked there is nothing to say.
 */
export default function PhoneCalendarAccess({
  state,
  onRetry,
}: {
  state: Exclude<PhoneAccessState, "asking" | null>;
  onRetry: () => void;
}) {
  const t = useT();
  const words = t.phoneCalendar;
  const home = useCalendarsHome();
  const denied = state === "denied";
  return (
    <div
      role="status"
      className="fixed inset-x-4 top-[26%] z-30 mx-auto max-w-sm rounded-3xl border bg-card p-5 text-center shadow-xl"
    >
      <CalendarX2 className="mx-auto h-8 w-8 text-primary" aria-hidden />
      <h2 className="mt-3 text-lg font-bold text-foreground">{words.needTitle}</h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
        {denied ? words.denied : words.needFailed}
      </p>
      <button
        type="button"
        onClick={denied ? () => void openPhoneSettings() : onRetry}
        className="mt-4 h-11 w-full rounded-full bg-cta text-[15px] font-bold text-white transition hover:bg-cta-hover"
      >
        {denied ? words.openSettings : words.tryAgain}
      </button>
      <Link to={home.to} className="mt-3 block text-sm font-semibold text-primary">
        {words.otherCalendar}
      </Link>
    </div>
  );
}
