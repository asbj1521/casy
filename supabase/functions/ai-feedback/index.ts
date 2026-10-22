/**
 * Learning from use (#122): a correction of the AI, sent for the project
 * owner to review, so what it gets wrong for everyone becomes a sharper
 * prompt and a new eval case. Nothing trains a model.
 *
 * POST { kind: "label", data: { title, calendar, previous, note, label } } -> { stored }
 *
 * Only for people who said yes to the AI using their calendar under today's
 * wording and haven't switched sharing off in Your data (aiSharesCorrections).
 * Admin mode lists what arrives without ever saying whose it is; the person
 * sees and deletes theirs in Your data. See _shared/feedback.ts.
 */
import { aiSharesCorrections } from "../_shared/aiAccess.ts";
import { requireCaller } from "../_shared/auth.ts";
import { MAX_FEEDBACK_IN_ALL, MAX_FEEDBACK_PER_DAY, readFeedback } from "../_shared/feedback.ts";
import { HttpError, serve } from "../_shared/http.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

serve("ai-feedback", async (req, body) => {
  const db = supabaseAdmin();
  const caller = await requireCaller(req, db);
  if (!(await aiSharesCorrections(db, caller.id))) {
    throw new HttpError(403, "Sending corrections to Casy is switched off for your account.");
  }

  const feedback = readFeedback(body);
  if (!feedback) throw new HttpError(400, "That correction isn't valid.");

  // A ceiling per day and in all: a loop in a page must never fill the table.
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
  const [today, all] = await Promise.all([
    db
      .from("ai_corrections")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", caller.id)
      .gte("created_at", dayAgo),
    db
      .from("ai_corrections")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", caller.id),
  ]);
  if (today.error) throw today.error;
  if (all.error) throw all.error;
  if ((today.count ?? 0) >= MAX_FEEDBACK_PER_DAY || (all.count ?? 0) >= MAX_FEEDBACK_IN_ALL) {
    throw new HttpError(429, "You have sent as many corrections as you can for now.");
  }

  const { error } = await db
    .from("ai_corrections")
    .insert({ profile_id: caller.id, kind: feedback.kind, data: feedback.data });
  if (error) throw error;
  return { stored: true };
});
