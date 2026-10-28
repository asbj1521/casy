/**
 * What each notification says (#139), in Danish and English, and where a tap
 * on it leads in the app. No emojis and no dashes, as everywhere on the site.
 * Names are the ones people wrote (the event, the group, who did it), shown
 * as written; without one the sentence says "someone".
 */
import type { PushMessage } from "./apns.ts";

export type PushKind =
  "vote_invited" | "vote_decided" | "event_changed" | "group_invitation" | "deadline_near";

export type PushTopic =
  | "invited"
  | "decided"
  | "no_date"
  | "choose"
  | "reopened"
  | "moved"
  | "cancelled"
  | "group_invitation"
  | "deadline";

type Lang = "da" | "en";

/** A row of the push queue, and the facts it needs that the row doesn't hold. */
export interface PushFacts {
  topic: PushTopic;
  proposalId: string | null;
  actorName: string | null;
  /** The event's name, as written. */
  eventTitle: string | null;
  groupName: string | null;
  /** The date a vote chose (a decided or moved event), as a time. */
  chosenAt: number | null;
}

const TIME_ZONE = "Europe/Copenhagen";

/** "lør. 14. nov. kl. 19:00" or "Sat 14 Nov at 19:00", always Danish time. */
export function dateText(at: number, lang: Lang): string {
  const date = new Intl.DateTimeFormat(lang === "da" ? "da-DK" : "en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: TIME_ZONE,
  })
    .format(at)
    .replace(",", "");
  // The clock reads 19:00 in both languages, whatever the locale says.
  const time = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TIME_ZONE,
  }).format(at);
  return lang === "da" ? `${date} kl. ${time}` : `${date} at ${time}`;
}

const NAMES = {
  da: { someone: "Én", event: "Aftale" },
  en: { someone: "Someone", event: "Event" },
};

/** The notification for these facts, in this language. */
export function composePush(facts: PushFacts, lang: Lang): PushMessage {
  const who = facts.actorName?.trim() || NAMES[lang].someone;
  const event = facts.eventTitle?.trim() || NAMES[lang].event;
  const group = facts.groupName?.trim() || (lang === "da" ? "en gruppe" : "a group");
  const when = facts.chosenAt === null ? "" : dateText(facts.chosenAt, lang);
  const dates = facts.proposalId ? `/events/${facts.proposalId}/dates` : "/events";
  const details = facts.proposalId ? `/events/${facts.proposalId}` : "/events";
  const thread = facts.proposalId ? `event-${facts.proposalId}` : undefined;
  const da = lang === "da";

  switch (facts.topic) {
    case "invited":
      return {
        title: event,
        body: da ? `${who} foreslog datoer. Svar nu.` : `${who} suggested dates. Tap to answer.`,
        url: dates,
        thread,
      };
    case "decided":
      return {
        title: event,
        body: da ? `Datoen er fundet: ${when}` : `The date is set: ${when}`,
        url: details,
        thread,
      };
    case "no_date":
      return {
        title: event,
        body: da ? "Ingen af datoerne kan bruges længere." : "None of the dates work any more.",
        url: details,
        thread,
      };
    case "choose":
      return {
        title: event,
        body: da
          ? "Alle datoer har et nej. Vælg selv en dato."
          : "Every date has a no. Choose a date yourself.",
        url: details,
        thread,
      };
    case "reopened":
      return {
        title: event,
        body: da
          ? "En dato er faldet fra, så afstemningen er åben igen."
          : "A date fell through, so the vote is open again.",
        url: dates,
        thread,
      };
    case "moved":
      return {
        title: event,
        body: da ? `Datoen er flyttet: ${when}` : `The date has moved: ${when}`,
        url: details,
        thread,
      };
    case "cancelled":
      return {
        title: event,
        body: da ? `${who} aflyste aftalen.` : `${who} cancelled the event.`,
        url: details,
        thread,
      };
    case "group_invitation":
      return {
        title: "Casy",
        body: da ? `${who} inviterede dig til ${group}.` : `${who} invited you to ${group}.`,
        url: "/groups",
      };
    case "deadline":
      return {
        title: event,
        body: da
          ? "Svarfristen er i dag eller i morgen. Du mangler at svare."
          : "The deadline is today or tomorrow. You have not answered yet.",
        url: dates,
        thread,
      };
  }
}
