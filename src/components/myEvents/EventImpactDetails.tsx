import type { ReactNode } from "react";

import type { SuggestedEvent } from "@/api/events";
import AiReadout from "@/components/ui/AiReadout";
import { useAiTester } from "@/hooks/useAiAllowed";
import { useT } from "@/i18n/lang";

/**
 * What Casy's AI expects an event to involve for the people going (#113):
 * a late night, alcohol, a long journey, hard exercise, how tiring it is.
 * Only for admins and AI testers while it is tested (useAiTester), to judge
 * the profiles before the warnings (#114) are built on them; nothing for
 * anyone else, or for an event that came without a profile.
 */
export default function EventImpactDetails({
  event,
  beside,
  className,
}: {
  event: SuggestedEvent;
  /** What starts its line (AiReadout's `beside`), shown alone when there is nothing to read. */
  beside?: ReactNode;
  className?: string;
}) {
  const t = useT();
  const tester = useAiTester();
  const impact = event.impact;
  if (!impact || !tester) return beside ? <div className={className}>{beside}</div> : null;

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
      footer={<p className="text-muted-foreground">{words.testersOnly}</p>}
      beside={beside}
    />
  );
}
