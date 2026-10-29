import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { CalendarPlus, ChevronRight, Layers, Plane, Plus } from "lucide-react";

import DayPanel from "@/components/calendarView/DayPanel";
import AgreedCard from "@/components/calendarView/AgreedCard";
import CasyDayRow from "@/components/calendarView/CasyDayRow";
import HomeBar from "@/components/calendarView/HomeBar";
import HomeVote from "@/components/calendarView/HomeVote";
import { useHomeVotes } from "@/components/calendarView/useHomeVotes";
import VotePill from "@/components/calendarView/VotePill";
import PhoneCalendarAccess from "@/components/calendarView/PhoneCalendarAccess";
import { DayRow } from "@/components/calendarView/DayRow";
import CalendarListPanel from "@/components/CalendarListPanel";
import TopNav from "@/components/TopNav";
import DanishTimeNote from "@/components/time/DanishTimeNote";
import Celebration from "@/components/swipe/Celebration";
import MonthView, { type MonthViewHandle } from "@/components/swipe/MonthView";
import BottomSheet from "@/components/ui/BottomSheet";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import Notice from "@/components/ui/Notice";
import { useAiAllowed } from "@/hooks/useAiAllowed";
import { useCalendarsHome } from "@/hooks/useCalendarsHome";
import { useFillViewport } from "@/hooks/useFillViewport";
import { useGlassTop } from "@/hooks/useGlassTop";
import { useMyCalendarView } from "@/hooks/useMyCalendarView";
import { useStatusTap } from "@/hooks/useStatusTap";
import { usePhoneImport } from "@/hooks/usePhoneImport";
import { tripReveal, useGuessStep, useTrips } from "@/hooks/useTrips";
import { eventTitle } from "@/i18n/eventTitle";
import type { VoteEvent } from "@/lib/vote";
import { useLang, useT } from "@/i18n/lang";
import { capitalize, dayLabel } from "@/lib/format";
import { useHomeBarFlight } from "@/lib/homeBar";
import { isNativeApp } from "@/lib/nativeApp";
import { cn } from "@/lib/utils";
import {
  isPending,
  markOn,
  revealDay,
  tripBars,
  tripMarks,
  withoutTripsInCalendar,
  type TripMark,
} from "@/lib/tripView";
import { APP_TIME_ZONE, startOfDay } from "@/lib/zone";
import { useOnceTrue } from "@/hooks/useOnceTrue";

// Sheets fetched the first time they open (#157).
const TellCasySheet = lazy(() => import("@/components/tellCasy/TellCasySheet"));
const TripSheet = lazy(() => import("@/components/trips/TripSheet"));
// The home page's sheets (#169). Each is put on the page, closed, ahead of
// its first press (see below): a lazy component waits for its code on its
// first render, and React then holds back what it shows by up to 300 ms,
// which would leave the press with nothing to grow out of the button.
const EventsSheet = lazy(() => import("@/components/myEvents/phone/EventsSheet"));
const ProfileSheet = lazy(() => import("@/components/profile/ProfileSheet"));

const TZ = APP_TIME_ZONE;

/** The little room the app's pages leave under the clock (PhoneHeader's h-2). */
const APP_TOP_GAP = "0.5rem";

// Planning from here (#126) brings the whole scheduler with it: put on the
// page only once a finger touches Planlæg.
const PlanFromCalendar = lazy(() => import("@/components/planFromCalendar/PlanFromCalendar"));

/**
 * The phone's home page (#169), My calendar: your busy time as Apple
 * Calendar's month view, the same one the swipe screen opens, so it reads as
 * the calendar already on the phone. It fills the screen under the header and
 * scrolls month by month inside itself, with Aftaler, Planlæg and the profile
 * floating along the bottom (HomeBar). A tap on a day lists what is busy on
 * it in a panel along the bottom (DayPanel), the month still live behind it;
 * "Kalendere" opens the list of calendars (what counts, its category and how
 * much it matters) in a sheet, instead of leaving it under the month.
 */
/** How long after the home page opens its small sheets are fetched. */
const SHEETS_AFTER_MS = 1500;

/** "Not now" on the import card (#132), kept until the app is opened again. */
const phoneImportPutAway = { done: false };

export default function PhoneCalendar() {
  const t = useT();
  const { lang } = useLang();
  const words = t.calendarView;
  const calendarsHome = useCalendarsHome();
  // In the app the months scroll under the clock too (the header's glass).
  useGlassTop();
  const {
    calendar,
    calendars,
    calendarById,
    entries,
    connectedCount,
    setCalendarsVisible,
    visibilityError,
  } = useMyCalendarView();
  // The app offers to import the phone's calendar until this phone is connected (#132).
  // The server's own list (the holidays the page adds aren't in it).
  const phoneImport = usePhoneImport(
    calendar.loading || calendar.error ? null : calendar.calendars,
  );
  // "Not now", for someone who has other calendars: until the app is opened again.
  const [importLater, setImportLater] = useState(() => phoneImportPutAway.done);
  // Trips Casy found (#115, the app only): bars on the month, asking until answered.
  const trips = useTrips();
  // An accepted trip already in the calendar as an event is shown once, as that event.
  const marks = useMemo(
    () => withoutTripsInCalendar(tripMarks(trips.detected, lang), calendar.items),
    [trips.detected, lang, calendar.items],
  );
  // Bars of trips Casy is asking about change length with each pulse.
  const step = useGuessStep(marks.some((m) => m.kind === "question"));
  // The first time My calendar opens with something waiting, it glides there
  // (and on to the next one as each is answered); "I dag" stops it.
  const [mayReveal] = useState(() => !tripReveal.done);
  const [todayPressed, setTodayPressed] = useState(false);
  const reveal = mayReveal && !todayPressed ? revealDay(marks) : null;
  useEffect(() => {
    if (reveal !== null) tripReveal.done = true;
  }, [reveal]);
  const [tripMark, setTripMark] = useState<TripMark | null>(null);
  const [tripOpen, setTripOpen] = useState(false);
  const tripWanted = useOnceTrue(tripOpen);
  const openTrip = useCallback((mark: TripMark) => {
    setTripMark(mark);
    setTripOpen(true);
  }, []);
  // pickDay stays stable (see below), so it reads the marks through a ref.
  const marksNow = useRef(marks);
  useEffect(() => {
    marksNow.current = marks;
  }, [marks]);

  // Tell Casy (#116): what is in no calendar, for people AI is on for.
  const aiAllowed = useAiAllowed();
  const [tellOpen, setTellOpen] = useState(false);
  const tellButton = useRef<HTMLButtonElement>(null);
  // The calendars sheet is in the address (?calendars), so the back arrow
  // on "Connected calendars" returns to it, not past it to the bare month.
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const listOpen = params.has("calendars");
  // The buttons each sheet grows out of and shrinks back into (#169).
  const listButton = useRef<HTMLButtonElement>(null);
  const eventsButton = useRef<HTMLButtonElement>(null);
  const planButton = useRef<HTMLButtonElement>(null);
  const profileButton = useRef<HTMLButtonElement>(null);
  const openList = () => navigate({ search: "?calendars" }, { state: { fromMonth: true } });
  // The sheets already open as the page appears: back from one of their
  // screens (Grupper, Forbundne kalendere) or a link. Shown in place, not
  // grown out of their button again (#169); forgotten once one is closed.
  const [arrived, setArrived] = useState(() => new Set(params.keys()));
  // Back to the bare month: a step back if this page opened it, else in place.
  const closeOverlay = () => {
    if (arrived.size > 0) setArrived(new Set());
    if ((location.state as { fromMonth?: boolean } | null)?.fromMonth) navigate(-1);
    else navigate({ search: "" }, { replace: true });
  };
  // Planlæg (#126), in the address too, so the phone's back closes it.
  const planOpen = params.has("plan");
  // Planlæg stays on the page until its sheet has shrunk back into the pill
  // (#169), then goes; a new one each time it opens, as before. (Followed as
  // the address changes, React's pattern for a changed value.)
  const [plan, setPlan] = useState({ shown: planOpen, key: 0, was: planOpen });
  if (planOpen !== plan.was) {
    setPlan({
      shown: plan.shown || planOpen,
      key: planOpen ? plan.key + 1 : plan.key,
      was: planOpen,
    });
  }
  // A finger on Planlæg puts the plan on the page, closed, ready for the press.
  const [planTouched, setPlanTouched] = useState(false);
  const planClosed = useCallback(() => {
    setPlan((p) => (p.was ? p : { ...p, shown: false }));
    setPlanTouched(false);
  }, []);
  const openPlan = () => navigate({ search: "?plan" }, { state: { fromMonth: true } });
  // Planlæg's sent dates bring the buttons back, to fly into Aftaler (#169).
  const flight = useHomeBarFlight();
  // Aftaler and the profile, sheets over the home page (#169), in the address
  // too, so /events and /profile can lead here and the back of their screens
  // returns to them.
  const eventsOpen = params.has("events");
  const openEvents = () => navigate({ search: "?events" }, { state: { fromMonth: true } });
  const profileOpen = params.has("profile");
  const openProfile = () => navigate({ search: "?profile" }, { state: { fromMonth: true } });
  // What pickDay (stable, below) needs to know of the votes (#172), set further down.
  const waitingNow = useRef<VoteEvent[]>([]);
  const voteOpenNow = useRef(false);
  const openVoteNow = useRef<(id: string) => void>(() => {});
  const [pickedDay, setPickedDay] = useState<number | null>(null);
  // What the day panel shows while it slides away, after pickedDay is cleared.
  const [panelDay, setPanelDay] = useState(() => startOfDay(Date.now(), TZ));
  // Stable, or every month of the view (memoised) would redraw on each tap.
  // The day already open closes again.
  const pickDay = useCallback(
    (day: number) => {
      // A day of a trip waiting for an answer opens the trip, not the day.
      const mark = markOn(marksNow.current, day);
      if (mark && isPending(mark)) {
        setPickedDay(null);
        openTrip(mark);
        return;
      }
      // While answering, a day opens its hours; otherwise a waiting vote's
      // pencilled date starts answering it.
      const vote = voteOpenNow.current
        ? undefined
        : waitingNow.current.find((v) =>
            v.candidates.some((c) => startOfDay(Date.parse(c.start), TZ) === day),
          );
      if (vote) {
        setPickedDay(null);
        openVoteNow.current(vote.id);
        return;
      }
      setPanelDay(day);
      setPickedDay((open) => (open === day ? null : day));
    },
    [openTrip],
  );
  const closeDay = useCallback(() => setPickedDay(null), []);
  // A tap on the month that isn't on a day (a heading, a blank cell, the
  // weekdays) closes the panel too.
  const onMonthTap = (e: MouseEvent) => {
    if (!(e.target as HTMLElement).closest("[data-day]")) closeDay();
  };

  // The tapped day kept clear of the panel: if the panel would cover it,
  // the months scroll it up above it.
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    if (pickedDay === null) return;
    const frame = requestAnimationFrame(() => {
      const cell = document.querySelector<HTMLElement>(`[data-day="${pickedDay}"]`);
      const sheet = panel.current;
      const scroller = cell?.closest<HTMLElement>(".overflow-y-auto");
      if (!cell || !sheet || !scroller) return;
      const panelTop =
        window.innerHeight - parseFloat(getComputedStyle(sheet).bottom) - sheet.offsetHeight;
      const overlap = cell.getBoundingClientRect().bottom + 8 - panelTop;
      if (overlap > 0) scroller.scrollBy({ top: overlap, behavior: "smooth" });
    });
    return () => cancelAnimationFrame(frame);
  }, [pickedDay]);
  // The month opens on today; "I dag" glides back there, as does a tap at
  // the very top of the screen in the app (#168).
  const [focus] = useState(() => startOfDay(Date.now(), TZ));
  const months = useRef<MonthViewHandle>(null);
  useStatusTap(() => months.current?.glideToTop());
  // Aftaler's and the profile's sheets are small: on the page, closed, once
  // the home page has settled (or a finger touches their button), so they
  // grow out of it at the first press (#169). Planlæg's is big: only on a touch.
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setSettled(true), SHEETS_AFTER_MS);
    return () => window.clearTimeout(id);
  }, []);
  const touched = useMemo(
    () => ({
      events: () => setSettled(true),
      plan: () => setPlanTouched(true),
      profile: () => setSettled(true),
    }),
    [],
  );

  // Casy's own events on the month (#172): the waiting votes' dates
  // pencilled in, the decided ones as chips, a date just agreed flying in.
  const voteId = params.get("vote");
  const homeVotes = useHomeVotes({
    calendar,
    months,
    idle: settled && location.search === "" && pickedDay === null,
  });
  const voteEvent = homeVotes.voteById(voteId);
  const voteOpen = voteEvent !== null;
  const openVote = (id: string) =>
    navigate({ search: `?vote=${id}` }, { state: { fromMonth: true } });
  // HomeVote's callbacks stay the same from render to render, so its timers
  // and effects aren't started over by the page drawing again.
  const closeNow = useRef(closeOverlay);
  useEffect(() => {
    closeNow.current = closeOverlay;
  });
  const closeVote = useCallback(() => closeNow.current(), []);
  const month = useMemo(
    () => ({
      ...calendar,
      colorOf: homeVotes.colorOf,
      items: [
        ...homeVotes.items,
        ...(marks.length === 0 ? [] : tripBars(marks, t.trips, step)),
        ...calendar.items,
      ],
    }),
    [calendar, homeVotes.colorOf, homeVotes.items, marks, t, step],
  );
  // A pencilled date of a waiting vote opens the vote, not the day (pickDay).
  useEffect(() => {
    waitingNow.current = homeVotes.waiting;
    voteOpenNow.current = voteOpen;
  });
  useEffect(() => {
    openVoteNow.current = openVote;
  });

  // The month takes whatever the screen has left under the toolbar.
  const box = useRef<HTMLDivElement>(null);
  const height = useFillViewport(box);

  const goToday = () => {
    // Today, and no longer on to a trip it was about to show.
    setTodayPressed(true);
    months.current?.glideToMonth(Date.now());
  };
  const pickedSegments = calendar.segmentsOn(new Date(panelDay));
  // An accepted trip on the open day: a row on top of the day, to see or delete it.
  const tripToday = markOn(marks, panelDay);
  // Casy's own events on the open day (#172): agreed ones and votes' dates.
  const casyToday = homeVotes.onDay(panelDay);

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      {/* The months fill everything under the page's top, the header drawn
          over them in glass. In the app they reach up behind the clock. */}
      <div
        ref={box}
        style={{
          height: height ?? undefined,
          marginTop: isNativeApp
            ? `calc(-1 * (env(safe-area-inset-top) + ${APP_TOP_GAP}))`
            : undefined,
        }}
        onClick={onMonthTap}
      >
        <MonthView
          handle={months}
          focus={focus}
          calendar={month}
          reveal={reveal}
          selected={pickedDay}
          lit={voteOpen ? homeVotes.view.lit : null}
          stamps={voteOpen ? homeVotes.view.stamps : undefined}
          todayTone="grey"
          onPickDay={pickDay}
          header={
            <>
              <div
                className="flex items-center justify-between px-4 pb-1"
                style={{
                  paddingTop: isNativeApp
                    ? `calc(env(safe-area-inset-top) + ${APP_TOP_GAP})`
                    : "0.5rem",
                }}
              >
                <button
                  ref={listButton}
                  type="button"
                  onClick={openList}
                  // Its sheet drops out of it from the top (#169), standing in for it.
                  className={cn(
                    "glass-pill flex h-10 items-center gap-1.5 rounded-full pl-3.5 pr-4 text-[17px] text-primary transition-opacity duration-200",
                    listOpen && "opacity-0",
                  )}
                >
                  <Layers className="h-5 w-5" />
                  {words.calendarsButton}
                </button>
                {/* One capsule round everything on the right. */}
                <div className="glass-pill flex h-10 items-center rounded-full text-primary">
                  {/* Tell Casy (#116): the plus, left of "I dag". */}
                  {aiAllowed && (
                    <button
                      ref={tellButton}
                      type="button"
                      onClick={() => setTellOpen(true)}
                      aria-label={t.tellCasy.button}
                      title={t.tellCasy.button}
                      className="flex h-10 w-11 items-center justify-center rounded-l-full"
                    >
                      <Plus className="h-6 w-6" strokeWidth={2.25} />
                    </button>
                  )}
                  {aiAllowed && <span aria-hidden className="h-5 w-px bg-primary/30" />}
                  <button
                    type="button"
                    onClick={goToday}
                    className="flex h-10 items-center rounded-full px-4 text-[17px]"
                  >
                    {words.today}
                  </button>
                </div>
              </div>
              <DanishTimeNote className="px-4 pb-1" />

              {calendar.error && (
                <Notice tone="error" className="mx-4 mb-2">
                  <div className="flex items-start justify-between gap-2">
                    {calendar.error.message}
                    <button
                      type="button"
                      onClick={calendar.retry}
                      className="shrink-0 font-medium underline underline-offset-2"
                    >
                      {words.tryAgain}
                    </button>
                  </div>
                </Notice>
              )}
              {calendar.truncated && (
                <Notice tone="warning" className="mx-4 mb-2">
                  {words.truncated}
                </Notice>
              )}
              {/* The website has no phone to ask; the app says it over the month (below). */}
              {calendar.none && !isNativeApp && (
                <Notice tone="info" className="mx-4 mb-2">
                  {words.noCalendars(
                    <Link
                      to={calendarsHome.to}
                      className="font-medium text-foreground underline underline-offset-2"
                    >
                      {words.noCalendarsLink}
                    </Link>,
                  )}
                </Notice>
              )}
            </>
          }
        />
      </div>

      {/* Planning starts from the calendar (#126), beside Aftaler and the
          profile; out of the way while a day or the plan is open. */}
      <HomeBar
        hidden={
          (pickedDay !== null || planOpen || eventsOpen || profileOpen || voteOpen) && !flight
        }
        flight={flight}
        onEvents={openEvents}
        onPlan={openPlan}
        onProfile={openProfile}
        prefetch={touched}
        eventsRef={eventsButton}
        planRef={planButton}
        profileRef={profileButton}
      />
      {homeVotes.waiting.length > 0 && (
        <VotePill
          title={eventTitle(homeVotes.waiting[0].title, t)}
          count={homeVotes.waiting.length}
          hidden={location.search !== "" || pickedDay !== null || flight}
          onOpen={() => openVote(homeVotes.waiting[0].id)}
        />
      )}
      {voteEvent && (
        <HomeVote
          key={voteEvent.id}
          event={voteEvent}
          hidden={pickedDay !== null}
          onShowDay={homeVotes.showDay}
          onView={homeVotes.setView}
          onClose={closeVote}
        />
      )}
      {homeVotes.agreed && (
        <AgreedCard key={homeVotes.agreed.id} event={homeVotes.agreed} onDone={homeVotes.flyIn} />
      )}
      {homeVotes.celebrations > 0 && <Celebration key={homeVotes.celebrations} />}
      {(settled || eventsOpen) && (
        <Suspense fallback={null}>
          <EventsSheet
            open={eventsOpen}
            onClose={closeOverlay}
            origin={eventsButton}
            arrived={arrived.has("events")}
          />
        </Suspense>
      )}
      {(settled || profileOpen) && (
        <Suspense fallback={null}>
          <ProfileSheet
            open={profileOpen}
            onClose={closeOverlay}
            origin={profileButton}
            arrived={arrived.has("profile")}
          />
        </Suspense>
      )}
      {(plan.shown || planTouched) && (
        <Suspense fallback={null}>
          <PlanFromCalendar
            key={plan.key}
            open={planOpen}
            onClose={closeOverlay}
            onClosed={planClosed}
            origin={planButton}
          />
        </Suspense>
      )}

      {phoneImport.on && !importLater && (
        <PhoneCalendarAccess
          phone={phoneImport}
          onNotNow={
            phoneImport.others
              ? () => {
                  phoneImportPutAway.done = true;
                  setImportLater(true);
                }
              : undefined
          }
        />
      )}

      {tripWanted && (
        <Suspense fallback={null}>
          <TripSheet
            mark={tripMark}
            open={tripOpen}
            onClose={() => setTripOpen(false)}
            trips={trips}
          />
        </Suspense>
      )}

      {/* On the page ahead of its first press, like the home page's sheets (#169). */}
      {aiAllowed && (settled || tellOpen) && (
        <Suspense fallback={null}>
          <TellCasySheet
            open={tellOpen}
            onClose={() => setTellOpen(false)}
            kept={entries}
            origin={tellButton}
          />
        </Suspense>
      )}

      <DayPanel
        ref={panel}
        open={pickedDay !== null}
        onClose={closeDay}
        title={capitalize(dayLabel(panelDay, lang))}
        doneLabel={t.swipe.done}
      >
        {tripToday && !isPending(tripToday) && (
          <button
            type="button"
            onClick={() => openTrip(tripToday)}
            className="mb-2 flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left"
          >
            <Plane className="h-5 w-5 shrink-0 text-primary" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-foreground">
              {t.trips.barAccepted(tripToday.city)}
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          </button>
        )}
        {casyToday.length > 0 && (
          <ul className="divide-y">
            {casyToday.map((c) => (
              <CasyDayRow
                key={`${c.event.id}/${c.start}`}
                {...c}
                onOpen={() => {
                  closeDay();
                  if (c.vote) openVote(c.event.id);
                  else openEvents();
                }}
              />
            ))}
          </ul>
        )}
        {pickedSegments.length === 0 && !tripToday && casyToday.length === 0 ? (
          <p className="pb-2 text-sm text-muted-foreground">{words.nothingBusy}</p>
        ) : (
          <ul className="divide-y">
            {pickedSegments.map((seg, i) => (
              <DayRow
                key={i}
                seg={seg}
                calendar={calendarById.get(seg.calendarId)}
                rgb={calendar.colorOf(seg.calendarId)}
              />
            ))}
          </ul>
        )}
      </DayPanel>

      <BottomSheet
        open={listOpen}
        onClose={closeOverlay}
        title={words.calendarsButton}
        doneLabel={t.swipe.done}
        origin={listButton}
        edge="top"
        arrived={arrived.has("calendars")}
      >
        <ListGroup className="mb-4 mt-0">
          <ListRow
            to={calendarsHome.to}
            icon={CalendarPlus}
            label={t.calendarAccounts.row}
            detail={t.calendarAccounts.rowDetail}
            value={calendar.loading ? null : connectedCount}
          />
        </ListGroup>
        <CalendarListPanel
          introInTip
          calendars={calendars}
          colorOf={calendar.colorOf}
          onSetVisible={setCalendarsVisible}
          visibilityError={visibilityError}
        />
      </BottomSheet>
    </div>
  );
}
