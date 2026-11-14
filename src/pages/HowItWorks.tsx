import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  CalendarCheck,
  CalendarPlus,
  EyeOff,
  Hand,
  LogIn,
  Sparkles,
  Users,
} from "lucide-react";

import ProfilePageTop from "@/components/ProfilePageTop";
import AppBackLink from "@/components/welcome/AppBackLink";
import { useAuth } from "@/context/auth";
import { useLang } from "@/i18n/lang";

/**
 * How the app works (#271), from signing in to a date in everyone's calendar,
 * in six steps, as the app does it today: the iPhone app first, the website
 * (computers and Android) where it differs.
 *
 * Every claim here describes what the code actually does (seven-day invite
 * links, 20 members a group, no answer deadline unless one is chosen, Påmind,
 * how a vote is settled, what is stored and what never is), so update it when
 * those change, the same way as the privacy policy. Button names are quoted as
 * the app shows them. The copy lives here rather than in the shared
 * dictionaries: it is only ever used on this page.
 */

const ICONS: LucideIcon[] = [LogIn, CalendarPlus, Users, Sparkles, Hand, CalendarCheck];

interface Step {
  title: string;
  body: string;
}

interface Copy {
  eyebrow: string;
  title: string;
  intro: string;
  steps: Step[];
  neverSeesTitle: string;
  neverSeesBody: string;
  privacyLink: string;
  plan: string;
  getStarted: string;
}

const da: Copy = {
  eyebrow: "Sådan virker det",
  title: 'Fra "vi finder lige en dag" til en dag i kalenderen.',
  intro:
    "Vi lægger jeres kalendere oven på hinanden og viser de dage, hvor alle kan. Gruppen stemmer, og aftalen lander i alles kalender.",
  steps: [
    {
      title: "Hent appen, og log ind",
      body: "Log ind med din Apple-konto i appen. På en computer eller en Android-telefon bruger du hjemmesiden, med Google eller din e-mail.",
    },
    {
      title: "Forbind din kalender",
      body: "I appen bruger vi de kalendere, der allerede ligger på telefonen. På hjemmesiden kan du forbinde Google, Outlook eller Apple eller indsætte et kalenderlink, for eksempel et skoleskema. Vi får kun at vide, hvornår du er optaget, og du bestemmer selv, hvilke kalendere der tæller, og hvor meget.",
    },
    {
      title: "Lav en gruppe",
      body: "Giv gruppen et navn, og invitér folk fra dine kontakter, med et link eller med en QR-kode. Ét link er nok: det fører til appen, og efter log ind er man med i gruppen. Linket virker i syv dage, og en gruppe kan have op til 20 medlemmer. I gruppen ser man kun hinandens navne, og hvornår man er optaget.",
    },
    {
      title: "Tryk på Planlæg",
      body: "Sig, hvad I skal, hvor længe det varer, og hvilke dage der passer: en aften, en weekend eller en hel tur. Vil du hellere skrive eller sige det med dine egne ord, sætter Planlæg med AI det op for dig. Vi lægger alles kalendere oven på hinanden og viser de dage, hvor alle kan, med op til fem gode datoer at sende til gruppen.",
    },
    {
      title: "Gruppen stemmer",
      body: 'Alle swiper sig igennem datoerne: til højre hvis du kan, til venstre hvis du ikke kan, og op hvis du kan, men helst ikke. Mangler nogen at svare, kan du trykke på Påmind. Når alle har svaret, eller en svarfrist er nået, vælger vi den dato, ingen har sagt nej til, med færrest "helst ikke". Har alle datoer et nej, vælger den, der foreslog aftalen.',
    },
    {
      title: "Datoen lander i kalenderen",
      body: "Tryk på Tilføj til min kalender, eller slå Tilføj automatisk til, så sker det af sig selv. I appen lander aftalen i telefonens kalender. På hjemmesiden kan vi lægge den i en Apple-kalender eller give dig en kalenderfil. Vi giver besked, når du skal stemme, og når datoen er på plads.",
    },
  ],
  neverSeesTitle: "Det ser vi aldrig",
  neverSeesBody:
    "Vi gemmer kun start og slut på hvert optaget tidsrum. Fra telefonen sender appen kun tiderne, medmindre du selv lader vores AI læse din kalender. Google og Microsoft giver os aldrig titler, steder, noter eller gæster, og fra Apple og kalenderlinks fjerner vi dem, før noget gemmes. Gruppen ser aldrig navnene på dine kalendere eller hvilke konti, du har forbundet.",
  privacyLink: "Læs privatlivspolitikken",
  plan: "Planlæg",
  getStarted: "Kom i gang",
};

const en: Copy = {
  eyebrow: "How it works",
  title: 'From "we\'ll find a day" to a day in the calendar.',
  intro:
    "We lay your calendars on top of each other and show the days everyone can make. The group votes, and the plan lands in everyone's calendar.",
  steps: [
    {
      title: "Get the app and sign in",
      body: "Sign in with your Apple account in the app. On a computer or an Android phone you use the website, with Google or your email.",
    },
    {
      title: "Connect your calendar",
      body: "In the app we use the calendars already on your phone. On the website you can connect Google, Outlook or Apple, or paste a calendar link, a school timetable for example. We only learn when you are busy, and you decide which calendars count, and how much.",
    },
    {
      title: "Make a group",
      body: "Give the group a name and invite people from your contacts, with a link or with a QR code. One link is enough: it leads to the app, and after signing in you are in the group. The link works for seven days, and a group can have up to 20 members. In a group you only see each other's names, and when each of you is busy.",
    },
    {
      title: "Tap Plan",
      body: "Say what you are planning, how long it lasts and which days suit: an evening, a weekend or a whole trip. If you would rather write or say it in your own words, Plan with AI sets it up for you. We lay everyone's calendars on top of each other and show the days everyone can make, with up to five good dates to send to the group.",
    },
    {
      title: "The group votes",
      body: 'Everyone swipes through the dates: right if you can, left if you can\'t, and up if you can but would rather not. If someone has yet to answer, you can tap Remind. Once everyone has answered, or an answer deadline has passed, we pick the date nobody said no to, with the fewest "rather not". If every date has a no, the one who suggested the plan chooses.',
    },
    {
      title: "The date lands in the calendar",
      body: "Tap Add to my calendar, or switch on Add automatically and it happens by itself. In the app the plan lands in the phone's calendar. On the website we can put it in an Apple calendar or give you a calendar file. We tell you when it is your turn to vote and when the date is set.",
    },
  ],
  neverSeesTitle: "What we never see",
  neverSeesBody:
    "We only store the start and end of each busy time. From the phone the app sends only the times, unless you yourself let our AI read your calendar. Google and Microsoft never give us titles, places, notes or guests, and from Apple and calendar links we remove them before anything is stored. Your group never sees the names of your calendars or which accounts you have connected.",
  privacyLink: "Read the privacy policy",
  plan: "Plan",
  getStarted: "Get started",
};

export default function HowItWorks() {
  const { user } = useAuth();
  const { lang } = useLang();
  const c = lang === "da" ? da : en;

  return (
    <div className="min-h-screen bg-background">
      <ProfilePageTop />
      <main className="mx-auto max-w-2xl px-4 pb-16 pt-4 sm:px-6 sm:pb-20 sm:pt-6">
        <AppBackLink className="mb-4" />
        <p className="text-[0.8125rem] font-semibold uppercase tracking-wide text-primary">
          {c.eyebrow}
        </p>
        <h1 className="mt-2 text-balance text-[1.75rem] font-bold leading-tight tracking-tight text-foreground sm:text-4xl">
          {c.title}
        </h1>
        <p className="mt-3 text-[1rem] leading-relaxed text-muted-foreground">{c.intro}</p>

        {/* The steps as a line down the left, each with its number on it. */}
        <ol className="relative mt-8 sm:mt-10">
          {c.steps.map((step, i) => {
            const Icon = ICONS[i];
            const last = i === c.steps.length - 1;
            return (
              <li key={step.title} className="relative flex gap-4 pb-7 last:pb-0">
                {!last && (
                  <span
                    aria-hidden
                    className="absolute left-[1.375rem] top-12 h-[calc(100%-3rem)] w-[2px] -translate-x-1/2 rounded-full bg-primary/15"
                  />
                )}
                <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Icon aria-hidden className="h-5 w-5" />
                  <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-cta text-[0.6875rem] font-bold text-white">
                    {i + 1}
                  </span>
                </span>
                <div className="min-w-0 pt-1.5">
                  <h2 className="text-[1.0625rem] font-semibold text-foreground">{step.title}</h2>
                  <p className="mt-1 text-[0.9375rem] leading-relaxed text-muted-foreground">
                    {step.body}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>

        <section className="mt-10 rounded-2xl bg-secondary p-5">
          <h2 className="flex items-center gap-2 text-[1.0625rem] font-semibold text-foreground">
            <EyeOff aria-hidden className="h-5 w-5 text-primary" />
            {c.neverSeesTitle}
          </h2>
          <p className="mt-1 text-[0.9375rem] leading-relaxed text-muted-foreground">
            {c.neverSeesBody}{" "}
            <Link
              to="/privacy"
              className="font-medium text-foreground underline underline-offset-2"
            >
              {c.privacyLink}
            </Link>
            .
          </p>
        </section>

        <div className="mt-10 flex justify-center">
          <Link
            to={user ? "/" : "/sign-in"}
            className="glass-pill inline-flex items-center gap-2 rounded-full px-6 py-3 text-[1.0625rem] font-semibold text-primary"
          >
            {user ? c.plan : c.getStarted}
            <ArrowRight aria-hidden className="h-5 w-5" />
          </Link>
        </div>
      </main>
    </div>
  );
}
