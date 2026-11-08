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
import type { User } from "@supabase/auth-js";

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
 * Where a sign-in with Apple has got to (#245), kept outside the page: in the
 * app the sign-in page is drawn afresh the moment someone is signed in (and
 * again when they are signed out), so what it is about to ask, or has just
 * said, lives here. "signing": Supabase has the token; "ask": it made a new
 * account, so the page asks whether they had one; "told": they had, the empty
 * one is gone, and the page says how to come in.
 */
type AppleStage = "idle" | "signing" | "ask" | "told";
let stage: AppleStage = "idle";
const stageChanges = new Set<() => void>();
function setStage(next: AppleStage) {
  stage = next;
  stageChanges.forEach((change) => change());
}
export const appleStage = (): AppleStage => stage;
export function onAppleStage(change: () => void): () => void {
  stageChanges.add(change);
  return () => {
    stageChanges.delete(change);
  };
}
/** The question answered: "new" goes on, "told" when the empty account was let go. */
export function answerAppleQuestion(next: "idle" | "told"): void {
  setStage(next);
}

/** How long ago an account may have been made and still be the one this sign-in made. */
const JUST_MADE_MS = 2 * 60_000;

/**
 * Whether this sign-in has just made the account (#245): new, and Apple its
 * only way in. Someone who used Casy with Google or email before, under an
 * address Apple doesn't share (Hide My Email, iCloud), lands here too, in an
 * empty second account, so the sign-in page asks before going on.
 */
export function isNewAppleAccount(user: User, now: number): boolean {
  const providers = user.identities?.map((i) => i.provider) ?? [];
  return (
    now - Date.parse(user.created_at) < JUST_MADE_MS &&
    providers.length > 0 &&
    providers.every((p) => p === "apple")
  );
}

/** Whether Apple is one of the ways into this account (#245). */
export function hasAppleSignIn(user: User): boolean {
  return !!user.identities?.some((i) => i.provider === "apple");
}

/**
 * Sign in with Apple. "new-account" when it has just made the account
 * (isNewAppleAccount); "cancelled" when the person closed the sheet; throws
 * when the sheet or Supabase Auth fails (an auth error is Supabase's own, so
 * the page can translate it).
 */
export async function signInWithApple(): Promise<"signed-in" | "new-account" | "cancelled"> {
  const { plugin } = await appleSignInPlugin();
  const sheet = await plugin.signIn();
  if (sheet.cancelled) return "cancelled";

  setStage("signing");
  const { data, error } = await supabaseAuth.signInWithIdToken({
    provider: "apple",
    token: sheet.identityToken,
    nonce: sheet.nonce,
  });
  if (error) {
    setStage("idle");
    throw error;
  }
  const isNew = !!data.user && isNewAppleAccount(data.user, Date.now());
  setStage(isNew ? "ask" : "idle");

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
  return isNew ? "new-account" : "signed-in";
}

/**
 * Apple as a second way into the account signed in now (#245), so a later
 * sign-in with Apple leads here whatever address Apple gives. Needs manual
 * linking on in Supabase Auth. Throws Supabase's own error, such as an Apple
 * ID that is already another account's way in.
 */
export async function linkAppleSignIn(): Promise<"linked" | "cancelled"> {
  const { plugin } = await appleSignInPlugin();
  const sheet = await plugin.signIn();
  if (sheet.cancelled) return "cancelled";
  const { error } = await supabaseAuth.linkIdentity({
    provider: "apple",
    token: sheet.identityToken,
    nonce: sheet.nonce,
  });
  if (error) throw error;
  try {
    await saveAppleSignIn(sheet.authorizationCode);
  } catch (err) {
    console.warn("Could not keep the Apple sign-in for revoking", err);
  }
  return "linked";
}
