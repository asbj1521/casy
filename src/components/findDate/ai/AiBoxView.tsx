import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";

import AiConversation from "@/components/findDate/ai/AiConversation";
import type { AiPlanner } from "@/hooks/useAiPlanner";
import { useT } from "@/i18n/lang";

/**
 * Planning with AI (#100) on a computer, filling the settings box: the
 * conversation, and once Casy has answered, what it picked up beside it, so
 * its questions and their effect are seen together. "Add details" and
 * "Start over" are the box's top row (SettingsPanel), not a line of their
 * own here, so a question with its options fits beside the answer (#124).
 * Both columns take the height they need; the box's panel grows to fit them.
 */
export default function AiBoxView({
  planner,
  members,
  summary,
  adding,
  onAdding,
}: {
  planner: AiPlanner;
  /** Whether more details are being written (the box's top row starts it). */
  adding: boolean;
  onAdding: (adding: boolean) => void;
  members: { profileId: string; name: string; isYou: boolean }[];
  /** What Casy picked up (PlanSummary). */
  summary: ReactNode;
}) {
  const t = useT();
  if (!planner.session.plan) {
    return <AiConversation planner={planner} members={members} compact />;
  }
  const conversation = (
    <AiConversation
      planner={planner}
      members={members}
      compact
      adding={adding}
      onAdding={onAdding}
    />
  );
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start gap-5">
      <div className="min-w-0">{conversation}</div>
      <div className="min-w-0">
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            {t.aiPlan.understood}
          </h3>
          {/* What the summary's sparkles mean, on the heading's own line. */}
          {planner.session.guessed.length > 0 && (
            <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
              <Sparkles aria-hidden className="h-3 w-3 text-amber-500" />
              {t.aiPlan.guessed}
            </span>
          )}
        </div>
        {summary}
      </div>
    </div>
  );
}
