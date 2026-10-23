/**
 * Accounts the iPhone app has already asked for the phone's calendar on this
 * launch (#132): once, so a refusal isn't asked again on every visit to My
 * calendar. Forgotten on sign-out, so the next person to sign in is asked, and
 * so is the same one signing in again.
 */
const askedThisLaunch = new Set<string>();

/** Whether this account was asked already; marks it asked if it was not. */
export function askedAlready(userId: string): boolean {
  const asked = askedThisLaunch.has(userId);
  askedThisLaunch.add(userId);
  return asked;
}

export function forgetAskedPhone(): void {
  askedThisLaunch.clear();
}
