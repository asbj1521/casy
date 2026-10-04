/**
 * The signed-in person's own account:
 *
 * - data: everything Casy holds about them, for the profile's "Your data"
 *   (_shared/myData.ts). Credentials only by kind, never their values.
 * - export: the same, with every stored busy time, as a file to keep.
 * - delete: deletes the account and everything it owns, after the page has
 *   asked them to type a word to confirm (sent as `confirm: true`, so a stray
 *   call can't do it). See _shared/accounts.ts for what goes and what stays.
 *
 * Only ever the caller's own account: the id comes from their verified login
 * (_shared/auth.ts), never from the request.
 */
import { deleteAccount } from "../_shared/accounts.ts";
import { exportMyData, readMyData } from "../_shared/myData.ts";
import { requireCaller } from "../_shared/auth.ts";
import { HttpError, serve } from "../_shared/http.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

serve("account", async (req, body) => {
  const db = supabaseAdmin();
  const caller = await requireCaller(req, db);
  const profileId = caller.id;

  switch (body.action) {
    case "data":
      return await readMyData(db, caller);
    case "export":
      return await exportMyData(db, caller);
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
