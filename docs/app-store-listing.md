# App Store listing (#146)

The texts for Casy's App Store page, in both languages, ready to paste into App
Store Connect. Danish is the app's main language (set it as the primary
localization), English the second. No emojis and no long dashes, as everywhere
on Casy. Limits are Apple's: name 30, subtitle 30, promotional text 170,
keywords 100 (comma separated, no spaces after the commas), description 4000.

Written to be true to what v1 does today (the data paragraph follows the
calendar permission text and the privacy policy: change all three together). Two things are deliberately left out
until they exist: push notifications (#139) and Sign in with Apple (#138); add a
line for each when they ship. Google and Outlook calendars are not mentioned: in
the app they come in through the phone's own calendars.

## Basics

| Field | Value |
|---|---|
| Bundle id | app.casy |
| Primary category | Productivity |
| Secondary category | Lifestyle |
| Price | Free |
| Copyright | 2026 Asbjørn Morris Bay |
| Support URL | https://casy.app (needs a support page or the contact on it: see below) |
| Marketing URL | https://casy.app |
| Privacy policy URL | https://casy.app/privacy |
| Age rating | Answer the questionnaire honestly: users write text others see (group and event names, notes), and an AI reads their typing. Expect 12+ or 17+ rather than 4+ because of user generated content; Apple decides from the answers. |

Support URL: Apple needs a page where someone can get help. casy.app has the
contact email on the terms and privacy pages; a short "Support" section on
/how-it-works or its own /support page is better. Decide before submitting.

## Danish (primary)

**Name** (30): Casy: Find en dato

**Subtitle** (30): Find dagen, hvor alle kan

**Promotional text** (170):
Lav en gruppe, læg jeres kalendere oven på hinanden, og lad Casy finde de datoer, der passer alle. Swipe ja eller nej, og aftalen lander i alles kalender.

**Keywords** (100):
kalender,dato,planlægning,gruppe,venner,aftale,møde,fælles,ledig,invitation,afstemning,tid

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
- Planlægge med AI: skriv eller sig, hvad I vil, og Casy sætter det op for dig. Det er valgfrit.
- Lægge den aftalte dato i din kalender, eller gøre det af sig selv.

Dine data
Casy sender kun, hvornår du er optaget, ikke hvad dine aftaler hedder. Navnene bliver på din telefon, medmindre du selv siger ja til, at Casys AI må læse dem. Dine venner ser kun, at du ikke kan, og hvornår. Der er ingen reklamer og ingen sporing. Du kan se alt, Casy har om dig, hente en kopi og slette din konto i appen.

Casy er lavet i Danmark og er gratis.

## English

**Name** (30): Casy: Find a Date

**Subtitle** (30): Find the day everyone can

**Promotional text** (170):
Make a group, lay your calendars on top of each other, and let Casy find the dates that suit everyone. Swipe yes or no, and the event lands in everyone's calendar.

**Keywords** (100):
calendar,schedule,group,friends,availability,meeting,date,poll,plan,free time,invite,shared

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
- Plan with AI: write or say what you want, and Casy sets it up for you. It is optional.
- Add the agreed date to your calendar, or do it by itself.

Your data
Casy only sends when you are busy, not what your events are called. The names stay on your phone unless you yourself say yes to Casy's AI reading them. Your friends only see that you can't, and when. There are no ads and no tracking. You can see everything Casy has about you, download a copy and delete your account in the app.

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

## Notes for App Review

Paste into the review notes field:

> Casy helps groups of friends find a date everyone can make. Sign in with the
> demo account below (email and password, no email code is needed). The demo
> account already has calendar data and is a member of a group with two other
> demo accounts, so every screen can be tried: My calendar, planning from the
> Planlæg button, the voting screen under Aftaler, the groups under Profil.
> Calendar access is asked when you press "Importér min kalender" on My
> calendar; the simulator or review device may have no events, which is why the
> demo account's own calendar is a connected calendar link with sample events.
> The AI feature (Planlæg med AI) sends only what the user types or says.
> Reporting and blocking are under the group's "Rapportér eller bloker" and
> "Rapportér" on an event. Contact: asbjornbay@gmail.com

Demo account (to set up before submitting; passwords go in App Store Connect,
never in this repository):

- Email and password: create a confirmed email account with a strong password,
  with AI switched on in admin mode.
- A calendar link connected, with a handful of made-up events over the next
  months.
- Two more demo accounts in a shared group, one with a pending vote to answer.
- Check that sign-in works from a fresh install without the captcha getting in
  the way of the review device.
