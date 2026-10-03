import Notice from "@/components/ui/Notice";
import type { OAuthOutcome } from "@/hooks/useCalendarReturn";
import { useT } from "@/i18n/lang";

/** How connecting Google or Outlook went, after its consent page (useCalendarReturn). */
export default function CalendarReturnNotice({
  outcome,
  className,
}: {
  outcome: OAuthOutcome;
  className?: string;
}) {
  const t = useT();
  return "connected" in outcome ? (
    <Notice tone="success" className={className}>
      {t.profile.connected(
        outcome.connected in t.providers
          ? t.providers[outcome.connected as keyof typeof t.providers].label
          : t.profile.yourCalendar,
      )}
    </Notice>
  ) : (
    <Notice tone="error" className={className}>
      {t.profile.couldntConnect(
        // "google:access_denied": the reason after the colon, in words.
        t.profile.oauthErrors[outcome.failed.split(":")[1] ?? ""] ?? outcome.failed,
      )}
    </Notice>
  );
}
