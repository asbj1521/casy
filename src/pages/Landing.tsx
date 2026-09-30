import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion, MotionConfig, useReducedMotion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Ban,
  Clock,
  DatabaseZap,
  Lock,
  MapPin,
  Users,
} from "lucide-react";

import FadeSwap from "@/components/FadeSwap";
import TopNav from "@/components/TopNav";
import { useExampleCarousel } from "@/hooks/useExampleCarousel";
import { LOCALE, useLang, useT } from "@/i18n/lang";
import { cn } from "@/lib/utils";
import { addDays, APP_TIME_ZONE, localDate, startOfDay } from "@/lib/zone";

/**
 * The front page for signed-out visitors (App.tsx sends signed-in people
 * straight to the scheduler): what Casy is for, and a short, factual account
 * of how it treats your data, with a button on to the scheduler at /plan.
 *
 * Every data claim here must stay true to the code, like the privacy policy
 * it links to: only busy start/end is stored (calendar_busy_cache), data sits
 * in Supabase's Frankfurt region, calendar credentials are AES-256-GCM
 * (secretBox.ts), every table has RLS with no policies, members see names
 * and busy ranges only, and there is no analytics. The Casy login password
 * is Supabase Auth's (hashed, not ours to encrypt), so the encryption claim
 * is about calendar access only. Change it here when any of that changes.
 */

const FACT_ICONS: LucideIcon[] = [Clock, MapPin, Lock, DatabaseZap, Users, Ban];

const da = {
  titleQuestion: "Hvornår kan I?",
  titleAnswer: "Casy ved det.",
  intro:
    "Casy kigger i jeres kalendere og finder den første dag, hvor alle kan. Til vennerne, familien, holdet og alle andre, I gerne vil ses med.",
  go: "Gå til Casy",
  signIn: "Log ind",
  dataTitle: "Dine data, kort fortalt",
  dataIntro: "Casy skal kende dine kalendere for at gøre sit arbejde. Så lidt som muligt, og godt passet på.",
  facts: [
    {
      title: "Kun hvornår du er optaget",
      body: "Casy gemmer start og slut på dine aftaler. Aldrig titler, steder, noter eller gæster.",
    },
    {
      title: "Servere i EU",
      body: "Dine data ligger hos Supabase i Frankfurt, Tyskland.",
    },
    {
      title: "Krypteret",
      body: "Adgangen til dine kalendere krypteres med AES-256, før den gemmes.",
    },
    {
      title: "Låst database",
      body: "Ingen kan læse databasen direkte. Alt går gennem serveren, som tjekker, hvem du er.",
    },
    {
      title: "Din gruppe ser kun det nødvendige",
      body: "Dit navn, og hvornår du er optaget. Aldrig din e-mail eller dine kalendere.",
    },
    {
      title: "Ikke til salg",
      body: "Ingen reklamer og ingen sporing, og dine data bliver aldrig solgt eller delt. Sletter du din konto, slettes dine data med den.",
    },
  ],
  privacyLink: "Læs privatlivspolitikken",
  howLink: "Sådan virker det",
  ctaTitle: "Klar til at finde en dato?",
};

const en: typeof da = {
  titleQuestion: "When is everyone free?",
  titleAnswer: "Casy knows.",
  intro:
    "Casy looks at your calendars and finds the first day everyone can make it. For friends, family, the team and anyone else you want to see.",
  go: "Go to Casy",
  signIn: "Sign in",
  dataTitle: "Your data, in short",
  dataIntro: "Casy needs your calendars to do its job. As little as possible, and well looked after.",
  facts: [
    {
      title: "Only when you are busy",
      body: "Casy stores the start and end of your events. Never titles, places, notes or guests.",
    },
    {
      title: "Servers in the EU",
      body: "Your data is kept by Supabase in Frankfurt, Germany.",
    },
    {
      title: "Encrypted",
      body: "Access to your calendars is encrypted with AES-256 before it is stored.",
    },
    {
      title: "Locked database",
      body: "Nobody can read the database directly. Everything goes through the server, which checks who you are.",
    },
    {
      title: "Your group sees only what it needs",
      body: "Your name, and when you are busy. Never your email or your calendars.",
    },
    {
      title: "Not for sale",
      body: "No ads and no tracking, and your data is never sold or shared. Delete your account, and your data goes with it.",
    },
  ],
  privacyLink: "Read the privacy policy",
  howLink: "How it works",
  ctaTitle: "Ready to find a date?",
};

/**
 * The drawing's made-up groups, which take turns like the scheduling page's
 * examples: how many people each has, and how many are free on each of the
 * next 14 days. Every group has exactly one day everyone can make, the
 * answer, and it lands on a different day each time.
 */
const DRAWING_GROUPS: { total: number; free: number[] }[] = [
  { total: 4, free: [2, 1, 3, 2, 1, 3, 2, 1, 3, 4, 2, 1, 3, 2] },
  { total: 6, free: [3, 5, 2, 4, 1, 6, 3, 2, 5, 4, 1, 3, 2, 4] },
  { total: 3, free: [1, 2, 3, 1, 0, 2, 1, 2, 1, 0, 2, 1, 2, 1] },
  { total: 5, free: [2, 4, 3, 1, 2, 3, 4, 2, 1, 3, 4, 5, 2, 3] },
];

/** When the i-th day's bar (and its date) starts rising on first load, in seconds. */
const riseDelay = (i: number) => 0.4 + i * 0.04;

/** Fades in and rises a little; `delay` staggers the hero's parts. */
function Rise({ delay = 0, className, children }: { delay?: number; className?: string; children: ReactNode }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

/**
 * A copy of the scheduling page's day chart (DayChart.tsx), same colours and
 * shapes, cycling through DRAWING_GROUPS with the same timing and cross-fade
 * as the page's example groups (useExampleCarousel, FadeSwap). Real dates from
 * today, so it never looks out of date. Decoration only, and nothing to
 * click, so unlike the page's carousel it never stops, except for reduced
 * motion.
 */
function ChartDrawing() {
  const t = useT();
  const { lang } = useLang();
  const { index } = useExampleCarousel(DRAWING_GROUPS.length, true);
  const group = DRAWING_GROUPS[index];
  // Whether the carousel has moved on since the page loaded: the rise is for
  // the first group only. Set during render, React's pattern for state that
  // follows a changed value, so the new group's first render already knows.
  const [firstIndex] = useState(index);
  const [swapped, setSwapped] = useState(false);
  if (!swapped && index !== firstIndex) setSwapped(true);
  // The rise animates a height, which MotionConfig's reduced-motion setting
  // (transforms only) doesn't catch, so it is switched off here by hand.
  const reduceMotion = useReducedMotion();
  const still = swapped || reduceMotion;
  // Read once, so a re-render never shifts the days.
  const [today] = useState(() => startOfDay(Date.now(), APP_TIME_ZONE));
  const days = group.free.map((free, i) => {
    const ms = addDays(today, i, APP_TIME_ZONE);
    return {
      free,
      ms,
      best: free === group.total,
      dayOfMonth: localDate(ms, APP_TIME_ZONE).day,
      dow: new Date(ms).toLocaleDateString(LOCALE[lang], { weekday: "narrow", timeZone: APP_TIME_ZONE }),
    };
  });
  const month = new Date(today).toLocaleDateString(LOCALE[lang], { month: "long", timeZone: APP_TIME_ZONE });
  const title = month.charAt(0).toUpperCase() + month.slice(1);

  return (
    <div aria-hidden="true" className="rounded-2xl border bg-card px-4 pb-4 pt-3 shadow-sm sm:px-6 sm:pt-5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="text-[15px] font-bold text-foreground sm:text-lg">{t.scheduler.chartTitle(title)}</p>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm bg-everyone" />
            {t.scheduler.legendAll}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm bg-primary/30" />
            {t.scheduler.legendFree}
          </span>
        </div>
      </div>

      {/* The title and legend stay put; the bars and dates fade over. */}
      <FadeSwap swapKey={String(index)} playChildrenOnLoad>
        <div
          className="mt-4 flex items-end gap-1 border-b [--bar-max:110px] sm:mt-5 sm:gap-1.5 sm:[--bar-max:150px]"
          style={{ height: "calc(var(--bar-max) + 24px)" }}
        >
          {days.map((d, i) => {
            // On the first load the bars rise left to right. It is the bar's
            // real height that grows (--grow counts 0 to 1), not a transform,
            // so the count sitting on top is carried up with it rather than
            // waiting in the air; it fades in as it sets off. After that,
            // swaps only fade.
            const delay = riseDelay(i);
            return (
              <div key={d.ms} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
                <motion.span
                  className={cn("text-[11px] font-bold", d.best ? "text-everyone" : "text-muted-foreground")}
                  initial={still ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2, delay }}
                >
                  {d.free}
                </motion.span>
                <motion.span
                  className={cn("w-full rounded-t-[4px]", d.best ? "bg-everyone" : "bg-primary/30")}
                  style={{ height: `max(3px, calc(var(--bar-max) * ${d.free / group.total} * var(--grow)))` }}
                  initial={still ? { "--grow": 1 } : { "--grow": 0 }}
                  animate={{ "--grow": 1 }}
                  transition={{ duration: 0.5, delay, ease: "easeOut" }}
                />
              </div>
            );
          })}
        </div>
        <div className="mt-1.5 flex gap-1 sm:gap-1.5">
          {/* The dates come in with their bars, same beat and speed. */}
          {days.map((d, i) => (
            <motion.div
              key={d.ms}
              className="flex min-w-0 flex-1 flex-col items-center text-[10px] leading-tight sm:text-xs"
              initial={still ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: riseDelay(i), ease: "easeOut" }}
            >
              <span className={cn("font-semibold", d.best ? "font-extrabold text-everyone" : "text-foreground")}>
                {d.dayOfMonth}
              </span>
              <span className="text-muted-foreground">{d.dow}</span>
            </motion.div>
          ))}
        </div>
      </FadeSwap>
    </div>
  );
}

function GoButton({ label }: { label: string }) {
  return (
    <Link
      to="/plan"
      className="flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 text-base font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 sm:px-8 sm:py-4 sm:text-lg"
    >
      {label}
      <ArrowRight className="h-5 w-5" />
    </Link>
  );
}

export default function Landing() {
  const { lang } = useLang();
  const c = lang === "da" ? da : en;

  return (
    // "user" turns the movement off for anyone who asked for reduced motion.
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-background">
        <TopNav />
        <main className="mx-auto max-w-5xl px-4 pb-16 sm:px-6 sm:pb-24">
          {/* The headline runs the full width above both columns, so the
              question keeps to one line on a laptop. */}
          <section className="pt-6 sm:pt-12 lg:pt-16">
            <Rise>
              <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-6xl">
                {c.titleQuestion}
                <span className="block text-primary">{c.titleAnswer}</span>
              </h1>
            </Rise>
            <div className="mt-6 grid items-center gap-10 sm:mt-8 lg:grid-cols-[1fr_1.15fr] lg:gap-14">
              <div>
                <Rise delay={0.1}>
                  <p className="max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                    {c.intro}
                  </p>
                </Rise>
                <Rise delay={0.2} className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
                  <GoButton label={c.go} />
                  <Link
                    to="/sign-in"
                    className="text-sm font-medium text-muted-foreground underline-offset-4 transition hover:text-foreground hover:underline sm:text-base"
                  >
                    {c.signIn}
                  </Link>
                </Rise>
              </div>
              <Rise delay={0.3}>
                <ChartDrawing />
              </Rise>
            </div>
          </section>

          <section className="mt-16 sm:mt-24">
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {c.dataTitle}
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">{c.dataIntro}</p>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {c.facts.map((fact, i) => {
                const Icon = FACT_ICONS[i];
                return (
                  <li key={fact.title} className="rounded-2xl border bg-card p-5 shadow-sm">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </span>
                    <h3 className="mt-3 text-base font-semibold text-foreground">{fact.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{fact.body}</p>
                  </li>
                );
              })}
            </ul>
            <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <Link to="/privacy" className="font-medium text-foreground underline underline-offset-2">
                {c.privacyLink}
              </Link>
              <Link to="/how-it-works" className="font-medium text-foreground underline underline-offset-2">
                {c.howLink}
              </Link>
            </div>
          </section>

          <section className="mt-16 flex flex-col items-center gap-5 rounded-3xl bg-secondary px-6 py-10 text-center sm:mt-24 sm:py-14">
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{c.ctaTitle}</h2>
            <GoButton label={c.go} />
          </section>
        </main>
      </div>
    </MotionConfig>
  );
}
