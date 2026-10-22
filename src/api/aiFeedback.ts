/**
 * Learning from use (#122), backed by the `ai-feedback` Edge Function: a
 * correction of the AI sent to Casy for the project owner to review. Only for
 * those who said yes to the AI using their calendar and haven't switched
 * sharing off; the server refuses everyone else. Never worth failing what the
 * person was doing over: callers send it in the background.
 *
 * The shape mirrors supabase/functions/_shared/feedback.ts.
 */
import type { EventLabel } from "@/api/eventLabels";
import type { PlanFeedback } from "@/lib/aiPlan";
import { currentMessages } from "@/i18n/current";
import { callFunction } from "@/lib/supabaseFunctions";

/** What a "Forkert?" correction sends: the event as the AI saw it, and the two labels. */
export interface LabelCorrectionData {
  title: string;
  calendar: string;
  previous: EventLabel;
  note: string;
  label: EventLabel;
}

export async function sendLabelCorrection(data: LabelCorrectionData): Promise<void> {
  await callFunction("ai-feedback", {
    body: { kind: "label", data },
    errorMessage: currentMessages().aiConsent.failed,
  });
}

/** A plan Planlæg med AI made, and what became of it, sent when it goes to the group. */
export async function sendPlanFeedback(data: PlanFeedback): Promise<void> {
  await callFunction("ai-feedback", {
    body: { kind: "plan", data },
    errorMessage: currentMessages().aiConsent.failed,
  });
}
