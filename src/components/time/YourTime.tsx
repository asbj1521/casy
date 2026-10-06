import { useLang, useT } from "@/i18n/lang";
import type { EventSettings } from "@/lib/eventSearch";
import { yourTime } from "@/lib/viewerTime";
import { cn } from "@/lib/utils";

/**
 * An event's time on the viewer's own clock, "12:00-14:00 your time", under
 * its Danish time; nothing when the two clocks agree (lib/viewerTime.ts).
 */
export default function YourTime({
  kind,
  date,
  className,
}: {
  kind: EventSettings["kind"];
  date: { start: string; end: string };
  className?: string;
}) {
  const t = useT();
  const { lang } = useLang();
  const text = yourTime(kind, date, lang);
  if (!text) return null;
  return (
    <span className={cn("block text-sm font-normal text-muted-foreground", className)}>
      {t.timeZone.yours(text)}
    </span>
  );
}
