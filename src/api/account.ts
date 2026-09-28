/**
 * The signed-in person's own account, backed by the `account` Edge Function.
 * The function learns whose account from the login token, never from here.
 */
import { currentMessages } from "@/i18n/current";
import { callFunction } from "@/lib/supabaseFunctions";

/**
 * Delete your account and everything it owns (see supabase/functions/
 * _shared/accounts.ts). The page asks for a typed confirmation first;
 * `confirm: true` is the server's own guard against a stray call.
 */
export async function deleteMyAccount(): Promise<void> {
  await callFunction("account", {
    body: { action: "delete", confirm: true },
    errorMessage: currentMessages().api.deleteAccount,
  });
}
