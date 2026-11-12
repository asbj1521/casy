/**
 * The filter on what people write for others to read (#147, App Store guideline
 * 1.2): group names and descriptions, event names, places and notes, and
 * display names. It stops slurs and explicit words as they are saved; reports
 * and blocks (safety.ts) are what handle the rest, so it is no attempt at being
 * complete. Whole words only, and nothing that is an everyday word in the other
 * language: Danish "fag" is a school subject, "kys" a kiss and "rape" a burp.
 */
import { HttpError } from "./http.ts";

const BLOCKED_WORDS = new Set([
  // English
  "nigger",
  "nigga",
  "faggot",
  "kike",
  "spic",
  "chink",
  "tranny",
  "retard",
  "cunt",
  "whore",
  "slut",
  "porn",
  "porno",
  "rapist",
  "pedophile",
  "paedophile",
  // Danish
  "neger",
  "perker",
  "luder",
  "hore",
  "fisse",
  "kælling",
  "pikhoved",
  "spasser",
  "voldtægt",
  "børneporno",
  "pædofil",
]);

const BLOCKED_PHRASES = ["kill yourself", "child porn", "dræb dig selv", "slå dig selv ihjel"];

/** Digits and signs written for letters, to catch "n1gger". */
const LOOKALIKES: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s" };

const words = (text: string): string[] =>
  text
    .normalize("NFKC")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

/** Whether the text holds a blocked word or phrase. */
export function hasBlockedWords(text: string): boolean {
  const found = words(text);
  const asLetters = found.map((w) => w.replace(/[01345]/g, (d) => LOOKALIKES[d]));
  if ([...found, ...asLetters].some((w) => BLOCKED_WORDS.has(w))) return true;
  const joined = ` ${found.join(" ")} `;
  return BLOCKED_PHRASES.some((phrase) => joined.includes(` ${phrase} `));
}

export const BLOCKED_TEXT = "That has a word we don't allow. Try another.";

/** Refuses the request if any of the texts holds a blocked word. Empty ones pass. */
export function refuseBlockedWords(...texts: (string | null | undefined)[]): void {
  if (texts.some((text) => text && hasBlockedWords(text))) throw new HttpError(400, BLOCKED_TEXT);
}
