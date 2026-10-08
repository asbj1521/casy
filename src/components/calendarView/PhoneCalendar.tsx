import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { CalendarPlus, Layers } from "lucide-react";

import DayPanel from "@/components/calendarView/DayPanel";
import { DayRow } from "@/components/calendarView/DayRow";
import CalendarListPanel from "@/components/CalendarListPanel";
import TopNav from "@/components/TopNav";
import DanishTimeNote from "@/components/time/DanishTimeNote";
import MonthView from "@/components/swipe/MonthView";
import BottomSheet from "@/components/ui/BottomSheet";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import Notice from "@/components/ui/Notice";
import { useCalendarVisibility } from "@/hooks/useCalendarVisibility";
import { useCalendarsHome } from "@/hooks/useCalendarsHome";
import { useFillViewport } from "@/hooks/useFillViewport";
import { useMyCalendarDays } from "@/hooks/useMyCalendarDays";
import { LOCALE, useLang, useT } from "@/i18n/lang";
import { HOLIDAY_CALENDAR, HOLIDAY_CALENDAR_ID, holidaysInYearAhead } from "@/lib/calendarOverview";
import { capitalize } from "@/lib/format";
import { APP_TIME_ZONE, startOfDay } from "@/lib/zone";

const TZ = APP_TIME_ZONE;

/**
 * My calendar on a phone: your busy time as Apple Calendar's month view, the
 * same one the swipe screen opens, so it reads as the calendar already on
 * the phone. It fills the screen between the header and the tab bar and
 * scrolls month by month inside itself. A tap on a day lists what is busy on
 * it in a panel along the bottom (DayPanel), the month still live behind it;
 * "Kalendere" opens the list of calendars (what counts, its category and how
 * much it matters) in a sheet, instead of leaving it under the month.
 */
export default function PhoneCalendar() {
  const t = useT();
  const { lang } = useLang();
  const words = t.calendarView;
  const calendarsHome = useCalendarsHome();
  const mine = useMyCalendarDays();
  const { holidaysHidden, setCalendarsVisible, error: visibilityError } = useCalendarVisibility();
  // The calendars sheet is in the address (?calendars), so the back arrow
  // on "Connected calendars" returns to it, not past it to the bare month.
  const location = useLocation();
  const navigate = useNavigate();
  const listOpen = new URLSearchParams(location.search).has("calendars");
  const openList = () => navigate({ search: "?calendars" }, { state: { fromMonth: true } });
  const closeList = () => {
    if ((location.state as { fromMonth?: boolean } | null)?.fromMonth) navigate(-1);
    else navigate({ search: "" }, { replace: true });
  };
  const [pickedDay, setPickedDay] = useState<number | null>(null);
  // What the day panel shows while it slides away, after pickedDay is cleared.
  const [panelDay, setPanelDay] = useState(() => startOfDay(Date.now(), TZ));
  // Stable, or every month of the view (memoised) would redraw on each tap.
  // The day already open closes again.
  const pickDay = useCallback((day: number) => {
    setPanelDay(day);
    setPickedDay((open) => (open === day ? null : day));
  }, []);
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

  // The holiday calendar's tick only hides it here, as on a computer.
  const calendar = useMemo(
    () => ({
      ...mine,
      items: holidaysHidden
        ? mine.items.filter((i) => i.calendarId !== HOLIDAY_CALENDAR_ID)
        : mine.items,
      segmentsOn: (date: Date) =>
        mine
          .segmentsOn(date)
          .filter((s) => !(holidaysHidden && s.calendarId === HOLIDAY_CALENDAR_ID)),
    }),
    [mine, holidaysHidden],
  );
  const holidayCount = useMemo(() => holidaysInYearAhead(TZ), []);
  const calendars = useMemo(
    () => [
      {
        ...HOLIDAY_CALENDAR,
        name: words.holidayCalendar,
        total: holidayCount,
        included: !holidaysHidden,
      },
      ...mine.calendars,
    ],
    [mine.calendars, words.holidayCalendar, holidayCount, holidaysHidden],
  );
  const calendarById = useMemo(() => new Map(calendars.map((c) => [c.id, c])), [calendars]);

  // The month takes whatever the screen has left under the toolbar.
  const box = useRef<HTMLDivElement>(null);
  const height = useFillViewport(box);

  const goToday = () => {
    setFocus(startOfDay(Date.now(), TZ));
    setReopened((n) => n + 1);
  };
  const pickedSegments = calendar.segmentsOn(new Date(panelDay));

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
          <button type="button" onClick={goToday} className="py-1 text-[17px] text-primary">
            {words.today}
          </button>
        </div>
        <DanishTimeNote className="px-4 pb-1" />

        {mine.error && (
          <Notice tone="error" className="mx-4 mb-2">
            <div className="flex items-start justify-between gap-2">
              {mine.error.message}
              <button
                type="button"
                onClick={mine.retry}
                className="shrink-0 font-medium underline underline-offset-2"
              >
                {words.tryAgain}
              </button>
            </div>
          </Notice>
        )}
        {mine.truncated && (
          <Notice tone="warning" className="mx-4 mb-2">
            {words.truncated}
          </Notice>
        )}
        {mine.none && (
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
            calendar={calendar}
            selected={pickedDay}
            todayTone="grey"
            onPickDay={pickDay}
          />
        </div>
      </div>

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
        {pickedSegments.length === 0 ? (
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
        onClose={closeList}
        title={words.calendarsButton}
        doneLabel={t.swipe.done}
      >
        <ListGroup className="mb-4 mt-0">
          <ListRow
            to={calendarsHome.to}
            icon={CalendarPlus}
            label={t.calendarAccounts.row}
            detail={t.calendarAccounts.rowDetail}
            value={mine.loading ? null : mine.calendars.length}
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
