import { useId, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, Loader2 } from "lucide-react";
import { SiApple } from "react-icons/si";

import AddAccountDemo from "@/components/calendarView/AddAccountDemo";
import OnlyTimesDemo from "@/components/calendarView/OnlyTimesDemo";
import { PROVIDER_BRANDS } from "@/components/calendarProviders";
import { useCalendarsHome } from "@/hooks/useCalendarsHome";
import type { usePhoneImport } from "@/hooks/usePhoneImport";
import { useT } from "@/i18n/lang";
import { CONNECT_PARAM } from "@/lib/calendarPrompt";
import { openPhoneSettings } from "@/lib/phoneCalendar";
import { cn } from "@/lib/utils";

type Import = ReturnType<typeof usePhoneImport>;

/** The step's screens: the ask itself, the other calendars, and how to add one's account to the iPhone. */
type View = "ask" | "others" | "google" | "outlook";

/** A full-width capsule, as tall as the app's main buttons. */
const BUTTON =
  "flex h-14 w-full items-center justify-center gap-2.5 rounded-full text-[1.0625rem] font-semibold transition active:scale-[0.98] disabled:opacity-60";
/** Apple's own look, as Sign in with Apple has it: black, white in dark mode. */
const APPLE = `${BUTTON} bg-black text-white dark:bg-white dark:text-black`;
/** The second choice: grey. */
const GREY = `${BUTTON} bg-secondary text-foreground`;
/** Another calendar, by its mark: the Apple button's shape on the page's own ground. */
const BRAND = `${BUTTON} border bg-card text-foreground`;

/**
 * What the iPhone app says when this phone isn't connected (#132): a step
 * that takes the whole screen (#261: as a sheet it read as one more pop-up,
 * and was closed by reflex, leaving a friend with no calendar and no idea
 * where to connect one). It shows rather than tells (OnlyTimesDemo: events
 * lose their names on the way to Casy) and has two ways on: Apple's calendar,
 * drawn as Apple's own button, and "Andre kalendere" in grey.
 *
 * The other calendars are by their marks. Google and Outlook are not signed
 * in to from the app (calendarProviders.ts): the phone's calendars hold any
 * account added to the iPhone, so each shows how to add it there
 * (AddAccountDemo, an iPhone playing the way through Indstillinger) and "Det
 * har jeg gjort" reads the phone as the Apple button does. A calendar link is
 * the calendars page's own form.
 *
 * Before iOS has asked, every way on ends at iOS's own question, where the
 * person answers (App Store guideline 5.1.1(iv), #147): no "Ikke nu", and no
 * calendar link, which would leave without it. After that answer the step
 * can be put away ("Ikke nu"), until the app is opened again; refused, the
 * Apple button leads to Settings.
 */
export default function PhoneCalendarAccess({
  phone,
  open,
  onNotNow,
}: {
  phone: Import;
  open: boolean;
  onNotNow: () => void;
}) {
  const t = useT();
  const words = t.phoneCalendar;
  const home = useCalendarsHome();
  const reduce = useReducedMotion();
  const titleId = useId();
  const [view, setView] = useState<View>("ask");
  const { access, importing, outcome, error } = phone;
  const denied = access === "denied" || outcome?.state === "denied";
  const beforeIos = access === "prompt" && !denied;

  // What the last press came to, under the picture.
  const note = error
    ? error
    : outcome?.state === "synced" && outcome.calendars === 0
      ? words.nothingOnPhone
      : outcome && outcome.state !== "synced" && outcome.state !== "denied"
        ? words.couldntRead
        : null;
  const read = denied ? () => void openPhoneSettings() : phone.importNow;
  const busy = importing && <Loader2 aria-hidden className="h-5 w-5 animate-spin" />;
  const account = view === "google" || view === "outlook" ? view : null;
  const accountName = account ? words.addAccount.accounts[account] : "";
  const title =
    view === "ask"
      ? words.stepTitle
      : view === "others"
        ? words.others
        : words.addAccount.title(accountName);

  let picture: ReactNode;
  let ways: ReactNode;
  if (account) {
    picture = (
      <>
        <AddAccountDemo account={account} />
        <p className="sr-only">{words.addAccount.spoken(accountName)}</p>
      </>
    );
    ways = (
      <button type="button" onClick={read} disabled={importing} className={APPLE}>
        {busy}
        {denied ? words.openSettings : words.addAccount.done}
      </button>
    );
  } else if (view === "others") {
    picture = null;
    ways = (
      <>
        <button type="button" onClick={() => setView("google")} className={BRAND}>
          {PROVIDER_BRANDS.google.icon}
          {words.googleCalendar}
        </button>
        <button type="button" onClick={() => setView("outlook")} className={BRAND}>
          {PROVIDER_BRANDS.outlook.icon}
          {t.calendarView.providerNames.outlook}
        </button>
        {/* Leaves without iOS's question: only once it has been answered. */}
        {!beforeIos && (
          <Link to={`${home.to}?${CONNECT_PARAM}=ics`} className={BRAND}>
            {PROVIDER_BRANDS.ics.icon}
            {t.calendarView.providerNames.ics}
          </Link>
        )}
      </>
    );
  } else {
    picture = (
      <>
        <OnlyTimesDemo />
        <p className="sr-only">
          {words.needBody}
          {beforeIos && ` ${words.needAsk}`}
        </p>
      </>
    );
    ways = (
      <>
        <button type="button" onClick={read} disabled={importing} className={APPLE}>
          {importing ? busy : <SiApple aria-hidden className="h-5 w-5" />}
          {denied ? words.openSettings : importing ? words.importing : words.appleCalendar}
        </button>
        <button type="button" onClick={() => setView("others")} className={GREY}>
          {words.others}
        </button>
      </>
    );
  }

  return createPortal(
    <AnimatePresence onExitComplete={() => setView("ask")}>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: 32 }}
          transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
          className="fixed inset-0 z-50 flex flex-col bg-background px-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-[max(env(safe-area-inset-top),0.75rem)]"
        >
          {/* Back on the left, Ikke nu on the right, each only when it leads somewhere. */}
          <div className="flex h-11 items-center justify-between">
            {view === "ask" ? (
              <span />
            ) : (
              <button
                type="button"
                onClick={() => setView(account ? "others" : "ask")}
                className="hit -ml-1.5 flex items-center text-[1.0625rem] font-semibold text-primary"
              >
                <ChevronLeft aria-hidden className="h-5 w-5" />
                {words.back}
              </button>
            )}
            {!beforeIos && (
              <button
                type="button"
                onClick={onNotNow}
                className="hit text-[1.0625rem] font-semibold text-primary"
              >
                {words.notNow}
              </button>
            )}
          </div>

          <div className="flex min-h-0 flex-1 flex-col justify-center overflow-y-auto py-4">
            <h1
              id={titleId}
              className="mb-6 text-balance text-center text-[1.75rem] font-bold leading-tight text-foreground"
            >
              {title}
            </h1>
            {picture}
            {denied && (
              <p className="mt-4 px-1 text-center text-[0.9375rem] text-muted-foreground">
                {words.denied}
              </p>
            )}
            {note && <p className="mt-3 px-1 text-center text-[0.8125rem] text-red-600">{note}</p>}
          </div>

          <div className={cn("flex flex-col gap-3", view === "others" && "pb-2")}>{ways}</div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
