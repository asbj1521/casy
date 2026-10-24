/**
 * The signed-in caller's linked calendar accounts: each one's state, sync
 * health, calendars and how many busy blocks it holds.
 *
 * The profile page calls this on every load (not just right after an OAuth
 * redirect) so "connected" is a real, persistent fact backed by the
 * database, not something that only shows up once in a banner and vanishes
 * on refresh. Only ever non-secret fields: calendar_secrets is never touched.
 */
import { requireCaller } from "../_shared/auth.ts";
import { calendarStatus } from "../_shared/calendarStatus.ts";
import { serve } from "../_shared/http.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

serve(
  "calendar-status",
  async (req) => {
    const db = supabaseAdmin();
    const { id: profileId } = await requireCaller(req, db);
    return { connections: await calendarStatus(db, profileId) };
  },
  "GET",
);
