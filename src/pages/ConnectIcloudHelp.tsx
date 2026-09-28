import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import { SiApple } from "react-icons/si";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  Fingerprint,
  Loader2,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import { connectApple } from "@/api/apple";
import AppleCredentialFields from "@/components/AppleCredentialFields";
import AppleWalkthrough, { AppleWalkthroughChecklist } from "@/components/AppleWalkthrough";
import TopNav from "@/components/TopNav";
import { useAuth } from "@/context/auth";
import { useLang, useT } from "@/i18n/lang";
import { cn } from "@/lib/utils";

/**
 * Connecting an Apple calendar, one step at a time, for people who have never
 * made an app-specific password. Linked from the Apple iCloud Calendar card
 * and its form; the card's own form stays the quick way for everyone else.
 *
 * Four steps and a finish: what an app-specific password is, watching it
 * being made at Apple (AppleWalkthrough), making it there, and pasting it in
 * here, where the calendar is actually connected (through the same
 * connectApple() the card uses). The link to Apple only turns up on the third
 * step, after the walkthrough: handed the link first, people went straight to
 * Apple and found themselves on a page they didn't know what to do with.
 *
 * The step lives in the URL (?step=watch, ?step=apple, ?step=enter) rather
 * than in memory, so it survives the things that happen in the middle of
 * this: a phone reloading the tab while its owner is off at Apple, and signing
 * in by email link, which opens a new tab. It also lets the phone's back
 * gesture go back a step instead of leaving.
 *
 * Apple ID became Apple Account (Apple-konto) in 2024; the copy follows Apple.
 */

const PATH = "/help/connect-icloud";
const ACCOUNT_URL = "https://account.apple.com/account/manage";
const ACCOUNT_LABEL = "account.apple.com/account/manage";

type Step = "intro" | "watch" | "apple" | "enter";
const STEPS: Step[] = ["intro", "watch", "apple", "enter"];

function stepFrom(value: string | null): Step {
  return value === "watch" || value === "apple" || value === "enter" ? value : "intro";
}

const link = (
  <a
    href={ACCOUNT_URL}
    target="_blank"
    rel="noreferrer"
    className="font-medium text-foreground underline underline-offset-2"
  >
    {ACCOUNT_LABEL}
  </a>
);

const da = {
  eyebrow: "Forbind iCloud",
  title: "Forbind din Apple-kalender",
  progress: (n: number, total: number) => `Trin ${n} af ${total}`,
  back: "Tilbage",
  intro: {
    title: "Først: en adgangskode kun til Casy",
    body: "Apple lader ikke andre apps komme ind i din kalender med din almindelige Apple-adgangskode. I stedet laver du en ekstra adgangskode hos Apple og giver den til Casy. Tænk på den som en ekstranøgle: Casy bruger den kun til at se, hvornår du er optaget, og du kan smide den væk når som helst uden at røre din almindelige adgangskode.",
    needTitle: "Det skal du bruge",
    need: [
      "Din e-mail og adgangskode til Apple. Touch ID er ikke nok her.",
      "Din iPhone i nærheden, til den kode Apple sender",
      "En Mac eller en anden computer",
      "Cirka 5 minutter",
    ],
    safe: "Casy ser aldrig din almindelige Apple-adgangskode. Casy spørger kun Apple om, hvornår du er optaget, aldrig hvad dine aftaler hedder, og gemmer den ekstra adgangskode krypteret.",
    start: "Kom i gang",
    haveOne: "Jeg har allerede en",
  },
  watch: {
    title: "Sådan gør du hos Apple",
    body: "Se det hele igennem her først, så du ved, hvad du skal klikke på. Linket til Apple kommer på næste trin.",
    next: "Jeg er klar",
  },
  apple: {
    title: "Nu er det din tur",
    body: "Åbn Apples side i en ny fane, og gør det, du lige har set. Kom tilbage til denne fane, når du har adgangskoden.",
    touchId:
      "Log ind med din e-mail og adgangskode, ikke med Touch ID. Ellers kan Apple ikke lave adgangskoden.",
    open: "Åbn Apples kontoside",
    stepsTitle: "Trinene igen",
    watchAgain: "Se animationen igen",
    failedTitle: "Siger Apple, at der ikke kunne genereres en adgangskode?",
    failedBody:
      "Så er du logget ind med Touch ID. Klik på den hvide knap, Log ind med adgangskode, ikke den blå Annuller. Log ind med e-mail og adgangskode, og start igen fra App-specifikke adgang…",
    missingTitle: "Kan du ikke finde App-specifikke adgangskoder?",
    missingBody:
      "Apple tilbyder dem kun, når tofaktorgodkendelse er slået til for din Apple-konto. De fleste har det allerede. Hvis du ikke har, så slå det til under Login og sikkerhed først, så dukker muligheden op.",
    next: "Jeg har adgangskoden",
  },
  enter: {
    title: "Sæt den ind i Casy",
    body: "Sidste trin. Skriv din Apple-e-mail, og sæt den adgangskode ind, som Apple lige har vist dig.",
    emailHint:
      "Den e-mail, du logger ind på din iPhone eller Mac med. På en iPhone kan du se den under Indstillinger, hvor du trykker på dit navn øverst.",
    passwordHint: "Den nye fra Apple, ikke din almindelige Apple-adgangskode.",
    connect: "Forbind min kalender",
    connecting: "Læser dine kalendere",
    signInBody: "Log ind på Casy først. Bagefter kommer du direkte tilbage til dette trin.",
    signIn: "Log ind på Casy",
    revoke: (
      <>Du kan tilbagekalde adgangskoden når som helst under App-specifikke adgangskoder på {link}.</>
    ),
  },
  done: {
    title: "Din Apple-kalender er forbundet",
    found: (calendars: number, busy: number) =>
      `Casy fandt ${calendars === 1 ? "1 kalender" : `${calendars} kalendere`} og ${busy === 1 ? "1 optaget tidsrum" : `${busy} optagede tidsrum`}.`,
    skipped: (n: number) =>
      n === 1
        ? "1 aftale kunne ikke læses og blev sprunget over."
        : `${n} aftaler kunne ikke læses og blev sprunget over.`,
    empty:
      "Er din kalender ikke tom? Så kommer aftalerne i din iPhones Kalender-app måske fra en Google- eller Outlook-konto, og så ligger de ikke i iCloud. Forbind den konto på din profil i stedet.",
    nextTitle: "Hvad nu?",
    nextBody:
      "Fortæl Casy, hvilke kalendere der er arbejde eller skole, så Casy ved, hvad du ville kunne tage fri fra.",
    toCalendar: "Gå til Min kalender",
    toProfile: "Tilbage til profil",
  },
};

const en: typeof da = {
  eyebrow: "Connect iCloud",
  title: "Connect your Apple calendar",
  progress: (n: number, total: number) => `Step ${n} of ${total}`,
  back: "Back",
  intro: {
    title: "First, a password just for Casy",
    body: "Apple doesn't let other apps into your calendar with your normal Apple password. Instead, you make an extra password at Apple and give it to Casy. Think of it as a spare key: Casy only uses it to see when you're busy, and you can throw it away at any time without touching your normal password.",
    needTitle: "What you need",
    need: [
      "Your Apple email and password. Touch ID isn't enough here.",
      "Your iPhone nearby, for the code Apple sends",
      "A Mac or another computer",
      "About 5 minutes",
    ],
    safe: "Casy never sees your normal Apple password. It only asks Apple when you're busy, never what your events are called, and keeps the extra password encrypted.",
    start: "Let's start",
    haveOne: "I already have one",
  },
  watch: {
    title: "Here's how it goes at Apple",
    body: "Watch it all here first, so you know what to click. The link to Apple comes on the next step.",
    next: "I'm ready",
  },
  apple: {
    title: "Now it's your turn",
    body: "Open Apple's page in a new tab and do what you just watched. Come back to this tab when you have the password.",
    touchId:
      "Sign in with your email and password, not Touch ID. Otherwise Apple can't make the password.",
    open: "Open Apple's account page",
    stepsTitle: "The steps again",
    watchAgain: "Watch the animation again",
    failedTitle: "Does Apple say it couldn't generate a password?",
    failedBody:
      "Then you signed in with Touch ID. Click the white button, Sign in with password, not the blue Cancel. Sign in with your email and password, and start again from App-Specific Passwo…",
    missingTitle: "Can't find App-Specific Passwords?",
    missingBody:
      "Apple only offers them when two-factor authentication is on for your Apple Account. Most accounts have it already. If yours doesn't, turn it on under Sign-In and Security first, and the option will appear.",
    next: "I have the password",
  },
  enter: {
    title: "Paste it into Casy",
    body: "Last step. Enter your Apple email and paste the password Apple just showed you.",
    emailHint:
      "The email you sign in to your iPhone or Mac with. On an iPhone, open Settings and tap your name at the top to see it.",
    passwordHint: "The new one from Apple, not your normal Apple password.",
    connect: "Connect my calendar",
    connecting: "Reading your calendars",
    signInBody: "Sign in to Casy first. You'll come straight back to this step afterwards.",
    signIn: "Sign in to Casy",
    revoke: <>You can revoke the password at any time under App-Specific Passwords at {link}.</>,
  },
  done: {
    title: "Your Apple calendar is connected",
    found: (calendars: number, busy: number) =>
      `Casy found ${calendars === 1 ? "1 calendar" : `${calendars} calendars`} and ${busy === 1 ? "1 busy time" : `${busy} busy times`}.`,
    skipped: (n: number) =>
      n === 1
        ? "1 event couldn't be read and was left out."
        : `${n} events couldn't be read and were left out.`,
    empty:
      "Is your calendar not empty? Then the events in your iPhone's Calendar app may come from a Google or Outlook account, which means they aren't in iCloud. Connect that account on your profile instead.",
    nextTitle: "What's next?",
    nextBody:
      "Tell Casy which calendars are work or school, so it knows what you could take time off from.",
    toCalendar: "Go to My calendar",
    toProfile: "Back to profile",
  },
};

const primaryButton =
  "inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60 sm:w-auto";
const secondaryButton =
  "inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-medium text-muted-foreground transition hover:text-foreground sm:mr-auto sm:pl-0";

/**
 * The buttons under a step: the way forward, and the way back (or aside).
 * On a phone the way forward comes first and fills the width, where a thumb
 * finds it; from `sm` up the two sit on one line, back on the left.
 */
function StepFooter({ secondary, children }: { secondary?: ReactNode; children: ReactNode }) {
  return (
    <div className="mt-6 flex flex-col-reverse gap-2 border-t pt-5 sm:flex-row sm:items-center sm:justify-end">
      {secondary}
      {children}
    </div>
  );
}

/** A question that opens to its answer. Native, so it needs no state and works with a keyboard. */
function FoldOut({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="group mt-3 rounded-lg border bg-background">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition group-open:rotate-180" />
      </summary>
      <p className="border-t px-4 py-3 text-sm leading-relaxed text-muted-foreground">{children}</p>
    </details>
  );
}

export default function ConnectIcloudHelp() {
  const { lang } = useLang();
  const c = lang === "da" ? da : en;
  const t = useT();
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const reduceMotion = useReducedMotion();
  const [searchParams, setSearchParams] = useSearchParams();
  const step = stepFrom(searchParams.get("step"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const connect = useMutation({
    mutationFn: () => connectApple(queryClient, user.id, email, password),
    // The password has done its job; don't keep it in the page any longer.
    onSuccess: () => setPassword(""),
  });
  // The finish belongs to the step it was reached from: going back a step
  // (with the button or the phone's back gesture) shows that step again.
  const result = step === "enter" ? connect.data : undefined;
  const view = result ? "done" : step;

  function goTo(next: Step) {
    connect.reset();
    const params = new URLSearchParams(searchParams);
    if (next === "intro") params.delete("step");
    else params.set("step", next);
    setSearchParams(params);
  }

  // Each new step starts at the top, with focus on its heading so a screen
  // reader announces where it landed. Not on the first render: someone
  // arriving on the page should start at the page's own top.
  const headingRef = useRef<HTMLHeadingElement>(null);
  const shownView = useRef(view);
  useEffect(() => {
    if (shownView.current === view) return;
    shownView.current = view;
    window.scrollTo({ top: 0 });
    headingRef.current?.focus({ preventScroll: true });
  }, [view]);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    connect.mutate();
  }

  const stepIndex = STEPS.indexOf(step);
  const headingClass = "text-xl font-bold tracking-tight text-foreground outline-none sm:text-2xl";

  let body: ReactNode;
  if (view === "done" && result) {
    body = (
      <>
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <CheckCircle2 className="h-6 w-6" />
        </span>
        <h2 ref={headingRef} tabIndex={-1} className={cn(headingClass, "mt-4")}>
          {c.done.title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
          {c.done.found(result.calendars, result.busyBlocks)}
          {result.skippedEvents > 0 && <> {c.done.skipped(result.skippedEvents)}</>}
        </p>
        {result.busyBlocks === 0 && (
          <p className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{c.done.empty}</span>
          </p>
        )}
        <div className="mt-5 rounded-xl bg-secondary/60 p-4">
          <p className="text-sm font-semibold text-foreground">{c.done.nextTitle}</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{c.done.nextBody}</p>
        </div>
        <StepFooter
          secondary={
            <Link to="/profile" className={secondaryButton}>
              {c.done.toProfile}
            </Link>
          }
        >
          <Link to="/calendar-overview" className={primaryButton}>
            {c.done.toCalendar}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </StepFooter>
      </>
    );
  } else if (step === "intro") {
    body = (
      <>
        <h2 ref={headingRef} tabIndex={-1} className={headingClass}>
          {c.intro.title}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
          {c.intro.body}
        </p>
        <p className="mt-5 text-sm font-semibold text-foreground">{c.intro.needTitle}</p>
        <ul className="mt-2 space-y-2">
          {c.intro.need.map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm text-foreground">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              {item}
            </li>
          ))}
        </ul>
        <p className="mt-5 flex items-start gap-2 rounded-lg bg-secondary/60 p-3 text-sm text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
          <span>{c.intro.safe}</span>
        </p>
        <StepFooter
          secondary={
            <button type="button" onClick={() => goTo("enter")} className={secondaryButton}>
              {c.intro.haveOne}
            </button>
          }
        >
          <button type="button" onClick={() => goTo("watch")} className={primaryButton}>
            {c.intro.start}
            <ArrowRight className="h-4 w-4" />
          </button>
        </StepFooter>
      </>
    );
  } else if (step === "watch") {
    body = (
      <>
        <h2 ref={headingRef} tabIndex={-1} className={headingClass}>
          {c.watch.title}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
          {c.watch.body}
        </p>
        <div className="mt-5">
          <AppleWalkthrough />
        </div>
        <StepFooter
          secondary={
            <button type="button" onClick={() => goTo("intro")} className={secondaryButton}>
              <ArrowLeft className="h-4 w-4" />
              {c.back}
            </button>
          }
        >
          <button type="button" onClick={() => goTo("apple")} className={primaryButton}>
            {c.watch.next}
            <ArrowRight className="h-4 w-4" />
          </button>
        </StepFooter>
      </>
    );
  } else if (step === "apple") {
    body = (
      <>
        <h2 ref={headingRef} tabIndex={-1} className={headingClass}>
          {c.apple.title}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
          {c.apple.body}
        </p>
        {/* The one thing that trips people up at Apple, said before they go. */}
        <p className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <Fingerprint className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{c.apple.touchId}</span>
        </p>
        <a
          href={ACCOUNT_URL}
          target="_blank"
          rel="noreferrer"
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-neutral-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800 sm:w-auto"
        >
          <SiApple className="h-4 w-4" />
          {c.apple.open}
          <ExternalLink className="h-4 w-4" />
        </a>
        <div className="mt-6">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <p className="text-sm font-semibold text-foreground">{c.apple.stepsTitle}</p>
            <button
              type="button"
              onClick={() => goTo("watch")}
              className="text-sm font-medium text-muted-foreground underline underline-offset-2 transition hover:text-foreground"
            >
              {c.apple.watchAgain}
            </button>
          </div>
          <div className="mt-3">
            <AppleWalkthroughChecklist />
          </div>
        </div>
        <div className="mt-5">
          <FoldOut title={c.apple.failedTitle}>{c.apple.failedBody}</FoldOut>
          <FoldOut title={c.apple.missingTitle}>{c.apple.missingBody}</FoldOut>
        </div>
        <StepFooter
          secondary={
            <button type="button" onClick={() => goTo("watch")} className={secondaryButton}>
              <ArrowLeft className="h-4 w-4" />
              {c.back}
            </button>
          }
        >
          <button type="button" onClick={() => goTo("enter")} className={primaryButton}>
            {c.apple.next}
            <ArrowRight className="h-4 w-4" />
          </button>
        </StepFooter>
      </>
    );
  } else {
    const backButton = (
      <button
        type="button"
        onClick={() => goTo("apple")}
        disabled={connect.isPending}
        className={secondaryButton}
      >
        <ArrowLeft className="h-4 w-4" />
        {c.back}
      </button>
    );
    body = (
      <>
        <h2 ref={headingRef} tabIndex={-1} className={headingClass}>
          {c.enter.title}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
          {c.enter.body}
        </p>
        {authLoading ? (
          <div className="mt-6 flex justify-center py-6 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : !user ? (
          // Checked before the form rather than after it, so nobody types
          // anything only to be sent off to sign in and lose it.
          <>
            <p className="mt-5 rounded-lg bg-secondary/60 p-3 text-sm text-foreground">
              {c.enter.signInBody}
            </p>
            <StepFooter secondary={backButton}>
              <Link
                to={`/sign-in?next=${encodeURIComponent(`${PATH}?step=enter`)}`}
                className={primaryButton}
              >
                {c.enter.signIn}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </StepFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5 flex max-w-lg flex-col gap-4">
            <AppleCredentialFields
              email={email}
              password={password}
              onEmailChange={setEmail}
              onPasswordChange={setPassword}
              emailHint={c.enter.emailHint}
              passwordHint={c.enter.passwordHint}
            />
            {connect.isError && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  {connect.error instanceof Error ? connect.error.message : t.profile.couldntIcloud}
                </span>
              </div>
            )}
            <p className="text-xs leading-relaxed text-muted-foreground">{c.enter.revoke}</p>
            <StepFooter secondary={backButton}>
              <button type="submit" disabled={connect.isPending} className={primaryButton}>
                {connect.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {connect.isPending ? c.enter.connecting : c.enter.connect}
              </button>
            </StepFooter>
          </form>
        )}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      {/* A size wider than the other guides, so the drawing of Apple's pages
          on the watch step is big enough to read on a laptop. */}
      <main className="mx-auto max-w-3xl px-4 pb-16 pt-4 sm:px-6 sm:pb-20 sm:pt-6">
        <Link
          to="/profile"
          className="flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t.calendarView.back}
        </Link>

        <p className="mt-4 text-sm font-semibold uppercase tracking-wide text-primary">{c.eyebrow}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {c.title}
        </h1>

        {/* Where you are. The finish needs no number: every bar is full. */}
        <div className="mt-5">
          {view !== "done" && (
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {c.progress(stepIndex + 1, STEPS.length)}
            </p>
          )}
          <div className="mt-2 flex gap-1.5" aria-hidden="true">
            {STEPS.map((s, i) => (
              <span
                key={s}
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-colors",
                  view === "done" || i <= stepIndex ? "bg-primary" : "bg-secondary",
                )}
              />
            ))}
          </div>
        </div>

        {/* Keyed on the view, so each step fades in fresh (and its fields
            and heading are new elements, which the focus handling relies on). */}
        <motion.section
          key={view}
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="mt-5 rounded-2xl border bg-card p-5 shadow-sm sm:p-7"
        >
          {body}
        </motion.section>
      </main>
    </div>
  );
}
