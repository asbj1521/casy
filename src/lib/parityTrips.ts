import type { Leg } from "@/lib/trips";
import { APP_TIME_ZONE, wallTime } from "@/lib/zone";

/**
 * The journeys the parity build's trips are found in (#281,
 * docs/native-visual-parity.md): the real thing needs the iPhone's own
 * calendars and the AI, which a simulator test has neither of. Only in
 * `VITE_APP_BUILD=parity` (scripts/native/parity-build.sh), never a real
 * build. In October 2026, the parity world's month: a flight to Rome and a
 * train home (a trip to say yes to), a round trip to Oslo (so home is
 * clearly Copenhagen), and a train to Berlin with no way back (asked when
 * you're back).
 */
export function parityLegs(): Leg[] {
  const at = (day: number, hour: number) => wallTime(2026, 9, day, hour, APP_TIME_ZONE);
  const leg = (
    id: string,
    mode: Leg["mode"],
    from: string,
    to: string,
    start: number,
    end: number,
  ): Leg => ({
    id,
    mode,
    from: from.toLowerCase(),
    to: to.toLowerCase(),
    start,
    end,
    count: 1,
    names: { from, to },
  });
  return [
    leg("leg-out", "flight", "Copenhagen", "Rome", at(12, 7), at(12, 10)),
    leg("leg-home", "train", "Rome", "Copenhagen", at(18, 15), at(19, 9)),
    leg("oslo-out", "flight", "Copenhagen", "Oslo", at(2, 8), at(2, 9)),
    leg("oslo-home", "flight", "Oslo", "Copenhagen", at(4, 18), at(4, 19)),
    leg("berlin-out", "train", "Copenhagen", "Berlin", at(26, 8), at(26, 15)),
  ];
}
