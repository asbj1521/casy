import { isNativeApp } from "@/lib/nativeApp";

/**
 * Who sees the app's ad instead of the website (#270): everyone but a phone
 * and the app itself. The app is for the iPhone, and the phone website stays
 * for friends with Android; a computer, a tablet or a computer's narrow window
 * gets one page that shows the joke and a QR code to the app.
 *
 * Decided by the device, not the window: a phone is a touch screen whose short
 * side is under 600 px, so a phone turned sideways stays a phone and a narrow
 * computer window does not become one. Read once at load, since a device
 * doesn't change.
 */
function isPhone(): boolean {
  if (typeof window.matchMedia !== "function") return false;
  const touch = window.matchMedia("(pointer: coarse)").matches;
  return touch && Math.min(window.screen.width, window.screen.height) < 600;
}

/**
 * The browser tests' computer keeps the old computer website, until its pages
 * are deleted (#273): `e2e/fixtures.ts` sets this before the page loads, and
 * the ad's own tests leave it off.
 */
const keepsComputerSite =
  (window as unknown as { __casyComputerSite?: boolean }).__casyComputerSite === true;

export const showsComputerAd = !isNativeApp && !isPhone() && !keepsComputerSite;

/**
 * Whether this page was opened from an email's link (confirm the address, a
 * new password, a new email): read at load, before Supabase takes the login
 * out of the address. Those must still work on a computer, where most people
 * read their email, so sign-in shows them instead of the ad.
 */
export const openedFromAuthEmail =
  /(access_token|error_description|type=(recovery|signup|magiclink|email_change|invite))/.test(
    window.location.hash,
  ) || /[?&](code|token_hash|error)=/.test(window.location.search);
