import type { Messages } from "@/i18n/da";

/**
 * Supabase Auth answers in English. The errors people actually run into are
 * matched by their code and said in the page's language; anything else is
 * shown as Supabase wrote it, since a real reason beats a vague one.
 */
export function authErrorMessage(err: { code?: string; message: string }, t: Messages): string {
  switch (err.code) {
    case "invalid_credentials":
      return t.authErrors.invalidCredentials;
    case "weak_password":
      return t.authErrors.weakPassword;
    case "same_password":
      return t.authErrors.samePassword;
    case "reauthentication_not_valid":
      return t.authErrors.codeInvalid;
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return t.authErrors.rateLimit;
    case "email_not_confirmed":
      return t.authErrors.emailNotConfirmed;
    case "user_already_exists":
    case "email_exists":
      return t.authErrors.userExists;
    // Adding Apple to an account (#245): it is someone else's way in already,
    // or linking is switched off in Supabase Auth.
    case "identity_already_exists":
      return t.authErrors.appleTaken;
    case "manual_linking_disabled":
      return t.authErrors.linkingOff;
    default:
      return err.message;
  }
}
