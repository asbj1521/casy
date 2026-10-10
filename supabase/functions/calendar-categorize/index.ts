/**
 * Sorting calendars with AI (#118): gives each of the caller's calendars that
 * nobody has categorised yet a category, guessed by Claude Haiku from its
 * name (see _shared/categorizeAi.ts). The page calls it in the background
 * whenever it sees such calendars (useAutoCategorize), so a newly connected
 * account is sorted without anyone asking.
 *
 * POST { titles?: { [calendarId]: string[] } } -> { categorized: [{ calendarId, purpose }] }
 *
 * Never overrides a choice: only calendars with no category and no record of
 * who set one are asked about, and each guess is written only if that is
 * still so (a category picked meanwhile wins). A guess sets purpose_source
 * 'ai', an "unsure" too (with no category), so no calendar is asked about
 * twice; picking or clearing one by hand makes it 'user' for good.
 *
 * Sample event titles are only used for the admin's own calendars while this
 * is tested (#120 decides it for everyone); anyone else's are ignored. Takes
 * one of the day's AI calls when there is something to sort.
 */
import Anthropic from "npm:@anthropic-ai/sdk@0.132.1";

import { isAdminId } from "../_shared/admin.ts";
import { requireCaller } from "../_shared/auth.ts";
import {
  buildCategorizeMessage,
  CATEGORIZE_MODEL,
  CATEGORIZE_SCHEMA,
  CATEGORIZE_SYSTEM_PROMPT,
  categoriesFromAnswer,
  MAX_CALENDARS,
  readTitles,
  type CalendarToSort,
} from "../_shared/categorizeAi.ts";
import { requireEnv } from "../_shared/env.ts";
import { HttpError, serve } from "../_shared/http.ts";
import { DAILY_AI_CALLS } from "../_shared/planAi.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

interface SourceRow {
  id: string;
  display_name: string | null;
  custom_name: string | null;
  calendar_connections: { provider: string };
}

serve("calendar-categorize", async (req, body) => {
  const db = supabaseAdmin();
  const caller = await requireCaller(req, db);

  const { data, error } = await db
    .from("calendar_sources")
    .select("id, display_name, custom_name, calendar_connections!inner(provider)")
    .eq("calendar_connections.profile_id", caller.id)
    .eq("calendar_connections.status", "connected")
    .is("purpose", null)
    .is("purpose_source", null)
    .order("created_at", { ascending: true })
    .limit(MAX_CALENDARS);
  if (error) throw error;
  // `!inner` on a to-one join returns one connection, not an array (as in calendar-busy).
  const rows = (data ?? []) as unknown as SourceRow[];
  if (rows.length === 0) return { categorized: [] };

  const titles = isAdminId(caller.id, Deno.env.get("ADMIN_USER_IDS"))
    ? readTitles(body.titles, new Set(rows.map((r) => r.id)))
    : new Map<string, string[]>();
  const calendars: CalendarToSort[] = rows.map((r) => ({
    id: r.id,
    name: r.custom_name ?? r.display_name ?? "",
    provider: r.calendar_connections.provider,
    titles: titles.get(r.id) ?? [],
  }));

  const { data: callId, error: claimError } = await db.rpc("claim_ai_call", {
    p_daily_limit: DAILY_AI_CALLS,
  });
  if (claimError) throw claimError;
  if (callId === null) throw new HttpError(429, "AI is used up for today.");

  const client = new Anthropic({
    apiKey: requireEnv("ANTHROPIC_API_KEY"),
    // Nobody is waiting on it: the page sorts in the background.
    maxRetries: 2,
    timeout: 30_000,
  });
  let answer: Anthropic.Message;
  try {
    answer = await client.messages.create({
      model: CATEGORIZE_MODEL,
      max_tokens: 4000,
      output_config: {
        effort: "low",
        format: { type: "json_schema", schema: CATEGORIZE_SCHEMA },
      },
      system: CATEGORIZE_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildCategorizeMessage(calendars) }],
    });
  } catch (err) {
    console.error("calendar-categorize: Anthropic call failed", err);
    throw new HttpError(503, "Sorting calendars isn't available right now.");
  }

  const { error: usageError } = await db
    .from("ai_calls")
    .update({
      input_tokens: answer.usage.input_tokens,
      output_tokens: answer.usage.output_tokens,
    })
    .eq("id", callId);
  if (usageError) console.error("calendar-categorize: couldn't record usage", usageError);

  const text = answer.content.find((block) => block.type === "text")?.text;
  const categories = categoriesFromAnswer(
    answer.stop_reason,
    text,
    calendars.map((c) => c.id),
  );
  if (!categories) {
    console.warn(`calendar-categorize: no answer (stop_reason ${answer.stop_reason})`);
    throw new HttpError(502, "Sorting calendars didn't work this time.");
  }

  // One update per calendar, each only if nobody has set it meanwhile.
  const categorized: { calendarId: string; purpose: string | null }[] = [];
  for (const [calendarId, purpose] of categories) {
    const { data: written, error: writeError } = await db
      .from("calendar_sources")
      .update({ purpose, purpose_source: "ai" })
      .eq("id", calendarId)
      .is("purpose", null)
      .is("purpose_source", null)
      .select("id");
    if (writeError) throw writeError;
    if (written && written.length > 0) categorized.push({ calendarId, purpose });
  }
  return { categorized };
});
