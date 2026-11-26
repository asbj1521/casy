/**
 * Signing in on the app's own sign-in screen (#282). The screen is Swift; the
 * session still lives in the page (Phase 6 moves it), so each step is done
 * here, through the same Supabase calls the page's SignIn makes, and answered
 * with what happened and, if it failed, the page's own words for why
 * (authErrorMessage). A sign-in that works changes the page's login as its
 * own would, and the page goes on from there.
 */
import { isAuthError } from "@supabase/auth-js";

import { deleteMyAccount } from "@/api/account";
import { authErrorMessage } from "@/i18n/authError";
import { currentLang, currentMessages } from "@/i18n/current";
import {
  answerAppleQuestion,
  hasAppleSignIn,
  linkAppleSignIn,
  signInWithApple,
} from "@/lib/appleSignIn";
import { SITE_URL } from "@/lib/nativeApp";
import { timesLeaked } from "@/lib/passwordRules";
import { supabaseAuth } from "@/lib/supabase";
import { clearWeakPassword, flagWeakPassword } from "@/lib/weakPassword";

/** What the app's sign-in screen asks the page to do. */
export interface NativeAuthAsk {
  id: number;
  action:
    | "password"
    | "signUp"
    | "link"
    | "reset"
    | "resend"
    | "apple"
    | "appleNew"
    | "appleLeave"
    | "leaked"
    | "setPassword"
    | "resendCode"
    | "signOutEverywhere"
    | "linkApple"
    | "appleLinked";
  email?: string;
  password?: string;
  name?: string;
  /** The code emailed before a new password is saved (`setPassword`). */
  code?: string;
}

/**
 * How it went. `outcome`: "in" (signed in), "sent" (an email went),
 * "confirm" (a new account waits for its email's link), "new-account" (Apple
 * made one: ask first), "cancelled", "done", or "failed" with `error`.
 * `unconfirmed`: a password sign-in before the email was confirmed. `count`:
 * how often a password is in known leaks (null when that can't be said).
 */
export interface NativeAuthAnswer {
  outcome: "in" | "sent" | "confirm" | "new-account" | "cancelled" | "done" | "code" | "failed";
  error?: string;
  unconfirmed?: boolean;
  count?: number | null;
}

/** Where an email's link leads: casy.app's sign-in page, in the language in use (#242). */
function returnTo(): string {
  return `${SITE_URL}/sign-in?${new URLSearchParams({ lang: currentLang() })}`;
}

function failed(err: { code?: string; message: string }): NativeAuthAnswer {
  return { outcome: "failed", error: authErrorMessage(err, currentMessages()) };
}

export async function answerNativeAuth(ask: NativeAuthAsk): Promise<NativeAuthAnswer> {
  const t = currentMessages();
  const email = ask.email?.trim() ?? "";
  switch (ask.action) {
    case "password": {
      const { data, error } = await supabaseAuth.signInWithPassword({
        email,
        password: ask.password ?? "",
      });
      if (error) return { ...failed(error), unconfirmed: error.code === "email_not_confirmed" };
      // A password chosen before today's rules is flagged, as the page's own sign-in does.
      const userId = data.user?.id;
      if (userId && data.weakPassword?.reasons?.length) flagWeakPassword(userId);
      else if (userId) {
        const typed = ask.password ?? "";
        void timesLeaked(typed).then((n) => n && flagWeakPassword(userId));
      }
      return { outcome: "in" };
    }
    case "signUp": {
      const { data, error } = await supabaseAuth.signUp({
        email,
        password: ask.password ?? "",
        options: {
          emailRedirectTo: returnTo(),
          data: { lang: currentLang(), full_name: ask.name?.trim() ?? "" },
        },
      });
      if (error) return failed(error);
      // An address with an account already: a stand-in user with no identities.
      if (data.user && data.user.identities?.length === 0) {
        return { outcome: "failed", error: t.authErrors.userExists };
      }
      return { outcome: data.session ? "in" : "confirm" };
    }
    case "link": {
      const { error } = await supabaseAuth.signInWithOtp({
        email,
        options: { emailRedirectTo: returnTo() },
      });
      return error ? failed(error) : { outcome: "sent" };
    }
    case "reset": {
      const { error } = await supabaseAuth.resetPasswordForEmail(email, {
        redirectTo: returnTo(),
      });
      return error ? failed(error) : { outcome: "sent" };
    }
    case "resend": {
      const { error } = await supabaseAuth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: returnTo() },
      });
      return error ? failed(error) : { outcome: "sent" };
    }
    case "apple": {
      try {
        const answer = await signInWithApple();
        return { outcome: answer === "signed-in" ? "in" : answer };
      } catch (err) {
        return {
          outcome: "failed",
          error: isAuthError(err) ? authErrorMessage(err, t) : t.signIn.appleFailed,
        };
      }
    }
    case "appleNew":
      answerAppleQuestion("idle");
      return { outcome: "done" };
    case "appleLeave": {
      // The empty account Apple just made goes, for the old way in (#245).
      try {
        await deleteMyAccount();
      } catch (err) {
        console.warn("Could not delete the account Apple just made", err);
      }
      await supabaseAuth.signOut({ scope: "local" });
      answerAppleQuestion("told");
      return { outcome: "done" };
    }
    case "leaked":
      return { outcome: "done", count: await timesLeaked(ask.password ?? "") };
    // Log ind og sikkerhed in the app (#202), as PasswordSection and AppleSignInRow do it.
    case "setPassword": {
      const password = ask.password ?? "";
      const { error } = await supabaseAuth.updateUser(
        ask.code ? { password, nonce: ask.code } : { password },
      );
      // Signed in over a day ago: Supabase emails a code first ("code").
      if (error?.code === "reauthentication_needed") {
        const { error: sendErr } = await supabaseAuth.reauthenticate();
        return sendErr ? failed(sendErr) : { outcome: "code" };
      }
      if (error) return failed(error);
      // Whoever else might be signed in as you is signed out; this device stays.
      await supabaseAuth.signOut({ scope: "others" });
      clearWeakPassword();
      return { outcome: "done" };
    }
    case "resendCode": {
      const { error } = await supabaseAuth.reauthenticate();
      return error ? failed(error) : { outcome: "sent" };
    }
    case "signOutEverywhere": {
      // As the page's own signOut: this phone's notifications go first (#139).
      await import("@/lib/push").then((m) => m.forgetPush()).catch(() => {});
      const { error } = await supabaseAuth.signOut({ scope: "global" });
      return error
        ? { outcome: "failed", error: t.profile.couldntSignOutEverywhere }
        : { outcome: "done" };
    }
    case "linkApple": {
      try {
        return { outcome: (await linkAppleSignIn()) === "linked" ? "done" : "cancelled" };
      } catch (err) {
        return {
          outcome: "failed",
          error: isAuthError(err) ? authErrorMessage(err, t) : t.signIn.appleFailed,
        };
      }
    }
    case "appleLinked": {
      const { data } = await supabaseAuth.getUser();
      return { outcome: "done", count: data.user && hasAppleSignIn(data.user) ? 1 : 0 };
    }
  }
}
