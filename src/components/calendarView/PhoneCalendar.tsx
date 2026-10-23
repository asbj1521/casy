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
import { CalendarPlus, CalendarSearch, ChevronRight, Layers, Plane, Plus } from "lucide-react";

import DayPanel from "@/components/calendarView/DayPanel";
import PhoneCalendarAccess from "@/components/calendarView/PhoneCalendarAccess";
import { DayRow } from "@/components/calendarView/DayRow";
import CalendarListPanel from "@/components/CalendarListPanel";
import TellCasySheet from "@/components/tellCasy/TellCasySheet";
import TripSheet from "@/components/trips/TripSheet";
import TopNav from "@/components/TopNav";
import DanishTimeNote from "@/components/time/DanishTimeNote";
import MonthView from "@/components/swipe/MonthView";
import BottomSheet from "@/components/ui/BottomSheet";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import Notice from "@/components/ui/Notice";
import { useAiAllowed } from "@/hooks/useAiAllowed";
import { useCalendarsHome } from "@/hooks/useCalendarsHome";
import { useFillViewport } from "@/hooks/useFillViewport";
import { useMyCalendarView } from "@/hooks/useMyCalendarView";
import { usePhoneImport } from "@/hooks/usePhoneImport";
import { tripReveal, useGuessStep, useTrips } from "@/hooks/useTrips";
import { LOCALE, useLang, useT } from "@/i18n/lang";
import { capitalize } from "@/lib/format";
import { isNativeApp } from "@/lib/nativeApp";
import { isPending, markOn, revealDay, tripBars, tripMarks, type TripMark } from "@/lib/tripView";
import { APP_TIME_ZONE, startOfDay } from "@/lib/zone";

const TZ = APP_TIME_ZONE;

// Planning from here (#126) brings the whole scheduler with it: loaded on the first press.
const PlanFromCalendar = lazy(() => import("@/components/planFromCalendar/PlanFromCalendar"));

/**
 * My calendar on a phone: your busy time as Apple Calendar's month view, the
 * same one the swipe screen opens, so it reads as the calendar already on
 * the phone. It fills the screen between the header and the tab bar and
 * scrolls month by month inside itself. A tap on a day lists what is busy on
 * it in a panel along the bottom (DayPanel), the month still live behind it;
 * "Kalendere" opens the list of calendars (what counts, its category and how
 * much it matters) in a sheet, instead of leaving it under the month.
 */
/** "Not now" on the import card (#132), kept until the app is opened again. */
const phoneImportPutAway = { done: false };

export default function PhoneCalendar() {
  const t = useT();
  const { lang } = useLang();
  const words = t.calendarView;
  const calendarsHome = useCalendarsHome();
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
  const marks = useMemo(() => tripMarks(trips.detected, lang), [trips.detected, lang]);
  // Bars of trips Casy is asking about change length with each pulse.
  const step = useGuessStep(marks.some((m) => m.kind === "question"));
  const month = useMemo(
    () =>
      marks.length === 0
        ? calendar
        : { ...calendar, items: [...tripBars(marks, t.trips, step), ...calendar.items] },
    [calendar, marks, t, step],
  );
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
  // The calendars sheet is in the address (?calendars), so the back arrow
  // on "Connected calendars" returns to it, not past it to the bare month.
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const listOpen = params.has("calendars");
  const openList = () => navigate({ search: "?calendars" }, { state: { fromMonth: true } });
  // Back to the bare month: a step back if this page opened it, else in place.
  const closeOverlay = () => {
    if ((location.state as { fromMonth?: boolean } | null)?.fromMonth) navigate(-1);
    else navigate({ search: "" }, { replace: true });
  };
  // Planlæg (#126), in the address too, so the phone's back closes it.
  const planOpen = params.has("plan");
  const openPlan = () => navigate({ search: "?plan" }, { state: { fromMonth: true } });
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
  // The month opens on today; "I dag" opens it afresh there.
  const [focus, setFocus] = useState(() => startOfDay(Date.now(), TZ));
  const [reopened, setReopened] = useState(0);

  // The month takes whatever the screen has left under the toolbar.
  const box = useRef<HTMLDivElement>(null);
  const height = useFillViewport(box);

  const goToday = () => {
    // Opened afresh on today, not glided back to a trip.
    setTodayPressed(true);
    setFocus(startOfDay(Date.now(), TZ));
    setReopened((n) => n + 1);
  };
  const pickedSegments = calendar.segmentsOn(new Date(panelDay));
  // An accepted trip on the open day: a row on top of the day, to see or delete it.
  const tripToday = markOn(marks, panelDay);

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <div
        ref={box}
        className="flex flex-col"
        style={{
          height: height === null ? undefined : `calc(${height}px - var(--tab-bar-height))`,
        }}
      >
        <div className="flex items-center justify-between px-4 pb-1">
          <button
            type="button"
            onClick={openList}
            className="flex items-center gap-1.5 py-1 text-[17px] text-primary"
          >
            <Layers className="h-5 w-5" />
            {words.calendarsButton}
          </button>
          <div className="flex items-center gap-4">
            {/* Tell Casy (#116): the plus, left of "I dag". */}
            {aiAllowed && (
              <button
                type="button"
                onClick={() => setTellOpen(true)}
                aria-label={t.tellCasy.button}
                title={t.tellCasy.button}
                className="-my-0.5 flex h-8 w-8 items-center justify-center rounded-full text-primary"
              >
                <Plus className="h-6 w-6" strokeWidth={2.25} />
              </button>
            )}
            <button type="button" onClick={goToday} className="py-1 text-[17px] text-primary">
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

        <div className="min-h-0 flex-1" onClick={onMonthTap}>
          <MonthView
            key={reopened}
            focus={focus}
            calendar={month}
            reveal={reveal}
            selected={pickedDay}
            todayTone="grey"
            onPickDay={pickDay}
          />
        </div>
      </div>

      {/* Planning starts from the calendar (#126); out of the way while a day is open. */}
      {pickedDay === null && !planOpen && (
        <button
          type="button"
          onClick={openPlan}
          className="fixed bottom-[calc(var(--tab-bar-height)+0.75rem)] left-1/2 z-20 flex h-12 -translate-x-1/2 items-center gap-2 rounded-full bg-cta px-6 text-[15px] font-bold text-white shadow-[0_8px_24px_-8px_rgba(0,0,0,0.45)] transition hover:bg-cta-hover"
        >
          <CalendarSearch className="h-5 w-5" />
          {t.planFromCalendar.button}
        </button>
      )}
      {planOpen && (
        <Suspense fallback={null}>
          <PlanFromCalendar onClose={closeOverlay} />
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

      <TripSheet mark={tripMark} open={tripOpen} onClose={() => setTripOpen(false)} trips={trips} />

      {aiAllowed && (
        <TellCasySheet open={tellOpen} onClose={() => setTellOpen(false)} kept={entries} />
      )}

      <DayPanel
        ref={panel}
        open={pickedDay !== null}
        onClose={closeDay}
        title={capitalize(
          new Date(panelDay).toLocaleDateString(LOCALE[lang], {
            weekday: "long",
            day: "numeric",
            month: "long",
            timeZone: TZ,
          }),
        )}
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
        {pickedSegments.length === 0 && !tripToday ? (
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
