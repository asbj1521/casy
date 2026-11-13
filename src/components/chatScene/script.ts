/**
 * The joke as a scene (#275, #270): a group chat writes itself until someone
 * says "Vi finder lige en dag", the person is asked whether they know that
 * message, and either way they answer it with the app, the friends laugh, and
 * for once the day is found. Kept as plain data, lines and timings, so the
 * app's welcome screen, the computer's ad and later the Swift welcome screen
 * (Native 5, #201) all play the same scene.
 */

export interface Words {
  da: string;
  en: string;
}

/** The friends in the chat, each with the colour of their initial. */
export const FRIENDS = {
  mads: { name: "Mads", color: "#4C8BF5" },
  ida: { name: "Ida", color: "#B06AF0" },
  jonas: { name: "Jonas", color: "#3DBB7A" },
} as const;

export type Friend = keyof typeof FRIENDS;

/** One moment of the scene. `ms` is how long it stays before the next one. */
export type Beat =
  /** The friend is typing: three dots, then their message replaces them. */
  | { kind: "typing"; who: Friend; ms: number }
  /** A message from a friend; `key` is the one the whole scene is about. */
  | { kind: "text"; who: Friend; text: Words; key?: boolean; ms: number }
  /** The person's own reply: the app's link, as a chat shows it. */
  | { kind: "link"; ms: number }
  /** The day the app found, standing in the chat like a note. */
  | { kind: "found"; ms: number }
  /** A line under the chat, from the app to the person. */
  | { kind: "caption"; text: Words; ms: number }
  /** The question, waiting for Ja or Nej (or, on the computer, nobody). */
  | { kind: "ask" };

/** The chat's name at the top. */
export const GROUP: Words = { da: "Gymnasiet 3.b", en: "Old school friends" };
export const MEMBERS: Words = { da: "5 personer", en: "5 people" };

/** The phrase itself: the one line that is never translated into anything else in Danish. */
export const PHRASE: Words = { da: "Vi finder lige en dag", en: "We'll find a day" };

export const OPENING: Beat[] = [
  { kind: "typing", who: "mads", ms: 700 },
  {
    kind: "text",
    who: "mads",
    text: { da: "Vi skal altså ses snart", en: "We really need to meet up soon" },
    ms: 900,
  },
  { kind: "typing", who: "ida", ms: 600 },
  { kind: "text", who: "ida", text: { da: "Jaaa helt sikkert", en: "Yesss definitely" }, ms: 900 },
  { kind: "typing", who: "jonas", ms: 1100 },
  { kind: "text", who: "jonas", text: PHRASE, key: true, ms: 1400 },
  { kind: "ask" },
];

/** What is asked about Jonas's message, and the two answers. */
export const QUESTION: Words = {
  da: "Har du fået den besked?",
  en: "Ever had that message?",
};
export const YES: Words = { da: "Ja", en: "Yes" };
export const NO: Words = { da: "Nej", en: "No" };

/** The app's reply to each answer: either way, the person answers with the app. */
export const ANSWERS: Record<"yes" | "no", Words> = {
  yes: { da: "Så svar med den her.", en: "Then answer with this." },
  no: { da: "Det får du. Svar med den her.", en: "You will. Answer with this." },
};

/** After the answer, the same for everyone. */
export const AFTER: Beat[] = [
  { kind: "link", ms: 1200 },
  { kind: "typing", who: "ida", ms: 500 },
  { kind: "text", who: "ida", text: { da: "HAHA nej", en: "HAHA no" }, ms: 700 },
  { kind: "typing", who: "jonas", ms: 700 },
  {
    kind: "text",
    who: "jonas",
    text: { da: "ok den er faktisk god", en: "ok that's actually good" },
    ms: 1300,
  },
  { kind: "found", ms: 1500 },
  { kind: "typing", who: "mads", ms: 600 },
  { kind: "text", who: "mads", text: { da: "Vi ses på fredag", en: "See you on Friday" }, ms: 900 },
  {
    kind: "caption",
    text: { da: "Og så fandt I den.", en: "And for once, you found it." },
    ms: 2600,
  },
];

/** The found day, as the note in the chat says it. */
export const FOUND: { title: Words; detail: Words } = {
  title: { da: "Fredag 14. marts", en: "Friday 14 March" },
  detail: { da: "Alle 5 kan", en: "All 5 can make it" },
};

/** The link's small print under the name, as a chat preview has it. */
export const LINK_DETAIL: Words = { da: "Find en dag · App Store", en: "Find a day · App Store" };
