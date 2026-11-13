/**
 * The joke as scenes (#275, #270), played in a group chat that looks like the
 * ones Danes use, without copying any one app. In each, a plan stalls at "Vi
 * finder lige en dag"; time passes; the person answers with the app's link,
 * the friends laugh, and one of them sends back the day the app found.
 *
 * The phone shows only the chat. What the app says to the person (a cue) is
 * shown outside it, by whoever holds the phone, and the chat waits while it
 * stands: line, chat, line, chat.
 *
 * The friends write as friends do, with emojis and reactions: the one place
 * the app shows emojis, since this is their chat, not the app speaking
 * (CLAUDE.md's no-emoji rule is for what the app says, the cues included).
 *
 * Plain data, lines and timings, so the app's welcome screen, the computer's
 * ad and later the Swift welcome screen (Native 5, #201) play the same scenes.
 */

export interface Words {
  da: string;
  en: string;
}

/** The friends in the chat (made up), each with the colour of their initial. */
export const FRIENDS = {
  mads: { name: "Mads", color: "#5B7CF7" },
  ida: { name: "Ida", color: "#C2649B" },
  jonas: { name: "Jonas", color: "#3FA47A" },
} as const;

export type Friend = keyof typeof FRIENDS;

/** The chat's name at the top. */
export const GROUP: Words = { da: "Gym-vennerne", en: "School friends" };

/** What the plan is about: each scene is played with one of these. */
export interface Activity {
  /** Proposing it, in the scene "idea". */
  propose: Words;
  /** Asking whether it ever happened, in the scene "again". */
  again: Words;
  /** Its name on the found day's card. */
  title: Words;
}

export const ACTIVITIES: Activity[] = [
  {
    propose: { da: "Skal vi ikke tage ud og køre gokart? 🏎️", en: "Shall we go karting? 🏎️" },
    again: {
      da: "Fandt vi nogensinde en dag til gokart? 😅",
      en: "Did we ever find a day for karting? 😅",
    },
    title: { da: "Gokart", en: "Go-karting" },
  },
  {
    propose: {
      da: "Skal vi ikke tage på fisketur en dag? 🎣",
      en: "Shall we go fishing some day? 🎣",
    },
    again: {
      da: "Blev der nogensinde noget af den fisketur?",
      en: "Did that fishing trip ever happen?",
    },
    title: { da: "Fisketur", en: "Fishing trip" },
  },
  {
    propose: { da: "Skal vi ikke tage på vandretur? 🥾", en: "Shall we go hiking? 🥾" },
    again: {
      da: "Fandt vi nogensinde en dag til vandreturen?",
      en: "Did we ever find a day for the hike?",
    },
    title: { da: "Vandretur", en: "Hike" },
  },
  {
    propose: {
      da: "Skal vi ikke tage på camping til sommer? ⛺",
      en: "Shall we go camping this summer? ⛺",
    },
    again: {
      da: "Blev der nogensinde noget af den campingtur?",
      en: "Did that camping trip ever happen?",
    },
    title: { da: "Camping", en: "Camping" },
  },
];

/**
 * How much slower than the beats' own `ms` the scene plays: one setting for
 * the whole pace, so reading speed is tuned in one place.
 */
export const PACE = 1.5;

/** One moment of a scene. `ms` (times PACE) is how long it stays before the next one. */
export type Beat =
  /** The friend is typing: three dots, then their message replaces them. */
  | { kind: "typing"; who: Friend; ms: number }
  /**
   * A friend's message: fixed words, or the activity's (`propose`, `again`).
   * `key` is the line the scene is about; `history` is already there when the
   * scene opens.
   */
  | {
      kind: "text";
      who: Friend;
      text: Words | "propose" | "again";
      key?: boolean;
      history?: boolean;
      /** The reactions it gets, one friend at a time, in the order they come. */
      react?: string[];
      ms: number;
    }
  /** Time passing, as a chat's divider says it. */
  | { kind: "gap"; text: Words; ms: number }
  /** A line from the app to the person, outside the phone; the chat waits. */
  | { kind: "cue"; text: Words; ms: number }
  /** The person's own turn: the app's link in their field, sent with a tap (or by itself). */
  | { kind: "send"; ms: number }
  /** A friend sends back the day the app found. */
  | { kind: "found"; who: Friend; react?: string[]; ms: number };

const PHRASE: Words = { da: "Vi finder lige en dag", en: "We'll find a day" };

/** The three things the app says, in order. */
export const CUES = {
  familiar: { da: "Er det også sket for dig?", en: "Sound familiar?" },
  reply: { da: "Næste gang, svar med den her.", en: "Next time, reply with this." },
  found: { da: "Og så fandt I den.", en: "And then you found it." },
} satisfies Record<string, Words>;

/** From the phrase on: the same in every scene. */
const ENDING: Beat[] = [
  { kind: "cue", text: CUES.familiar, ms: 2200 },
  { kind: "cue", text: CUES.reply, ms: 1800 },
  { kind: "send", ms: 700 },
  { kind: "typing", who: "ida", ms: 600 },
  {
    kind: "text",
    who: "ida",
    text: { da: "HAHAHA er det en rigtig app?? 😂😂", en: "HAHAHA is that a real app?? 😂😂" },
    react: ["😆"],
    ms: 900,
  },
  { kind: "typing", who: "jonas", ms: 700 },
  {
    kind: "text",
    who: "jonas",
    text: { da: "Okay den virker faktisk 🤯", en: "Okay it actually works 🤯" },
    ms: 900,
  },
  { kind: "typing", who: "mads", ms: 900 },
  {
    kind: "text",
    who: "mads",
    text: { da: "Jeg har lige fundet en dag til os 🙏", en: "I just found us a day 🙏" },
    ms: 800,
  },
  { kind: "found", who: "mads", react: ["❤️", "🙌", "❤️", "❤️"], ms: 1600 },
  { kind: "cue", text: CUES.found, ms: 3400 },
];

export const SCENES = {
  /** Someone proposes something, everyone loves it, and it stalls at the phrase. */
  idea: [
    { kind: "typing", who: "mads", ms: 800 },
    { kind: "text", who: "mads", text: "propose", react: ["❤️", "❤️"], ms: 900 },
    { kind: "typing", who: "ida", ms: 600 },
    {
      kind: "text",
      who: "ida",
      text: { da: "Jaaa det lyder vildt fedt 😍", en: "Yesss that sounds amazing 😍" },
      react: ["👍"],
      ms: 800,
    },
    { kind: "typing", who: "jonas", ms: 700 },
    {
      kind: "text",
      who: "jonas",
      text: { da: "Uh ja, det kunne være så hyggeligt 🙌", en: "Oh yes, that would be so nice 🙌" },
      ms: 900,
    },
    { kind: "typing", who: "mads", ms: 900 },
    {
      kind: "text",
      who: "mads",
      text: PHRASE,
      key: true,
      react: ["👍", "👍", "👍"],
      ms: 900,
    },
    { kind: "gap", text: { da: "3 uger senere", en: "3 weeks later" }, ms: 700 },
    ...ENDING,
  ],
  /** It was proposed long ago; someone asks whether it ever happened. */
  again: [
    { kind: "text", who: "mads", text: "propose", history: true, ms: 0 },
    {
      kind: "text",
      who: "jonas",
      text: PHRASE,
      history: true,
      react: ["👍", "👍", "👍"],
      ms: 0,
    },
    { kind: "gap", text: { da: "2 måneder senere", en: "2 months later" }, ms: 900 },
    { kind: "typing", who: "ida", ms: 800 },
    { kind: "text", who: "ida", text: "again", ms: 1000 },
    { kind: "typing", who: "jonas", ms: 1100 },
    { kind: "text", who: "jonas", text: { da: "...nej 🙈", en: "...no 🙈" }, ms: 900 },
    { kind: "typing", who: "mads", ms: 900 },
    {
      kind: "text",
      who: "mads",
      text: PHRASE,
      key: true,
      react: ["😂", "😂"],
      ms: 1000,
    },
    ...ENDING,
  ],
} satisfies Record<string, Beat[]>;

export type SceneName = keyof typeof SCENES;

/** The found day, as the app's card says it. */
export const FOUND = {
  date: { da: "Lørdag 14. marts", en: "Saturday 14 March" },
  detail: { da: "kl. 14 · Alle 5 kan", en: "2 pm · All 5 can make it" },
};

/** The link's small print under the name, as a chat preview has it. */
export const LINK_DETAIL: Words = { da: "Find en dag · App Store", en: "Find a day · App Store" };

/** The time in the status bar: an evening, when group chats happen. */
export const CLOCK = "21.12";
