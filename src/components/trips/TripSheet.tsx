import { useMemo, useState, type ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
import { Bus, CalendarCheck, Plane, TrainFront } from "lucide-react";

import DayPicker from "@/components/trips/DayPicker";
import BottomSheet from "@/components/ui/BottomSheet";
import FlowButton from "@/components/ui/FlowButton";
import type { Trips } from "@/hooks/useTrips";
import { LOCALE, useLang, useT } from "@/i18n/lang";
import { formatDate, formatTime } from "@/lib/format";
import { dayOptions, type Leg } from "@/lib/trips";
import { cityName, tripMarks, type TripMark } from "@/lib/tripView";
import { APP_TIME_ZONE, startOfDay } from "@/lib/zone";

const TZ = APP_TIME_ZONE;

const MODE_ICON = { flight: Plane, train: TrainFront, bus: Bus } as const;

/**
 * What Casy found about a trip (#115), opened by a tap on its bar in My
 * calendar: the journeys it read and the time away they make, with yes or
 * no; or, where the legs don't pair, a question answered with a tap on a day
 * or a city. Saying no or deleting closes the sheet. Every other answer keeps
 * it open on the same trip as it now is: where home is leads to the real
 * question, and a yes or a day picked to the trip accepted, with "Put it in my
 * calendar" right there.
 */
export default function TripSheet({
  mark: opened,
  open,
  onClose,
  trips,
}: {
  /** What to show; kept while the sheet slides away. */
  mark: TripMark | null;
  open: boolean;
  onClose: () => void;
  trips: Trips;
}) {
  const t = useT();
  const words = t.trips;
  const { lang } = useLang();
  // Which days to offer: fixed while the sheet is open.
  const [now] = useState(() => Date.now());
  // The trip as it is now, by its id: after an answer that doesn't settle it
  // (home), the same trip comes back as its next question. Once it is gone
  // (declined), what was opened is shown while the sheet slides away.
  const live = useMemo(
    () => (opened ? tripMarks(trips.detected, lang).find((m) => m.id === opened.id) : undefined),
    [opened, trips.detected, lang],
  );
  const mark = live ?? opened;

  const at = (ms: number) =>
    words.at(formatDate(new Date(ms).toISOString(), lang), formatTime(new Date(ms).toISOString()));
  const answer = (act: () => void) => {
    act();
    onClose();
  };

  let title = "";
  let body: ReactNode = null;
  if (mark?.kind === "trip") {
    const { trip } = mark;
    // A day the person answered ends at midnight: say the day, not 00:00.
    const end =
      startOfDay(trip.end, TZ) === trip.end
        ? formatDate(new Date(trip.end - 1).toISOString(), lang)
        : at(trip.end);
    title = words.title(mark.city);
    body = (
      <>
        <p className="mb-3 text-[15px] text-muted-foreground">{words.found}</p>
        <LegList legs={trip.legs} at={at} />
        <p className="mb-2 mt-4 text-[15px] font-semibold text-foreground">
          {/* A date ending the sentence may end in its own period ("8. nov."): one is enough. */}
          {words.away(at(trip.start), end.replace(/\.$/, ""))}
        </p>
        {trip.accepted ? (
          <>
            <p className="mb-4 text-sm text-muted-foreground">{words.acceptedNote}</p>
            <AddToPhoneCalendar key={mark.id} mark={mark} trips={trips} />
            <SecondaryButton onClick={() => answer(() => trips.decline(mark.id))}>
              {words.remove}
            </SecondaryButton>
          </>
        ) : (
          <>
            <p className="mb-4 text-sm text-muted-foreground">{words.acceptNote}</p>
            <PrimaryButton onClick={() => trips.accept(mark.id)}>{words.accept}</PrimaryButton>
            <SecondaryButton onClick={() => answer(() => trips.decline(mark.id))}>
              {words.decline}
            </SecondaryButton>
          </>
        )}
      </>
    );
  } else if (mark?.kind === "question") {
    const { question } = mark;
    const legs = question.legs;
    if (question.kind === "home") {
      title = words.homeTitle;
      body = (
        <>
          {/* The answer first, then what it is about. */}
          <div className="mb-4 flex flex-col gap-2">
            {question.cities.map((city) => (
              <PrimaryButton key={city} onClick={() => trips.setHome(city)}>
                {cityName(city, legs, lang)}
              </PrimaryButton>
            ))}
          </div>
          <LegList legs={legs} at={at} />
          <p className="mt-3 text-sm text-muted-foreground">{words.homeIntro}</p>
          <SecondaryButton onClick={() => answer(() => trips.decline(mark.id))}>
            {words.noneOfThem}
          </SecondaryButton>
        </>
      );
    } else {
      const back = question.kind === "return";
      title = back ? words.returnTitle(mark.city) : words.outboundTitle(mark.city);
      body = (
        <DayQuestion
          // A fresh pick for every question.
          key={mark.id}
          legs={legs}
          back={back}
          days={dayOptions(question, now)}
          at={at}
          onPick={(day) =>
            back ? trips.answerReturn(mark.id, day) : trips.answerOutbound(mark.id, day)
          }
          onNotATrip={() => answer(() => trips.decline(mark.id))}
        />
      );
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={title} doneLabel={t.swipe.done}>
      {body}
    </BottomSheet>
  );
}

/**
 * When the person is back (or left): the journey, why Casy asks, a month to
 * tap the day on, and a button that says the day picked before it is saved.
 */
function DayQuestion({
  legs,
  back,
  days,
  at,
  onPick,
  onNotATrip,
}: {
  legs: Leg[];
  /** Asking when they are back; otherwise when they left. */
  back: boolean;
  days: number[];
  at: (ms: number) => string;
  onPick: (day: number) => void;
  onNotATrip: () => void;
}) {
  const words = useT().trips;
  const { lang } = useLang();
  const [picked, setPicked] = useState<number | null>(null);
  // The journey's own day: where the stretch away starts (or, asked when they left, ends).
  const journey = startOfDay(back ? legs[0].start : legs[legs.length - 1].start, TZ);
  const dayName = (day: number) =>
    new Date(day).toLocaleDateString(LOCALE[lang], {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: TZ,
    });
  return (
    <>
      <LegList legs={legs} at={at} />
      <p className="mb-4 mt-3 text-sm text-muted-foreground">
        {back ? words.returnIntro : words.outboundIntro}
      </p>
      <DayPicker allowed={days} journey={journey} selected={picked} onSelect={setPicked} />
      <div className="mt-4">
        <PrimaryButton disabled={picked === null} onClick={() => picked !== null && onPick(picked)}>
          {picked === null
            ? words.pickDay
            : back
              ? words.confirmReturn(dayName(picked))
              : words.confirmOutbound(dayName(picked))}
        </PrimaryButton>
      </div>
      <SecondaryButton onClick={onNotATrip}>{words.notATrip}</SecondaryButton>
    </>
  );
}

/**
 * "Put it in my calendar" (#115): an accepted trip written into the phone's own
 * calendar, so it is there for good, in Apple Calendar and in everything Casy
 * reads from it. Once it is, the button says so instead.
 */
function AddToPhoneCalendar({ mark, trips }: { mark: TripMark; trips: Trips }) {
  const words = useT().trips;
  const add = useMutation({ mutationFn: () => trips.addToCalendar(mark) });
  const inCalendar = mark.kind === "trip" && mark.trip.inCalendar;
  if (inCalendar) {
    return (
      <p className="flex h-12 items-center justify-center gap-2 text-[15px] font-semibold text-emerald-600">
        <CalendarCheck className="h-5 w-5" aria-hidden />
        {add.data ? words.addedTo(add.data) : words.inCalendar}
      </p>
    );
  }
  return (
    <>
      <PrimaryButton disabled={add.isPending} onClick={() => add.mutate()}>
        {add.isPending ? words.adding : words.addToCalendar}
      </PrimaryButton>
      {add.error && <p className="mt-2 text-center text-sm text-red-600">{add.error.message}</p>}
    </>
  );
}

/** The journeys read from the calendar: how, from where to where, and when. */
function LegList({ legs, at }: { legs: Leg[]; at: (ms: number) => string }) {
  const words = useT().trips;
  const { lang } = useLang();
  return (
    <ul className="divide-y rounded-xl border">
      {legs.map((leg) => {
        const Icon = MODE_ICON[leg.mode];
        return (
          <li key={leg.id} className="flex items-start gap-3 px-3 py-2.5">
            <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
            <div className="min-w-0">
              <p className="text-[15px] font-medium text-foreground">
                {words.modes[leg.mode]}:{" "}
                {words.route(cityName(leg.from, legs, lang), cityName(leg.to, legs, lang))}
              </p>
              <p className="text-sm text-muted-foreground">{at(leg.start)}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function PrimaryButton({
  onClick,
  disabled = false,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  // The main glass capsule (CLAUDE.md, Design language, #153).
  return (
    <FlowButton onClick={onClick} disabled={disabled}>
      {children}
    </FlowButton>
  );
}

function SecondaryButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-2 h-12 w-full rounded-full text-[15px] font-semibold text-primary"
    >
      {children}
    </button>
  );
}
