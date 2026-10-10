import { useQuery } from "@tanstack/react-query";

import { adminStatusQuery } from "@/api/admin";
import type { SuggestedEvent } from "@/api/events";
import AiReadout from "@/components/ui/AiReadout";
import { useAuth } from "@/context/auth";
import { useT } from "@/i18n/lang";

/**
 * What Casy's AI expects an event to involve for the people going (#113):
 * a late night, alcohol, a long journey, hard exercise, how tiring it is.
 * Only for admins while it is tested, to judge the profiles before the
 * warnings (#114) are built on them; nothing for anyone else, or for an
 * event that came without a profile.
 */
export default function EventImpactDetails({
  event,
  className,
}: {
  event: SuggestedEvent;
  className?: string;
}) {
  const t = useT();
  const { user } = useAuth();
  const impact = event.impact;
  const { data: isAdmin } = useQuery({
    ...adminStatusQuery(user?.id ?? ""),
    enabled: !!user && !!impact,
  });
  if (!impact || isAdmin !== true) return null;

  const words = t.eventImpact;
  const facts = [
    ...impact.effects.map((e) => words.effects[e]),
    impact.runsLate && words.runsLate,
    impact.recoveryDays > 0 && t.eventLabel.recovery(impact.recoveryDays),
    impact.outdoors && words.outdoors,
    impact.daylight && words.daylight,
  ].filter((f): f is string => !!f);

  return (
    <AiReadout
      className={className}
      toggle={words.toggle}
      headline={`${t.eventLabel.strain[impact.strain]} · ${t.eventLabel.confidence[impact.confidence]}`}
      facts={facts}
      reason={impact.reason}
      footer={<p className="text-muted-foreground">{words.adminOnly}</p>}
    />
  );
}
