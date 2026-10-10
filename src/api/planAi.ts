/**
 * Planning with AI (#100), backed by the `plan-ai` Edge Function: what the
 * person typed or said, turned into settings (src/lib/aiPlan.ts). Only the
 * text, the settings so far and the site's language are sent; names are
 * matched against the group in the browser, never sent.
 */
import { currentMessages } from "@/i18n/current";
import type { AiPlan, PlanSettings } from "@/lib/aiPlan";
import { callFunction } from "@/lib/supabaseFunctions";

export interface PlanAnswer {
  plan: AiPlan;
  /** Your AI planning calls left today (a budget per person, #111). */
  left: number;
}

/**
 * Ask for settings from a description (`current` null) or from more details
 * on the settings so far, with what was written before in `earlier`.
 */
export async function planWithAi(input: {
  text: string;
  earlier: string[];
  current: PlanSettings | null;
}): Promise<PlanAnswer> {
  return await callFunction<PlanAnswer>("plan-ai", {
    body: input,
    errorMessage: currentMessages().api.planAi,
  });
}
