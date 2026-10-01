/**
 * The signed-in person's own account. One action so far:
 *
 * - delete: deletes the account and everything it owns, after the page has
 *   asked them to type a word to confirm (sent as `confirm: true`, so a stray
 *   call can't do it). See _shared/accounts.ts for what goes and what stays.
 *
 * Only ever the caller's own account: the id comes from their verified login
 * (_shared/auth.ts), never from the request.
 */
import { deleteAccount } from "../_shared/accounts.ts";
import { requireCaller } from "../_shared/auth.ts";
import { HttpError, serve } from "../_shared/http.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

serve("account", async (req, body) => {
  const db = supabaseAdmin();
  const { id: profileId } = await requireCaller(req, db);

  switch (body.action) {
    case "delete": {
      if (body.confirm !== true) throw new HttpError(400, "confirm must be true");
      const { leftGroups, deletedGroups } = await deleteAccount(db, profileId);
      console.log(
        `account ${profileId} deleted itself; left ${leftGroups} groups, ${deletedGroups} deleted`,
      );
      return { outcome: "deleted" };
    }
    default:
      throw new HttpError(400, "Unknown action");
  }
});
