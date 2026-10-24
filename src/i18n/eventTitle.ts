import type { Messages } from "@/i18n/da";

type EventTypeId = keyof Messages["eventTypes"];

/**
 * Each event type's English name, as events store it (below). A copy of
 * en.tsx's eventTypes, so reading a title never waits for English to load
 * (#157); eventTitle.test.ts keeps the two equal. Never change a name: events
 * already stored with it would stop being translated.
 */
export const STORED_TITLES: Record<EventTypeId, string> = {
  evening: "Evening",
  lunch: "Lunch",
  dinner: "Dinner",
  gaming: "Gaming",
  nightout: "Night out",
  weekend: "Weekend trip",
  vacation: "Vacation",
  meeting: "Hangout",
};

/**
 * English names an event type had before, still found on events suggested
 * back then: "Gaming session" became "Gaming" to fit the scheduling panel.
 */
const FORMER_NAMES: Record<string, EventTypeId> = { "Gaming session": "gaming" };

/**
 * A suggested event stores its type's English name as its title ("Evening"),
 * whoever suggested it, so everyone in a mixed group reads the same event in
 * their own language. Any other title is shown as it was written.
 */
export function eventTitle(stored: string, t: Messages): string {
  const id =
    (Object.keys(STORED_TITLES) as EventTypeId[]).find((k) => STORED_TITLES[k] === stored) ??
    FORMER_NAMES[stored];
  return id ? t.eventTypes[id] : stored;
}

/** The title to store for an event type: its English name, see above. */
export function storedEventTitle(id: EventTypeId): string {
  return STORED_TITLES[id];
}
