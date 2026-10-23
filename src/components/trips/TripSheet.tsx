import { useState, type ReactNode } from "react";
import { Bus, Plane, TrainFront } from "lucide-react";

import BottomSheet from "@/components/ui/BottomSheet";
import type { Trips } from "@/hooks/useTrips";
import { LOCALE, useLang, useT } from "@/i18n/lang";
import { capitalize, formatDate, formatTime } from "@/lib/format";
import { dayOptions, type Leg } from "@/lib/trips";
import { cityName, type TripMark } from "@/lib/tripView";
import { APP_TIME_ZONE, startOfDay } from "@/lib/zone";

const TZ = APP_TIME_ZONE;

const MODE_ICON = { flight: Plane, train: TrainFront, bus: Bus } as const;

/**
 * What Casy found about a trip (#115), opened by a tap on its bar in My
 * calendar: the journeys it read and the time away they make, with yes or
 * no; or, where the legs don't pair, a question answered with a tap on a day
 * or a city. Every answer closes the sheet; the month redraws from it.
 */
export default function TripSheet({
  mark,
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
          {words.away(at(trip.start), end)}
        </p>
        {trip.accepted ? (
          <>
            <p className="mb-4 text-sm text-muted-foreground">{words.acceptedNote}</p>
            <SecondaryButton onClick={() => answer(() => trips.decline(mark.id))}>
              {words.remove}
            </SecondaryButton>
          </>
        ) : (
          <>
            <p className="mb-4 text-sm text-muted-foreground">{words.acceptNote}</p>
            <PrimaryButton onClick={() => answer(() => trips.accept(mark.id))}>
              {words.accept}
            </PrimaryButton>
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
          <p className="mb-3 text-[15px] text-muted-foreground">{words.homeIntro}</p>
          <LegList legs={legs} at={at} />
          <div className="mt-4 flex flex-wrap gap-2">
            {question.cities.map((city) => (
              <Chip key={city} onClick={() => answer(() => trips.setHome(city))}>
                {cityName(city, legs, lang)}
              </Chip>
            ))}
          </div>
          <SecondaryButton onClick={() => answer(() => trips.decline(mark.id))}>
            {words.noneOfThem}
          </SecondaryButton>
        </>
      );
    } else {
      const back = question.kind === "return";
      title = back ? words.returnTitle(mark.city) : words.outboundTitle(mark.city);
      const days = dayOptions(question, now);
      body = (
        <>
          <p className="mb-3 text-[15px] text-muted-foreground">
            {back ? words.returnIntro : words.outboundIntro}
          </p>
          <LegList legs={legs} at={at} />
          <p className="mb-2 mt-4 text-[15px] font-semibold text-foreground">{words.pickDay}</p>
          <div className="flex flex-wrap gap-2">
            {days.map((day) => (
              <Chip
                key={day}
                onClick={() =>
                  answer(() =>
                    back ? trips.answerReturn(mark.id, day) : trips.answerOutbound(mark.id, day),
                  )
                }
              >
                {capitalize(
                  new Date(day).toLocaleDateString(LOCALE[lang], {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    timeZone: TZ,
                  }),
                )}
              </Chip>
            ))}
          </div>
          <SecondaryButton onClick={() => answer(() => trips.decline(mark.id))}>
            {words.notATrip}
          </SecondaryButton>
        </>
      );
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={title} doneLabel={t.swipe.done}>
      {body}
    </BottomSheet>
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

function Chip({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border bg-background px-3.5 py-2 text-[15px] font-medium text-foreground active:bg-muted"
    >
      {children}
    </button>
  );
}

function PrimaryButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-2 h-12 w-full rounded-full bg-cta text-[15px] font-bold text-white transition hover:bg-cta-hover"
    >
      {children}
    </button>
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
