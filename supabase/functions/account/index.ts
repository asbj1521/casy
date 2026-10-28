/**
 * The signed-in person's own account:
 *
 * - data: everything Casy holds about them, for the profile's "Your data"
 *   (_shared/myData.ts). Credentials only by kind, never their values.
 * - export: the same, with every stored busy time, as a file to keep.
 * - ai-consent: says yes (`on: true`) or takes the yes back (`on: false`) to
 *   Casy's AI using content from their calendar (#120); see _shared/aiAccess.ts.
 * - ai-share: switches the sending of their corrections of the AI to Casy for
 *   review on or off (#122), without touching the yes.
 * - corrections-delete: deletes every correction they have sent (#122).
 * - apple-token: right after a Sign in with Apple in the app (#138), its
 *   one-time `code`, kept (as a refresh token) only so the sign-in can be
 *   revoked when the account is deleted; see _shared/appleSignIn.ts.
 * - push-register: the phone's APNs `token` (#139), after the person said yes
 *   to notifications in the app, with the `lang` to write them in.
 * - push-unregister: forgets the phone's `token` (signing out).
 * - delete: deletes the account and everything it owns, after the page has
 *   asked them to type a word to confirm (sent as `confirm: true`, so a stray
 *   call can't do it). See _shared/accounts.ts for what goes and what stays.
 *
 * Only ever the caller's own account: the id comes from their verified login
 * (_shared/auth.ts), never from the request.
 */
import { deleteAccount } from "../_shared/accounts.ts";
import { setAiConsent, setAiSharing } from "../_shared/aiAccess.ts";
import { saveAppleSignIn } from "../_shared/appleSignIn.ts";
import { cleanToken, registerDevice, unregisterDevice } from "../_shared/push.ts";
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
    case "ai-consent": {
      if (typeof body.on !== "boolean") throw new HttpError(400, "on must be true or false");
      await setAiConsent(db, profileId, body.on);
      return { outcome: body.on ? "given" : "withdrawn" };
    }
    case "ai-share": {
      if (typeof body.on !== "boolean") throw new HttpError(400, "on must be true or false");
      if (!(await setAiSharing(db, profileId, body.on))) {
        throw new HttpError(400, "Say yes to the AI using your calendar first.");
      }
      return { outcome: body.on ? "sharing" : "not sharing" };
    }
    case "corrections-delete": {
      const { error } = await db.from("ai_corrections").delete().eq("profile_id", profileId);
      if (error) throw error;
      return { outcome: "deleted" };
    }
    case "apple-token": {
      if (typeof body.code !== "string" || !body.code) throw new HttpError(400, "code is required");
      await saveAppleSignIn(db, caller, body.code);
      return { outcome: "saved" };
    }
    case "push-register": {
      const lang = body.lang === "en" ? "en" : "da";
      await registerDevice(db, profileId, cleanToken(body.token), lang);
      return { outcome: "registered" };
    }
    case "push-unregister": {
      await unregisterDevice(db, profileId, cleanToken(body.token));
      return { outcome: "unregistered" };
    }
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
