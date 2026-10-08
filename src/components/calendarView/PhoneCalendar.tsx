import { useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { CalendarPlus, Layers } from "lucide-react";

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
 * scrolls month by month inside itself; a tap on a day lists what is busy on
 * it in a sheet, and "Kalendere" opens the list of calendars (what counts,
 * its category and how much it matters) in another, instead of leaving it
 * under the month.
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
  // What the day sheet shows while it slides away, after pickedDay is cleared.
  const [sheetDay, setSheetDay] = useState(() => startOfDay(Date.now(), TZ));
  const pickDay = (day: number) => {
    setSheetDay(day);
    setPickedDay(day);
  };
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
  const pickedSegments = calendar.segmentsOn(new Date(sheetDay));

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

        <div className="min-h-0 flex-1">
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

      <BottomSheet
        open={pickedDay !== null}
        onClose={() => setPickedDay(null)}
        title={capitalize(
          new Date(sheetDay).toLocaleDateString(LOCALE[lang], {
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
      </BottomSheet>

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
