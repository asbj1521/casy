/**
 * Danish for the errors people actually see.
 *
 * The site sends `?lang=da` or `?lang=en` with every call (src/lib/
 * supabaseFunctions.ts). Functions keep writing their errors in English, and
 * http.ts translates each one as it answers when Danish was asked for.
 * Messages meant for developers ("groupId is required") are left out on
 * purpose and pass through in English, as does anything not listed here. A
 * caller that sends no `lang` (the hourly cron, an older copy of the site)
 * gets English.
 *
 * The keys must match the English text word for word: i18n_test.ts fails if
 * one no longer appears anywhere in the functions or migrations, so a
 * reworded message can't quietly lose its translation.
 */

export type Lang = "da" | "en";

export function langOf(req: Request): Lang {
  return new URL(req.url).searchParams.get("lang") === "da" ? "da" : "en";
}

export const DANISH: Record<string, string> = {
  // Sign-in and access
  "Please sign in again.": "Log ind igen.",
  "Admins only.": "Kun for administratorer.",
  "Not allowed": "Ikke tilladt",
  "Something went wrong. Please try again.": "Noget gik galt. Prøv igen.",

  // Groups and invites
  "You are not in that group.": "Du er ikke med i den gruppe.",
  "They are not in that group.": "Personen er ikke med i den gruppe.",
  "That group no longer exists.": "Gruppen findes ikke længere.",
  "Give the group a name.": "Giv gruppen et navn.",
  "Give yourself a name.": "Giv dig selv et navn.",
  "Only the person who made this group can delete it.":
    "Kun den, der lavede gruppen, kan slette den.",
  "That invite link is not valid.": "Invitationslinket er ikke gyldigt.",
  "That invite link has expired. Ask for a new one.":
    "Invitationslinket er udløbet. Bed om et nyt.",
  "This group is full (20 members).": "Gruppen er fuld (20 medlemmer).",
  "You are already in 20 groups, which is the limit.":
    "Du er allerede med i 20 grupper, som er grænsen.",

  // Suggested events
  "That event no longer exists.": "Aftalen findes ikke længere.",
  "Give the event a name.": "Giv aftalen et navn.",
  "Those event settings aren't valid.": "Aftalens indstillinger er ikke gyldige.",
  "You weren't asked about that event.": "Du blev ikke spurgt om den aftale.",
  "That event is no longer waiting for answers.": "Aftalen venter ikke længere på svar.",
  "That date isn't valid any more. Search again.": "Den dato er ikke gyldig længere. Søg igen.",
  "The replacement date isn't valid.": "Den nye dato er ikke gyldig.",
  "The replacement date must be after the declined one.":
    "Den nye dato skal ligge efter den, der blev afslået.",
  "Someone else answered first and the date changed. Have a look at the new one.":
    "En anden svarede først, og datoen er ændret. Se den nye.",
  "Only the person who suggested this event can cancel it.":
    "Kun den, der foreslog aftalen, kan aflyse den.",
  "You suggested this event, so cancel it instead.": "Du foreslog aftalen, så aflys den i stedet.",
  "That event is no longer going ahead.": "Aftalen bliver ikke til noget længere.",
  "This group already has 20 events waiting for answers.":
    "Gruppen har allerede 20 aftaler, der venter på svar.",
  "Only upcoming events everyone has accepted can be added.":
    "Kun kommende aftaler, som alle har sagt ja til, kan tilføjes.",

  // Accounts and admin
  "That account no longer exists.": "Kontoen findes ikke længere.",
  "That account isn't connected.": "Den konto er ikke forbundet.",
  "You can't delete your own account from admin mode.":
    "Du kan ikke slette din egen konto fra admin-tilstand.",

  // Calendars
  "Connection not found": "Forbindelsen blev ikke fundet",
  "Calendar not found": "Kalenderen blev ikke fundet",
  "Keep the name to 60 characters.": "Navnet må højst være 60 tegn.",
  "Casy can't add events to that calendar.": "Casy kan ikke lægge aftaler i den kalender.",
  "Choose a primary calendar first.": "Vælg en primær kalender først.",

  // iCloud
  "Enter your iCloud email and your app-specific password.":
    "Skriv din iCloud-e-mail og din app-specifikke adgangskode.",
  "Apple rejected that email or password. Use an app-specific password (not your Apple ID password) with the Apple ID email it belongs to.":
    "Apple afviste den e-mail eller adgangskode. Brug en app-specifik adgangskode (ikke din Apple-id-adgangskode) sammen med det Apple-id, den hører til.",
  "That iCloud account has no calendars we can read.":
    "Den iCloud-konto har ingen kalendere, vi kan læse.",
  "Couldn't reach iCloud (network error or timeout).":
    "Kunne ikke nå iCloud (netværksfejl eller timeout).",
  "iCloud redirected too many times.": "iCloud viderestillede for mange gange.",
  "iCloud sent back more data than we accept.": "iCloud sendte flere data, end vi tager imod.",
  "iCloud sent a response we couldn't read.": "iCloud sendte et svar, vi ikke kunne læse.",
  "Couldn't find your iCloud calendar account.": "Kunne ikke finde din iCloud-kalenderkonto.",
  "Couldn't find your iCloud calendars.": "Kunne ikke finde dine iCloud-kalendere.",
  "Apple returned an address we couldn't read.": "Apple sendte en adresse, vi ikke kunne læse.",
  "Apple pointed us at an unexpected server, so we stopped.":
    "Apple sendte os til en uventet server, så vi stoppede.",
  "iCloud didn't let Casy add events to that calendar.":
    "iCloud lod ikke Casy lægge aftaler i den kalender.",
  "iCloud didn't let Casy remove the event.": "iCloud lod ikke Casy fjerne aftalen.",
  "That calendar is no longer in the iCloud account.":
    "Den kalender findes ikke længere på iCloud-kontoen.",
  "Reconnect your iCloud account on your profile.": "Forbind din iCloud-konto igen på din profil.",
  "Couldn't reach iCloud. Casy will try again within the hour.":
    "Kunne ikke nå iCloud. Casy prøver igen inden for en time.",

  // Calendar links
  "That doesn't look like a valid link.": "Det ligner ikke et gyldigt link.",
  "That link doesn't look like a calendar feed (no VCALENDAR found).":
    "Det link ligner ikke en kalender (der er ingen VCALENDAR).",
  "Couldn't read that calendar feed. Is it a valid .ics link?":
    "Kunne ikke læse kalenderen. Er det et gyldigt .ics-link?",
  "That feed has too many events to import.":
    "Kalenderen har for mange aftaler til at blive hentet.",
  "Only https:// (or webcal://) links are supported.": "Kun https://- og webcal://-links virker.",
  "Links with a username or password in them aren't supported.":
    "Links med et brugernavn eller en adgangskode i virker ikke.",
  "Links on non-standard ports aren't supported.":
    "Links på andre porte end standarden virker ikke.",
  "That link points at a private or internal address.":
    "Linket peger på en privat eller intern adresse.",
  "Couldn't reach that link (network error or timeout).":
    "Kunne ikke nå linket (netværksfejl eller timeout).",
  "That link redirects too many times.": "Linket viderestiller for mange gange.",
  "That feed is larger than 5 MB.": "Kalenderen fylder mere end 5 MB.",
};

/** Messages with a number or name in them, matched by shape. */
export const DANISH_PATTERNS: [RegExp, (...groups: string[]) => string][] = [
  [/^That link responded with HTTP (\d+)\.$/, (status) => `Linket svarede med HTTP ${status}.`],
  [/^iCloud responded with HTTP (\d+)\.$/, (status) => `iCloud svarede med HTTP ${status}.`],
  [
    /^This feed uses the time zone "(.+)" without defining it, so event times can't be placed reliably\.$/,
    (zone) =>
      `Kalenderen bruger tidszonen "${zone}" uden at definere den, så tidspunkterne kan ikke placeres sikkert.`,
  ],
];

export function translateError(message: string, lang: Lang): string {
  if (lang === "en") return message;
  const exact = DANISH[message];
  if (exact) return exact;
  for (const [pattern, render] of DANISH_PATTERNS) {
    const match = message.match(pattern);
    if (match) return render(...match.slice(1));
  }
  return message;
}
