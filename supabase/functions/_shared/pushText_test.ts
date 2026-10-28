// Run with: deno test --node-modules-dir=none supabase/functions/_shared/
import { assert, assertEquals } from "jsr:@std/assert@1";

import { composePush, dateText, type PushFacts, type PushTopic } from "./pushText.ts";

const SATURDAY_19 = Date.parse("2026-11-14T18:00:00Z"); // 19:00 Danish time

const facts = (topic: PushTopic, extra: Partial<PushFacts> = {}): PushFacts => ({
  topic,
  proposalId: "e1",
  actorName: "Sara",
  eventTitle: "Grillaften",
  groupName: "Fredagsholdet",
  chosenAt: SATURDAY_19,
  ...extra,
});

Deno.test("a date reads in Danish time, the clock as 19:00 in both languages", () => {
  assertEquals(dateText(SATURDAY_19, "da"), "lør. 14. nov. kl. 19:00");
  assertEquals(dateText(SATURDAY_19, "en"), "Sat 14 Nov at 19:00");
  // Summer time: 22:00 UTC is midnight in Copenhagen.
  assertEquals(dateText(Date.parse("2026-07-01T22:00:00Z"), "en").endsWith("at 00:00"), true);
});

Deno.test("an invitation to vote names who asked and opens the dates", () => {
  assertEquals(composePush(facts("invited"), "da"), {
    title: "Grillaften",
    body: "Sara foreslog datoer. Svar nu.",
    url: "/events/e1/dates",
    thread: "event-e1",
  });
  assertEquals(composePush(facts("invited"), "en").body, "Sara suggested dates. Tap to answer.");
});

Deno.test("a decided vote says the date and opens the event", () => {
  const message = composePush(facts("decided"), "da");
  assertEquals(message.body, "Datoen er fundet: lør. 14. nov. kl. 19:00");
  assertEquals(message.url, "/events/e1");
  assertEquals(composePush(facts("moved"), "en").body, "The date has moved: Sat 14 Nov at 19:00");
});

Deno.test("without a name, it is someone", () => {
  assertEquals(
    composePush(facts("cancelled", { actorName: null }), "en").body,
    "Someone cancelled the event.",
  );
  assertEquals(
    composePush(facts("invited", { actorName: "  " }), "da").body.startsWith("Én "),
    true,
  );
  assertEquals(composePush(facts("invited", { eventTitle: null }), "da").title, "Aftale");
});

Deno.test("a group invitation names the group and opens the invitations", () => {
  const message = composePush(facts("group_invitation", { proposalId: null }), "da");
  assertEquals(message, {
    title: "Casy",
    body: "Sara inviterede dig til Fredagsholdet.",
    url: "/groups",
  });
});

Deno.test("every notification, in both languages, has no emoji and no long dash", () => {
  const topics: PushTopic[] = [
    "invited",
    "decided",
    "no_date",
    "choose",
    "reopened",
    "moved",
    "cancelled",
    "group_invitation",
    "deadline",
  ];
  for (const topic of topics) {
    for (const lang of ["da", "en"] as const) {
      const { title, body, url } = composePush(facts(topic), lang);
      assert(title && body && url, `${topic} ${lang} says something and leads somewhere`);
      assert(!/[–—]/.test(`${title}${body}`), `${topic} ${lang} has a long dash`);
      assert(
        !/\p{Extended_Pictographic}/u.test(`${title}${body}`),
        `${topic} ${lang} has an emoji`,
      );
    }
  }
});
