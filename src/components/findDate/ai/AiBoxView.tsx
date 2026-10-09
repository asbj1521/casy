import type { ReactNode } from "react";

import AiConversation from "@/components/findDate/ai/AiConversation";
import type { AiPlanner } from "@/hooks/useAiPlanner";
import { useT } from "@/i18n/lang";

/**
 * Planning with AI (#100) on a computer, filling the settings box: the
 * conversation, and once Casy has answered, what it picked up beside it, so
 * its questions and their effect are seen together. Each side scrolls on its
 * own within the box, which keeps the height the settings give it.
 */
export default function AiBoxView({
  planner,
  members,
  summary,
}: {
  planner: AiPlanner;
  members: { profileId: string; name: string; isYou: boolean }[];
  /** What Casy picked up (PlanSummary). */
  summary: ReactNode;
}) {
  const t = useT();
  const conversation = <AiConversation planner={planner} members={members} />;

  if (!planner.session.plan) {
    return <div className="h-full overflow-y-auto pr-1">{conversation}</div>;
  }
  return (
    <div className="grid h-full grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-5">
      <div className="min-h-0 overflow-y-auto pr-1">{conversation}</div>
      <div className="min-h-0 overflow-y-auto">
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          {t.aiPlan.understood}
        </h3>
        {summary}
      </div>
    </div>
  );
}
