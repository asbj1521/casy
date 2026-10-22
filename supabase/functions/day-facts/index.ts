/**
 * What the iPhone app tells Casy about its owner's important events, for
 * ranking a vote's dates (#119): per event only when it starts, how important
 * it is, what to keep clear of the night before and the days it needs to
 * prepare. No title, no kind, no reason (the labels stay on the phone).
 *
 * POST { facts: DayFact[] } -> { stored }
 *
 * Replaces the person's facts as a whole, so what the phone no longer lists is
 * gone at once; an empty list clears them. Only for people who said yes to
 * Casy's AI using their calendar, under today's wording (#120), and admins and
 * AI testers while it is tested (aiContentAllowed). See _shared/dayScores.ts.
 */
import { aiContentAllowed, CONTENT_NOT_ALLOWED } from "../_shared/aiAccess.ts";
import { requireCaller } from "../_shared/auth.ts";
import { readFacts } from "../_shared/dayScores.ts";
import { HttpError, serve } from "../_shared/http.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

serve("day-facts", async (req, body) => {
  const db = supabaseAdmin();
  const caller = await requireCaller(req, db);
  if (!(await aiContentAllowed(db, caller.id))) throw new HttpError(403, CONTENT_NOT_ALLOWED);

  const facts = readFacts(body.facts);
  if (!facts) throw new HttpError(400, "facts must be a list of at most 400 events");

  const { data, error } = await db.rpc("replace_ai_day_facts", {
    p_profile_id: caller.id,
    p_facts: facts,
  });
  if (error) throw error;
  return { stored: data as number };
});
