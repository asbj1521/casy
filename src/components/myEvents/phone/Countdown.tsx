import { useEffect, useState } from "react";
import { Timer } from "lucide-react";

import { useT } from "@/i18n/lang";
import { formatCountdown } from "@/lib/format";

/**
 * The time left until a vote is settled (#177), ticking down each second:
 * shown rather than said, in place of "Afgøres senest ... kl. ...".
 */
export default function Countdown({ until }: { until: string }) {
  const t = useT();
  const end = Date.parse(until);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
      <Timer className="h-3.5 w-3.5" aria-hidden />
      {t.events.settlesIn}
      <span className="font-semibold tabular-nums text-foreground">
        {formatCountdown(end - now)}
      </span>
    </p>
  );
}
