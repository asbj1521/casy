import { useState } from "react";
import { History } from "lucide-react";

import { useLang, useT } from "@/i18n/lang";
import { nameList } from "@/lib/format";
import { cn } from "@/lib/utils";

const DAY_MS = 86_400_000;

/**
 * Members whose calendar hasn't been updated for days (a phone whose app
 * hasn't been opened, or a sync that keeps failing). Their busy times still
 * count; this says the answer may not know about something newer. The answer
 * card and the phone flow's notes both show it.
 */
export default function OutdatedNote({
  outdated,
  className,
}: {
  /** Names as the page shows them, and when each calendar was last updated (ISO). */
  outdated: { name: string; since: string }[];
  className?: string;
}) {
  const t = useT();
  const { lang } = useLang();
  // Read once: days are plenty precise, and rendering mustn't depend on the clock.
  const [now] = useState(Date.now);
  if (outdated.length === 0) return null;
  return (
    <p className={cn("flex items-start gap-1.5 text-muted-foreground", className)}>
      <History className="mt-0.5 h-4 w-4 shrink-0" />
      {outdated.length === 1
        ? t.scheduler.outdatedOne(
            outdated[0].name,
            // A span of time, not calendar days: plain milliseconds are right.
            Math.max(1, Math.floor((now - Date.parse(outdated[0].since)) / DAY_MS)),
          )
        : t.scheduler.outdatedMany(
            nameList(
              outdated.map((o) => o.name),
              lang,
            ),
          )}
    </p>
  );
}
