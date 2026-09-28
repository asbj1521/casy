/**
 * Apple's own wording on the pages the walkthrough draws, so the drawings say
 * exactly what people will see. The Danish is copied from screenshots of
 * account.apple.com in Safari on a Mac and an iPhone (September 2026), and the
 * iOS text menu. The English is translated from those, not copied from
 * Apple's English pages; check it there before relying on it.
 */
import type { Lang } from "@/i18n/locale";
import { PERSON } from "@/components/appleWalkthrough/layout";

const da = {
  nav: ["Store", "Mac", "iPad", "iPhone", "Watch", "AirPods", "TV og hjem", "Underholdning", "Tilbehør", "Support"],
  account: "Apple-konto",
  headerLinks: ["Log ind", "Opret din Apple-konto", "Ofte stillede spørgsmål"],
  signOut: "Log ud",
  landingTitle: "Én konto til alt Apple",
  landingBody:
    "En enkelt Apple-konto og en adgangskode giver dig adgang til alle Apples tjenester. Log ind for at administrere din konto.",
  signIn: "Log ind",
  sheetText: "Log ind på din Apple-konto til account.apple.com.",
  yourAccount: "Din konto",
  otherAccount: "Brug en anden Apple-konto",
  touchId: "Fortsæt med Touch ID",
  cancel: "Annuller",
  manageAccount: "Administrer din Apple-konto",
  emailField: "E-mailadresse eller telefonnummer",
  /** The Mac sign-in form's field: that form is drawn from before a screenshot of Apple's real one (the iPhone's) existed. */
  macEmailField: "E-mail eller telefonnummer",
  passwordField: "Adgangskode",
  privacy:
    "Dine Apple-kontooplysninger bruges til at give dig mulighed for at logge sikkert ind og få adgang til dine data.",
  privacyLink: "Se, hvordan dine data administreres…",
  passkey: "Log ind med loginnøgle",
  passkeyNote: "Kræver iOS 17 eller macOS Sonoma eller nyere versioner.",
  twoFactor: "Tofaktorgodkendelse",
  security: "Login og sikkerhed",
  securityBody:
    "Administrer indstillinger, der er relateret til at logge ind på din konto, kontosikkerhed, og hvordan du gendanner dine data, når du har problemer med at logge ind.",
  menu: ["Personlige oplysninger", "Login og sikkerhed", "Betaling og levering", "Abonnementer", "Familie", "Enheder", "Anonymitet"],
  tiles: [
    ["E-mails og telefonnumre", PERSON.email, "og yderligere 1"],
    ["Adgangskode", "Sidst opdateret den 03.02.2025"],
    ["Kontosikkerhed", "Tofaktorgodkendelse", "1 pålideligt telefonnummer"],
    ["Kontogendannelse", "Ikke indstillet"],
    ["Arvekontakt", "1 kontakt"],
    ["Log ind med Apple", "12 apps og websteder"],
    ["App-specifikke adgang…", "Vis oplysninger"],
  ],
  listTitle: "App-specifikke adgangskoder",
  listBody:
    "Brug en app-specifik adgangskode til at logge ind på en app eller tjeneste, som ikke er fra Apple.",
  listLink: "Om app-specifikke adgangskoder",
  passwords: "Adgangskoder",
  generateTitle: "Generer app-specifik adgangskode",
  namePlaceholder: "f.eks. Bill Pay",
  create: "Opret",
  confirmTitle: "Bekræft din adgangskode",
  confirmBody: "Af hensyn til din sikkerhed skal du skrive adgangskoden til:",
  continue: "Fortsæt",
  revealTitle: "Din app-specifikke adgangskode er:",
  revealBody:
    "Skriv denne adgangskode i adgangskodefeltet til den app, som du vil logge ind på. Der skelnes mellem store og små bogstaver i adgangskoder.",
  ok: "OK",
  /** iOS's menu over selected text, left to right (a sparkle icon sits after the first). */
  textMenu: ["Kopier", "Slå op", "Oversæt", "Find"],
};

const en: typeof da = {
  nav: ["Store", "Mac", "iPad", "iPhone", "Watch", "AirPods", "TV & Home", "Entertainment", "Accessories", "Support"],
  account: "Apple Account",
  headerLinks: ["Sign In", "Create Your Apple Account", "FAQ"],
  signOut: "Sign Out",
  landingTitle: "One account for everything Apple",
  landingBody:
    "A single Apple Account and password gives you access to all Apple services. Sign in to manage your account.",
  signIn: "Sign In",
  sheetText: "Sign in to your Apple Account for account.apple.com.",
  yourAccount: "Your account",
  otherAccount: "Use a different Apple Account",
  touchId: "Continue with Touch ID",
  cancel: "Cancel",
  manageAccount: "Manage your Apple Account",
  emailField: "Email or Phone Number",
  macEmailField: "Email or Phone Number",
  passwordField: "Password",
  privacy: "Your Apple Account information is used to allow you to sign in securely and access your data.",
  privacyLink: "See how your data is managed…",
  passkey: "Sign in with Passkey",
  passkeyNote: "Requires iOS 17 or macOS Sonoma or later.",
  twoFactor: "Two-Factor Authentication",
  security: "Sign-In and Security",
  securityBody:
    "Manage settings related to signing in to your account, account security, and how to recover your data when you have trouble signing in.",
  menu: ["Personal Information", "Sign-In and Security", "Payment & Shipping", "Subscriptions", "Family", "Devices", "Privacy"],
  tiles: [
    ["Email & Phone Numbers", PERSON.email, "and 1 more"],
    ["Password", "Last updated 3 Feb 2025"],
    ["Account Security", "Two-Factor Authentication", "1 trusted phone number"],
    ["Account Recovery", "Not set up"],
    ["Legacy Contact", "1 contact"],
    ["Sign in with Apple", "12 apps & websites"],
    ["App-Specific Passwo…", "View details"],
  ],
  listTitle: "App-Specific Passwords",
  listBody: "Use an app-specific password to sign in to an app or service not provided by Apple.",
  listLink: "About app-specific passwords",
  passwords: "Passwords",
  generateTitle: "Generate app-specific password",
  namePlaceholder: "e.g. Bill Pay",
  create: "Create",
  confirmTitle: "Confirm your password",
  confirmBody: "For your security, enter the password for:",
  continue: "Continue",
  revealTitle: "Your app-specific password is:",
  revealBody:
    "Enter this password into the password field of the app you want to sign in to. Passwords are case sensitive.",
  ok: "OK",
  textMenu: ["Copy", "Look Up", "Translate", "Find"],
};

export type AppleWords = typeof da;

export const APPLE_WORDS: Record<Lang, AppleWords> = { da, en };

/** The example password the drawings show; never a real one. */
export const EXAMPLE_PASSWORD = ["abcd", "efgh", "ijkl", "mnop"];
