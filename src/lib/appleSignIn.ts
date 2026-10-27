/**
 * Sign in with Apple (#138), in the iPhone app only, through the app's own
 * plugin (AppleSignInPlugin.swift): iOS's sheet hands back an identity token,
 * which Supabase Auth checks with Apple and turns into a session. The website
 * has no Apple button (its flow needs a secret that expires every six months).
 *
 * Two things follow the sign-in, neither of which may stop it:
 * - Apple sends the person's name only the first time, so it is saved then
 *   (`full_name`, what groups call them by, see displayNameFor).
 * - The one-time code goes to Casy's server, which keeps what it needs to
 *   revoke the sign-in when the account is deleted. Every sign-in sends a
 *   new one, so a miss is made good the next time.
 *
 * As in phoneCalendar.ts, @capacitor/core loads on first use and only the
 * module goes through promises, never the plugin itself.
 */
import { saveAppleSignIn } from "@/api/account";
import { supabaseAuth } from "@/lib/supabase";

type SheetResult =
  | { cancelled: true }
  | {
      cancelled?: false;
      identityToken: string;
      authorizationCode: string;
      nonce: string;
      givenName: string;
      familyName: string;
    };

interface AppleSignInPlugin {
  signIn(): Promise<SheetResult>;
}

let plugin: AppleSignInPlugin | null = null;

async function appleSignInPlugin(): Promise<{ plugin: AppleSignInPlugin }> {
  if (!plugin) {
    const { registerPlugin } = await import("@capacitor/core");
    plugin = registerPlugin<AppleSignInPlugin>("AppleSignIn");
  }
  // Wrapped: resolving a promise with the plugin itself would never settle.
  return { plugin };
}

/** The name Apple gave, as one line; empty when it gave none. */
function appleFullName(givenName: string, familyName: string): string {
  return [givenName, familyName]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");
}

/**
 * Sign in with Apple. "cancelled" when the person closed the sheet; throws
 * when the sheet or Supabase Auth fails (an auth error is Supabase's own, so
 * the page can translate it).
 */
export async function signInWithApple(captchaToken?: string): Promise<"signed-in" | "cancelled"> {
  const { plugin } = await appleSignInPlugin();
  const sheet = await plugin.signIn();
  if (sheet.cancelled) return "cancelled";

  const { error } = await supabaseAuth.signInWithIdToken({
    provider: "apple",
    token: sheet.identityToken,
    nonce: sheet.nonce,
    options: { captchaToken },
  });
  if (error) throw error;

  const name = appleFullName(sheet.givenName, sheet.familyName);
  if (name) {
    const { error: nameError } = await supabaseAuth.updateUser({ data: { full_name: name } });
    if (nameError) console.warn("Could not save the name from Apple", nameError);
  }
  try {
    await saveAppleSignIn(sheet.authorizationCode);
  } catch (err) {
    console.warn("Could not keep the Apple sign-in for revoking", err);
  }
  return "signed-in";
}
