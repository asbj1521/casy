/**
 * The example groups' names and members, kept apart from their generated
 * calendars (mockData.ts), which the scheduler loads only when it shows the
 * examples (#157): the page needs the list at once, the calendars only then.
 */

/** One of the example groups: a name and who is in it. */
export interface ExampleGroupDef {
  id: string;
  name: string;
  /** Person ids (keys of PEOPLE); "you" is the signed-in person's slot. */
  members: string[];
}

/**
 * The ten groups the scheduling page rotates through. Sizes are meant to look
 * right for what they are — a basketball squad has ten, a band has four —
 * because an example that doesn't look plausible teaches nothing.
 */
export const EXAMPLE_GROUPS: ExampleGroupDef[] = [
  {
    id: "basketball",
    name: "Basketball team",
    members: [
      "you",
      "mikkel",
      "rasmus",
      "oliver",
      "emil",
      "noah",
      "villads",
      "august",
      "malthe",
      "elias",
    ],
  },
  {
    id: "highschool",
    name: "Highschool group",
    members: ["you", "simon", "kristoffer", "jonas", "thue", "claes", "benjamin"],
  },
  {
    id: "family",
    name: "Family",
    members: ["you", "hansove", "anne", "regitze", "aksel"],
  },
  {
    id: "bookclub",
    name: "Book club",
    members: ["you", "ida", "sofie", "clara", "johanne", "marie"],
  },
  {
    id: "studygroup",
    name: "Study group",
    members: ["you", "freja", "lucas", "alma"],
  },
  {
    id: "work",
    name: "Work team",
    members: ["you", "prusse", "thille", "borring", "nico", "schlei", "nora"],
  },
  {
    id: "running",
    name: "Running club",
    members: ["you", "katrine", "jeppe", "signe", "anders", "louise"],
  },
  {
    id: "band",
    name: "The band",
    members: ["you", "viggo", "karla", "storm"],
  },
  {
    id: "neighbours",
    name: "Neighbours",
    members: ["you", "birgitte", "poul", "hanne", "soren", "lene", "kurt"],
  },
  {
    id: "oldfriends",
    name: "Old friends",
    members: ["you", "frederik", "laura", "tobias", "amalie", "gustav"],
  },
];
