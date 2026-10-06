import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  CalendarCheck,
  CalendarPlus,
  EyeOff,
  LogIn,
  PencilLine,
  Send,
  SlidersHorizontal,
  Sparkles,
  Users,
} from "lucide-react";

import TopNav from "@/components/TopNav";
import { useAuth } from "@/context/auth";
import { useCalendarsHome } from "@/hooks/useCalendarsHome";
import { useLang } from "@/i18n/lang";

/**
 * What Casy does, from signing in to an event in your calendar, in eight steps.
 *
 * Every claim here describes what the code actually does (the engine's
 * soft/hard rules and calendar priorities, the 7-day invite links, the hourly
 * sync, the blocked holidays, iCloud as the only calendar Casy writes to), so
 * update it when those change, the same way as the privacy policy. Button and
 * page names are quoted as the app shows them. The copy lives here rather
 * than in the shared dictionaries: it is only ever used on this page.
 */

const ICONS: LucideIcon[] = [
  LogIn,
  CalendarPlus,
  SlidersHorizontal,
  Users,
  PencilLine,
  Sparkles,
  Send,
  CalendarCheck,
];

interface Step {
  title: string;
  body: string;
  /** Named options under the body, such as the three calendar priorities. */
  points?: { term: string; text: string }[];
}

interface Copy {
  eyebrow: string;
  title: string;
  intro: string;
  steps: Step[];
  neverSeesTitle: string;
  neverSeesBody: string;
  privacyLink: string;
  findDate: string;
  getStarted: string;
  connect: string;
}

const da: Copy = {
  eyebrow: "Sådan virker det",
  title: 'Fra "hvornår kan I?" til en dato, uden gruppechatten.',
  intro:
    "Casy sammenligner alles kalendere, finder den første dato, hvor hele gruppen kan, og spørger gruppen, om den passer. Sæt det op én gang, så tager hver plan derefter få sekunder.",
  steps: [
    {
      title: "Log ind",
      body: "Fortsæt med Google, eller brug din e-mail med en adgangskode eller et login-link, der kun virker én gang.",
    },
    {
      title: "Forbind dine kalendere",
      body: "Forbind Google, Outlook eller Apple, eller indsæt et kalenderlink, for eksempel et skoleskema. Casy læser kun, hvornår du er optaget, aldrig hvad dine aftaler er, og opdaterer hver time og igen, når din gruppe planlægger noget.",
    },
    {
      title: "Vælg, hvad der tæller",
      body: "Under Min kalender tæller kun kalendere med flueben med. Giv hver kalender en kategori (Arbejde, Skole, Privat eller Andet), og sig, hvor vigtig den er:",
      points: [
        {
          term: "Kan springes over",
          text: "Casy må planlægge oven i den. Til en enkelt aftale sker det kun, hvis ingen dato inden for en uge passer uden.",
        },
        {
          term: "Normal",
          text: "Optaget. Til en tur eller ferie tæller arbejde og skole som tid, du kan tage fri fra, og korte planer som en middag står ikke i vejen, men at være væk hele dagen gør.",
        },
        {
          term: "Spring aldrig over",
          text: "Altid optaget, også når I planlægger en tur.",
        },
      ],
    },
    {
      title: "Lav en gruppe, og invitér folk",
      body: "Giv gruppen et navn, og invitér folk, du allerede er i en gruppe med, eller skriv en e-mailadresse. De får en invitation under Mine aftaler og bliver først medlemmer, når de siger ja. Alle andre kan du sende gruppens link, som virker i syv dage. En gruppe kan have op til 20 medlemmer. Alle i gruppen kan se hinandens navne, og hvornår de er optaget, og intet andet. Medlemmer, der ikke har forbundet en kalender endnu, bliver nævnt og holdt uden for i stedet for at blive talt som ledige. Indtil du har en gruppe, kan du se, hvordan det virker, på eksempelgrupper med din egen kalender.",
    },
    {
      title: "Sig, hvad I skal",
      body: "Skriv, hvad I skal, og vælg, hvornår det starter (eller Når som helst), hvor længe det varer, og hvilke dage der passer. Skal I af sted i flere dage, så slå Tur / ferie til, og vælg antal dage, og hvilken dag I tager af sted, eller Alle dage.",
    },
    {
      title: "Casy finder datoen",
      body: "Øverst står den første dato, hvor alle kan, og den skifter med det samme, når du ændrer noget. Pilene ved siden af viser de næste muligheder. Under den ser du måneden dag for dag: hver søjle viser, hvor mange der er ledige, og gul betyder kun ledig, hvis nogen tager fri eller springer noget over. Tryk på en dag for at prøve den. Casy siger også til, hvis nogen kommer lige fra noget andet eller skal tidligt op dagen efter. Ingen er ledige fra 23. til 26. december eller nytårsaften.",
    },
    {
      title: "Foreslå datoen",
      body: "Tryk på Foreslå denne dato, så kan alle i gruppen acceptere eller afslå den under Mine aftaler. Kræver datoen, at du selv tager fri, godkender du det først. Afslår nogen, finder Casy den næste dato, der passer alle, og spørger igen. Den, der foreslog aftalen, kan aflyse den, og alle andre kan forlade den.",
    },
    {
      title: "Læg den i kalenderen",
      body: "Når alle har accepteret, er aftalen planlagt. Tilføj til min kalender lægger den i din primære kalender, og med Tilføj automatisk slået til sker det af sig selv. Indtil videre kan Casy kun lægge aftaler i Apple-kalendere. Bruger du en anden, får du en kalenderfil, som din kalender kan åbne.",
    },
  ],
  neverSeesTitle: "Det ser Casy aldrig",
  neverSeesBody:
    "Kun start og slut på hvert optaget tidsrum gemmes. Titler, steder, noter og gæster bliver aldrig hentet fra Google eller Microsoft. Apple og kalenderlinks sender altid hele aftaler, så Casy fjerner de oplysninger, før noget gemmes. Gruppemedlemmer ser aldrig navnene på dine kalendere eller hvilke konti, du har forbundet.",
  privacyLink: "Læs privatlivspolitikken",
  findDate: "Find en dato",
  getStarted: "Kom i gang",
  connect: "Forbind kalendere",
};

const en: Copy = {
  eyebrow: "How it works",
  title: 'From "when are you free?" to a date, without the group chat.',
  intro:
    "Casy compares everyone's calendars, finds the first date the whole group is free, and asks the group whether it works. Set it up once, and every plan after that takes seconds.",
  steps: [
    {
      title: "Sign in",
      body: "Continue with Google, or use your email with a password or a one-time sign-in link.",
    },
    {
      title: "Connect your calendars",
      body: "Link Google, Outlook or Apple, or paste any calendar link, such as a school timetable. Casy only reads when you are busy, never what your events are, and refreshes every hour, and again when your group plans something.",
    },
    {
      title: "Choose what counts",
      body: "On My calendar, only ticked calendars count. Give each calendar a category (Work, School, Personal or Other), and say how much it matters:",
      points: [
        {
          term: "Can skip",
          text: "Casy may plan over it. For a single event, only when no date within a week works without it.",
        },
        {
          term: "Normal",
          text: "Busy. For a trip or a holiday, work and school count as time you could take off, and short plans like a dinner don't stand in the way, but being away all day does.",
        },
        {
          term: "Never skip",
          text: "Always busy, trips included.",
        },
      ],
    },
    {
      title: "Make a group and invite people",
      body: "Name a group, and invite people you already share a group with, or type an email address. They get an invitation on My events and only join once they say yes. Anyone else you can send the group's link, which works for seven days. A group can have up to 20 members. Everyone in the group sees each other's names and busy times, and nothing more. Members who have not linked a calendar yet are named and left out, rather than counted as free. Until you have a group, example groups with your own calendar show how it works.",
    },
    {
      title: "Say what you're doing",
      body: "Write what you're doing, and choose when it starts (or Any time), how long it lasts and which days work. Going away for several days? Switch on Trip / holiday, then choose the number of days and the day you leave, or Any day.",
    },
    {
      title: "Casy finds the date",
      body: "At the top is the first date everyone is free, and it changes the moment you change anything. The arrows beside it show the next options. Below, you see the month day by day: each bar shows how many people are free, and amber means free only if someone takes time off or skips something. Tap a day to try it. Casy also tells you when someone comes straight from something else or has an early start the next morning. Nobody is free from 23 to 26 December or on New Year's Eve.",
    },
    {
      title: "Suggest the date",
      body: "Tap Suggest this date, and everyone in the group can accept or decline it on My events. If the date needs you to take time off, you approve that first. If someone declines, Casy finds the next date that works for everyone and asks again. Whoever suggested the event can cancel it, and anyone else can leave it.",
    },
    {
      title: "Put it in your calendar",
      body: "Once everyone has accepted, the event is scheduled. Add to my calendar puts it in your primary calendar, and with Add automatically switched on it happens by itself. For now, Casy can only add events to Apple calendars. If you use another, you get a calendar file your calendar can open.",
    },
  ],
  neverSeesTitle: "What Casy never sees",
  neverSeesBody:
    "Only the start and end of each busy period is stored. Event titles, places, notes and guests are never requested from Google or Microsoft. Apple and calendar links always send whole events, so Casy removes those details before anything is saved. Group members never see your calendars' names or which accounts you connected.",
  privacyLink: "Read the privacy policy",
  findDate: "Find a date",
  getStarted: "Get started",
  connect: "Connect calendars",
};

export default function HowItWorks() {
  const { user } = useAuth();
  const calendarsHome = useCalendarsHome();
  const { lang } = useLang();
  const c = lang === "da" ? da : en;

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main className="mx-auto max-w-3xl px-4 pb-16 pt-4 sm:px-6 sm:pb-20 sm:pt-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">{c.eyebrow}</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-4xl">
          {c.title}
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">{c.intro}</p>

        <ol className="mt-8 space-y-3 sm:mt-10">
          {c.steps.map((step, i) => {
            const Icon = ICONS[i];
            return (
              <li
                key={step.title}
                className="flex gap-3 rounded-2xl border bg-card p-4 shadow-sm sm:gap-4 sm:p-5"
              >
                <div className="flex shrink-0 flex-col items-center">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary sm:h-10 sm:w-10">
                    <Icon className="h-5 w-5" />
                  </span>
                </div>
                <div className="min-w-0">
                  <h2 className="flex items-baseline gap-2 text-base font-semibold text-foreground">
                    <span className="text-sm font-medium tabular-nums text-muted-foreground">
                      {i + 1}
                    </span>
                    {step.title}
                  </h2>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
                  {step.points && (
                    <dl className="mt-3 space-y-2 border-l-2 border-primary/20 pl-3">
                      {step.points.map((point) => (
                        <div key={point.term} className="text-sm leading-relaxed">
                          <dt className="font-medium text-foreground">{point.term}</dt>
                          <dd className="text-muted-foreground">{point.text}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        <section className="mt-8 rounded-2xl bg-secondary p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <EyeOff className="h-5 w-5 text-primary" />
            {c.neverSeesTitle}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
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

        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Link
            to={user ? "/" : "/sign-in"}
            className="flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            {user ? c.findDate : c.getStarted}
            <ArrowRight className="h-4 w-4" />
          </Link>
          {user && (
            <Link
              to={calendarsHome.to}
              className="rounded-full border bg-background px-5 py-2.5 text-sm font-semibold text-foreground transition hover:bg-secondary"
            >
              {c.connect}
            </Link>
          )}
        </div>
      </main>
    </div>
  );
}
