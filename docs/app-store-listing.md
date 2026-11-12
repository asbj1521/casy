# App Store listing (#146)

The texts for Casy's App Store page, in both languages, ready to paste into App
Store Connect. Danish is the app's main language (set it as the primary
localization), English the second. No emojis and no long dashes, as everywhere
on Casy. Limits are Apple's: name 30, subtitle 30, promotional text 170,
keywords 100 (comma separated, no spaces after the commas), description 4000.

Written to be true to what v1 does today (the data paragraph follows the
calendar permission text and the privacy policy: change all three together). Google and Outlook calendars are not mentioned: in
the app they come in through the phone's own calendars.

## Basics

| Field | Value |
|---|---|
| Bundle id | app.casy |
| Devices | iPhone only (`TARGETED_DEVICE_FAMILY = 1`, #147), so no iPad screenshots |
| Version | 1.0.1, the same as the build; App Store Connect's version field must read this, not 1.0 |
| Primary category | Productivity |
| Secondary category | Lifestyle |
| Price | Free |
| Copyright | 2026 Asbjørn Morris Bay |
| Support URL | https://casy.app/support (Hjælp og kontakt, public, both languages) |
| Marketing URL | https://casy.app |
| Privacy policy URL | https://casy.app/privacy |
| Age rating | 4+, as Apple worked it out from the questionnaire on 2026-11-04 (answered truthfully: user generated content yes, no messaging or chat, no advertising, violence, mature or gambling content, web browsing or purchases; no override). Answer it again the same way if the app changes what people can share. |

Support URL: /support is built (#146) and linked from the profile's help list
("Hjælp og kontakt"); it opens signed out, in Danish or English.

Name: Apple requires it to be unique on the whole store, and says so when the
app record is made. Try them in this order, in the language of the listing:

1. Danish: "Casy: Find en dato", English: "Casy: Find a Date" (below)
2. What Casy stands for: "Casy: Calendar Syncing" (22) in English,
   "Casy: Kalender Sync" (19) in Danish
3. "Casy: Sync Your Calendar" (24) in English, "Casy: Synk din kalender" (23)
   in Danish

Calendar syncing says more about the idea than the app does (it finds dates, it
doesn't copy calendars between apps), so the subtitle, "Find the day everyone
can", is what keeps the page honest; keep it whichever name wins.

## Being found in App Store search (#256, for 1.0.3)

What is live with 1.0.2 (checked 12 Nov 2026): the name is "Casy" alone, the
subtitle "Find a Date", the Danish App Store shows the English page, and Casy
has one rating. Searching "Casy" on a phone in Denmark, with nothing
autocorrected, shows Casy last or not at all, even with the subtitle added.

Why: Apple ranks a new app with almost no downloads or ratings below
everything else, and a one-word name gives it the least to match (the name is
the strongest field, then the subtitle, then the hidden keywords). The Danish
App Store reads the Danish page and the English (U.K.) one, so an English
(U.S.) page alone may not be searched there at all.

What to change, all at once with 1.0.3 (the name, subtitle and keywords can
only change with a new version):

1. **Name** "Casy: Find en dato" (Danish) and "Casy: Find a Date" (English):
   more words to match, the brand still first.
2. **Danish as the primary language**, with the Danish page below filled in, so
   Danes see and are searched in Danish.
3. **An English (U.K.) page** as well as English (U.S.), the same English texts,
   so the Danish App Store also searches the English words.
4. **Keywords** without the words already in the name (Apple counts them once):
   the ones under each language below.
5. **Ratings**: the app asks for one (1.0.3, `lib/appReview.ts`, iOS's own
   sheet) after a date is agreed, at most every four months. Ask friends to
   rate it too: every rating counts most while the app is new.
6. **Optional, costs money**: Apple Ads (ads.apple.com) on the word "casy" in
   Denmark puts Casy first for its own name at once, while the rest builds up.

### In App Store Connect, step by step

1. https://appstoreconnect.apple.com/apps, Casy, then the new version (1.0.3,
   "+" next to iOS App if it isn't there yet).
2. **App Information** (left menu), **Localizable Information**: at the top
   right, switch the language to **Danish**; if it isn't listed, add it with
   the language menu's "+". Fill in the Danish name and subtitle below. Then
   set **Primary Language** (General Information) to **Danish**.
3. Still in App Information, add **English (U.K.)** the same way, with the
   English name and subtitle.
4. In the 1.0.3 version page, for each language (Danish, English (U.K.),
   English (U.S.)): the promotional text, description and keywords below,
   and the same screenshots.
5. Submit 1.0.3 with the build from `npm run release:ios`.

## Danish (primary)

**Name** (30): Casy: Find en dato

**Subtitle** (30): Find dagen, hvor alle kan

**Promotional text** (170):
Lav en gruppe, læg jeres kalendere oven på hinanden, og lad Casy finde de datoer, der passer alle. Swipe ja eller nej, og aftalen lander i alles kalender.

**Keywords** (100, from 1.0.3: no word from the name):
kalender,planlægning,gruppe,venner,aftale,møde,fælles,ledig,invitation,afstemning,tidspunkt,weekend

**Description** (4000):

Hvornår kan I alle sammen? Casy finder den første dag, hvor alle kan, så I slipper for at skrive frem og tilbage i gruppechatten.

Sådan virker det
1. Lav en gruppe, og inviter dine venner fra dine kontakter, med et link eller med en QR-kode.
2. Alle lader Casy se, hvornår de er optaget, i de kalendere, der allerede ligger på telefonen.
3. Du beskriver, hvad I skal: en aften, en weekend eller en hel ferie. Casy lægger alles kalendere oven på hinanden og viser de datoer, der passer alle.
4. Datoerne sendes til gruppen, og vennerne swiper ja eller nej. Casy vælger den dato, ingen har sagt nej til.
5. Når aftalen er landet, lægger Casy den i din kalender.

Det kan Casy
- Finde den første dato, hvor alle kan, for et møde, en weekend eller en tur.
- Vise måneden dag for dag, så du ser, hvor der er plads.
- Lade gruppen stemme ved at swipe, ligesom du kender det: ja til højre, nej til venstre, og op for "helst ikke".
- Tage hensyn til, hvem der er med, hvem der gerne må være med, og hvor mange der mindst skal kunne.
- Planlægge med AI: skriv eller sig, hvad I vil, og Casy sætter det op for dig.
- Sortere dine kalendere, forstå hvad dine aftaler betyder, og finde dine rejser med AI. Det hele er valgfrit: AI'en gør intet, før du siger ja.
- Lægge den aftalte dato i din kalender, eller gøre det af sig selv.
- Give dig besked, når du skal stemme, og når datoen er på plads. Du vælger selv, hvad du får besked om.
- Logge dig ind med din Apple-konto, så du er i gang på et øjeblik.

Dine data
Casy sender kun, hvornår du er optaget, ikke hvad dine aftaler hedder. Navnene bliver på din telefon, medmindre du selv siger ja til Casys AI. Dine venner ser kun, at du ikke kan, og hvornår. Der er ingen reklamer og ingen sporing. Du kan se alt, Casy har om dig, hente en kopi og slette din konto i appen.

Casy er lavet i Danmark og er gratis.

## English

**Name** (30): Casy: Find a Date

**Subtitle** (30): Find the day everyone can

**Promotional text** (170):
Make a group, lay your calendars on top of each other, and let Casy find the dates that suit everyone. Swipe yes or no, and the event lands in everyone's calendar.

**Keywords** (100, from 1.0.3: no word from the name; the same for English (U.K.)):
calendar,schedule,group,friends,availability,meeting,poll,plan,free,invite,shared,weekend,when

**Description** (4000):

When can you all make it? Casy finds the first day everyone is free, so you can stop writing back and forth in the group chat.

How it works
1. Make a group and invite your friends from your contacts, with a link or with a QR code.
2. Everyone lets Casy see when they are busy, in the calendars already on their phone.
3. You describe what you are planning: an evening, a weekend or a whole holiday. Casy lays everyone's calendars on top of each other and shows the dates that suit everyone.
4. The dates go to the group, and your friends swipe yes or no. Casy picks the date nobody said no to.
5. Once the event is agreed, Casy puts it in your calendar.

What Casy can do
- Find the first date everyone can make, for a meeting, a weekend or a trip.
- Show the month day by day, so you can see where there is room.
- Let the group vote by swiping, the way you know it: yes to the right, no to the left, and up for "rather not".
- Take into account who is coming, who may come, and how many at least must be able to.
- Plan with AI: write or say what you want, and Casy sets it up for you.
- Sort your calendars, understand what your events mean and find your trips with AI. All of it is optional: the AI does nothing until you say yes.
- Add the agreed date to your calendar, or do it by itself.
- Tell you when it is your turn to vote and when the date is set. You choose what you hear about.
- Sign you in with your Apple account, so you are up and running in a moment.

Your data
Casy only sends when you are busy, not what your events are called. The names stay on your phone unless you yourself say yes to Casy's AI. Your friends only see that you can't, and when. There are no ads and no tracking. You can see everything Casy has about you, download a copy and delete your account in the app.

Casy is made in Denmark and is free.

## What's new (first version)

Danish: Casys første version.
English: The first version of Casy.

## Screenshots

6.9 inch iPhone (1320 x 2868) is required; Apple scales it for the smaller
sizes. Five to six, in light or dark but the same throughout (dark shows the
glass best). A short line over each, in the language of the listing, set in
Casy's own type, no device frame needed. In this order, which is also the order
of the welcome animation:

1. My calendar, a month with busy time: "Din kalender, som den er"
2. Planlæg's pile with the free days shining: "Alles kalendere oven på hinanden"
3. The list of dates ready to send: "De datoer, der passer alle"
4. The swipe card with the others' answers: "Swipe ja eller nej"
5. An agreed event with "Tilføj til min kalender": "Aftalt, og i kalenderen"
6. A group with its members and the QR code: "Inviter med et link eller en QR-kode"

Take them in the simulator (iPhone 17 Pro Max or the largest available) with the
made-up data of the e2e world, never real people.

## App Store Connect forms (#142)

Answers taken from the code. App Privacy must say the same as
`ios/App/App/PrivacyInfo.xcprivacy` and the privacy policy's "What Casy
stores": change all three together.

### App Privacy

- Tracking: **No.** Casy has no ads, no analytics and no third-party SDKs that
  track.
- Data collected: **Yes.** Every type below is **linked to the user**, **not
  used for tracking**, and used for **App Functionality** only:

| App Store Connect type | What it is in Casy |
|---|---|
| Contact Info > Name | The display name (or the name Sign in with Apple sends the first time) |
| Contact Info > Email Address | The sign-in address |
| Identifiers > User ID | The account id |
| Identifiers > Device ID | The phone's random id for its calendar connection, and the push token |
| User Content > Photos or Videos | Profile, group and genvej pictures, if chosen |
| User Content > Other User Content | Group and event names, places, notes, text for the AI, corrections sent for review |
| Other Data > Other Data Types | Busy times: start and end only, never titles |
| Usage Data > Product Interaction | Each AI call noted (when, which feature, for whom, never text), 30 days, for the daily limit |

- Not collected: location, contacts (the contact picker's choices never leave
  the phone), audio (Apple's speech recognition gives Casy only text), health,
  financial info, browsing or search history, purchases, diagnostics (no crash
  reporting), sensitive info. Feedback is an email the person sends from their
  own mail app, not data the app collects.
- Product Interaction was declared on 2026-11-04: the AI call notes are close
  enough to Apple's "how the user interacts with the app" that leaving it out
  risked being told it was missing. The privacy policy already describes them.

### Export compliance

`ITSAppUsesNonExemptEncryption` is `false` in `Info.plist`, so App Store Connect
does not ask for each build. If asked anyway: the app uses only the encryption
built into iOS (HTTPS, the Keychain) and SHA-256 hashing (Sign in with Apple's
nonce), which is exempt; no encryption of its own.

### Age rating

4+, with no override (see Basics above). Apple's ratings are 4+, 9+, 13+, 16+ and
18+ since 2025; the answers, not a target number, decide it.

## Notes for App Review

Paste into the review notes field:

> Casy helps groups of friends find a date everyone can make. Sign in with the
> demo account below (email and password, no email code is needed). The demo
> account, Alex, already has a calendar with sample events and is in the group
> "Friday dinners" with two other demo accounts, Sara and Jonas, so every
> screen can be tried. The app follows the phone's language; the Danish names
> are in brackets. On the home page (My calendar): "Plan" (Planlæg) plans
> with the group; "Events" (Aftaler) has Sara's vote "Dinner at Sara's"
> waiting for your answer and the agreed "Sunday brunch" with "Add to my
> calendar"; "Profile" (Profil) has the group. On first opening, a sheet says why
> Casy wants the calendar, and "Continue" (Fortsæt) leads to iOS's own
> question; the app works whichever answer is given. Notifications are asked
> the same way, after dates are sent. The review device may have no events, which is why the demo account's own calendar is a
> connected calendar link with sample events. Casy's AI is Claude from
> Anthropic, a third party, and is optional. Nothing is sent to it until the
> person says yes on the sheet "Turn on Casy's AI?" (Slå Casys AI til?), which
> says what is sent and to whom. It appears on the home page and when an AI
> button is pressed, such as "Plan with AI" (Planlæg med AI); "Not now" leaves
> the app fully usable, and the yes can be withdrawn under Profile, Your data.
> With the yes, the AI plans from what the person writes or says, sorts their
> calendars, labels their events and finds their trips. Casy is built around
> the iPhone: it reads the phone's calendars with EventKit, also in the
> background, writes agreed events back to them, sends push notifications,
> signs in with Sign in with Apple, recognises speech with Apple's speech
> service, and opens invite links in the app. Words that break the terms are
> refused when text is saved, and a report alerts the developer by email.
> Reporting and blocking are under the group's "Report or block" (Rapportér eller bloker)
> and "Report" (Rapportér) on an event. Deleting the account is under Profile
> and works on the demo account too. Contact: asbjornbay@gmail.com

### The demo accounts

`npm run review-demo` builds them (`supabase/review/`), the same way every
time; run it before each submission, since a reviewer may vote, leave the group
or delete the account. It deletes the earlier demo accounts first (through the
app's own account deletion), then makes Alex, Sara and Jonas with the sample
calendars in `public/review/`, the group, Sara's vote (three Fridays at least
a week away, no deadline, Sara and Jonas have answered) and the agreed brunch.
Alex has not said yes to the AI, so the reviewer sees the question. Run from the repo root, in your own terminal:

```bash
read -rsp "Alex's password: " REVIEW_PASSWORD && echo && export REVIEW_PASSWORD && npm run review-demo -- you@gmail.com
```

- The emails are plus-aliases of the address given (`you+casy-review@gmail.com`
  is Alex, the account the reviewer uses; `+casy-sara`, `+casy-jonas`), so any
  email Casy sends them reaches you and none bounces.
- `REVIEW_PASSWORD` is Alex's password: 12 or more characters with letters and
  digits, typed at the prompt, never saved. The same one goes in App Store
  Connect's sign-in information; use the same each run so it stays right there.
  Sara's and Jonas's are random and thrown away.
- It needs the service role key in `.env.local` and the feeds live on casy.app
  (they ship with `main`).
- Admin mode's counts include the three demo accounts.
- Check that sign-in works from a fresh install on the review device (Casy has
  no CAPTCHA, #203; a password sign-in counts towards no email limit).
