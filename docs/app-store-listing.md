# App Store listing (#146, #271)

The texts for the App Store page, in both languages, ready to paste into App
Store Connect. From 1.1.0 the app is "Vi finder lige en dag" in Danish and "We'll find a day"
in English (#267, #271): it speaks as "vi" / "we", and "Casy" stays only as
the company, the domain and code names. Apple asks for a name unique on the
whole store per language: if "We'll find a day" is taken, try "We'll find a
day: group dates".
Danish is the primary localization, English the second (U.S. and U.K. the
same texts). No emojis and no long dashes. Limits are Apple's: name 30,
subtitle 30, promotional text 170, keywords 100 (comma separated, no spaces
after the commas), description 4000.

Written to be true to what 1.1.0 does (the data paragraph follows the calendar
permission text and the privacy policy: change all three together). Google and
Outlook calendars are not mentioned: in the app they come in through the
phone's own calendars.

## Basics

| Field | Value |
|---|---|
| Bundle id | app.casy |
| Devices | iPhone only (`TARGETED_DEVICE_FAMILY = 1`, #147), so no iPad screenshots |
| Version | 1.1.0, the same as the build. 1.0.3 was never sent to review: its changes ship in 1.1.0 |
| Release | **Manually release this version**, so Apple's approval doesn't set the launch day (#272) |
| Primary category | Productivity |
| Secondary category | Lifestyle |
| Price | Free |
| Copyright | 2026 Asbjørn Morris Bay |
| Support URL | https://casy.app/support (Hjælp og kontakt, public, both languages) |
| Marketing URL | https://casy.app |
| Privacy policy URL | https://casy.app/privacy |
| Age rating | 4+, as Apple worked it out from the questionnaire on 2026-11-04 (answered truthfully: user generated content yes, no messaging or chat, no advertising, violence, mature or gambling content, web browsing or purchases; no override). Answer it again the same way if the app changes what people can share. |

## Being found in App Store search (#256)

Apple ranks a new app with few downloads or ratings low, and the name is the
strongest field, then the subtitle, then the hidden keywords. So:

1. **The name** is the whole phrase people already say, "Vi finder lige en
   dag" in Danish and "We'll find a day" in English: searching the phrase
   finds it.
2. **Keywords** hold no word that is already in the name (Apple counts each
   once) and keep **casy** for a few months, so people searching the old name
   still find it.
3. **Danish is primary**, with an English (U.K.) page as well as English
   (U.S.), so the Danish App Store searches both languages.
4. **Ratings**: the app asks for one after a date is agreed (`lib/appReview.ts`).
5. **Optional, costs money**: Apple Ads on "vi finder lige en dag" and "casy"
   in Denmark.

The name, subtitle and keywords only change with a new version.

### In App Store Connect, step by step (1.1.0)

1. https://appstoreconnect.apple.com/apps, the app, then "+" next to iOS App
   for version **1.1.0**.
2. **App Information** (left menu), **Localizable Information**: for each of
   Danish, English (U.K.) and English (U.S.) (switch at the top right, "+" to
   add one), the name and subtitle below. **Primary Language**: Danish.
3. In the 1.1.0 version page, for each language: the screenshots, the
   promotional text, the description, the keywords and What's New below.
   Screenshots: the five in "Casy App Store screenshots light/1.1.0 Dansk"
   (Danish) and "1.1.0 English" (both English pages).
4. **Build**: the 1.1.0 build from `npm run release:ios` on `release/1.1.0`.
5. **Version Release**: "Manually release this version".
6. **Add for Review**, then **Submit**. When Apple has approved it, it waits
   for launch day's "Release This Version".

## Danish (primary)

**Name** (21/30): Vi finder lige en dag

**Subtitle** (25/30): Find dagen, hvor alle kan

**Promotional text** (158/170):
Lav en gruppe, og lad os lægge jeres kalendere oven på hinanden. Vi finder de datoer, der passer alle. Swipe ja eller nej, og aftalen lander i alles kalender.

**Keywords** (99/100):
casy,kalender,planlægning,gruppe,venner,aftale,møde,fælles,ledig,invitation,afstemning,dato,weekend

**Description** (1985/4000):

"Vi finder lige en dag." Det siger alle i gruppechatten, og så sker der ikke mere. Nu gør der. Appen lægger jeres kalendere oven på hinanden og viser de dage, hvor alle kan.

Sådan virker det
1. Lav en gruppe, og inviter dine venner fra dine kontakter, med et link eller med en QR-kode. Ét link er nok: det fører til appen, og efter log ind er man med i gruppen.
2. Alle lader os se, hvornår de er optaget, i de kalendere, der allerede ligger på telefonen.
3. Du beskriver, hvad I skal: en aften, en weekend eller en hel ferie. Vi lægger alles kalendere oven på hinanden og viser de datoer, der passer alle.
4. Datoerne sendes til gruppen, og vennerne swiper ja eller nej. Vi vælger den dato, ingen har sagt nej til.
5. Når aftalen er landet, kommer den i din kalender.

Det kan appen
- Vise de første datoer, hvor alle kan, til en middag, en weekend eller en tur.
- Vise måneden dag for dag, så du ser, hvor der er plads.
- Lade gruppen stemme ved at swipe: ja til højre, nej til venstre, og op for "helst ikke".
- Påminde dem, der mangler at stemme, med et enkelt tryk.
- Tage hensyn til, hvem der er med, hvem der gerne må være med, og hvor mange der mindst skal kunne.
- Planlægge med AI: skriv eller sig, hvad I vil, og vi sætter det op for dig.
- Sortere dine kalendere, forstå hvad dine aftaler betyder, og finde dine rejser med AI. Det hele er valgfrit: AI'en gør intet, før du siger ja.
- Lægge den aftalte dato i din kalender, eller gøre det af sig selv.
- Give dig besked, når du skal stemme, og når datoen er på plads. Du vælger selv, hvad du får besked om.
- Logge dig ind med din Apple-konto, så du er i gang på et øjeblik.

Dine data
Vi får kun at vide, hvornår du er optaget, ikke hvad dine aftaler hedder. Navnene bliver på din telefon, medmindre du selv siger ja til vores AI. Dine venner ser kun, at du ikke kan, og hvornår. Der er ingen reklamer og ingen sporing. Du kan se alt, vi har om dig, hente en kopi og slette din konto i appen.

Lavet i Danmark, og gratis.

**What's New** (194/4000):

Casy hedder nu Vi finder lige en dag. Samme app, samme grupper, nyt navn.

Nyt: Påmind dem, der mangler at stemme. Og én invitation virker nu hele vejen: hent appen, log ind, og du er i gruppen.

## English (U.S. and U.K.)

**Name** (16/30): We'll find a day

**Subtitle** (25/30): Find the day everyone can

**Promotional text** (162/170):
Make a group and let us lay your calendars on top of each other. We find the dates that suit everyone. Swipe yes or no, and the plan lands in everyone's calendar.

**Keywords** (94/100):
casy,calendar,schedule,group,friends,availability,meeting,poll,plan,invite,shared,weekend,date

**Description** (1980/4000):

"We'll find a day." Everyone says it in the group chat, and then nothing happens. Now it does. The app lays your calendars on top of each other and shows the days everyone can make.

How it works
1. Make a group and invite your friends from your contacts, with a link or with a QR code. One link is enough: it leads to the app, and after signing in you are in the group.
2. Everyone lets us see when they are busy, in the calendars already on their phone.
3. You describe what you are planning: an evening, a weekend or a whole holiday. We lay everyone's calendars on top of each other and show the dates that suit everyone.
4. The dates go to the group, and your friends swipe yes or no. We pick the date nobody said no to.
5. Once the plan is agreed, it goes into your calendar.

What the app can do
- Show the first dates everyone can make, for a dinner, a weekend or a trip.
- Show the month day by day, so you can see where there is room.
- Let the group vote by swiping: yes to the right, no to the left, and up for "rather not".
- Remind the ones who haven't voted yet, with one tap.
- Take into account who is coming, who may come, and how many at least must be able to.
- Plan with AI: write or say what you want, and we set it up for you.
- Sort your calendars, understand what your events mean and find your trips with AI. All of it is optional: the AI does nothing until you say yes.
- Add the agreed date to your calendar, or do it by itself.
- Tell you when it is your turn to vote and when the date is set. You choose what you hear about.
- Sign you in with your Apple account, so you are up and running in a moment.

Your data
We only learn when you are busy, not what your events are called. The names stay on your phone unless you yourself say yes to our AI. Your friends only see that you can't, and when. There are no ads and no tracking. You can see everything we have about you, download a copy and delete your account in the app.

Made in Denmark, and free.

**What's New** (204/4000):

Casy is now called We'll find a day. Same app, same groups, new name.

New: remind the ones who haven't voted yet. And one invitation now works all the way: get the app, sign in, and you are in the group.

## What's New, earlier versions

- 1.0: "Casys første version." / "The first version of Casy."
- 1.0.1 to 1.0.3: fixes; 1.0.3 was never released (its changes are in 1.1.0).

## Screenshots

6.9 inch iPhone (1320 x 2868) is required; Apple scales it for the smaller
sizes, so no other size is made. From 1.1.0 (#271), five slides on the
app's orange with its bubbles, a short white line over each and the app's
screen below it, in the listing's language:

1. Only the name, "VI FINDER / LIGE EN DAG"
2. My calendar's month: "Alles kalendere. Én måned." / "Everyone's calendars. One month."
3. A vote: "Stem på de dage, vi finder" / "Vote on the days we find"
4. An agreed event: "Datoen lander i alles kalender" / "The date lands in everyone's calendar"
5. A group: "En gruppe til hver flok" / "A group for every crowd"

Each screen stands in a drawn iPhone 17 Pro Max (titanium band, black border,
Dynamic Island, iOS's status bar at 9:41), taken with the phone's safe areas
emulated so the app lays itself out under the island as on a real phone.

`npm run appstore:shots` makes them from the app's own screens with the e2e
world's made-up data (never real people) and saves them in "Casy App Store
screenshots light/1.1.0 Dansk" and "1.1.0 English", the folder beside the code
that git leaves out. Its "Dansk" and "English" hold the 1.0 listing's six, in
use until 1.1.0 is released.

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
