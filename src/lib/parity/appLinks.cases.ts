/** appLinks.ts's link rules, for AppLinks.swift (#282: the native "Indsæt link"). */
import { appLinkPath, inviteInText } from "@/lib/appLinks";

import { caseBook, type ParityCase } from "./cases";

const URLS = [
  "https://casy.app/join/abc123",
  "https://casy.app/join/abc123/",
  "https://casy.app/friend/f00d",
  "https://casy.app/app",
  "https://casy.app/app/",
  "https://casy.app/",
  "https://casy.app",
  "https://casy.app/join/",
  "https://casy.app/join/a/b",
  "https://casy.app/plan",
  "https://casy.app/join/abc?door=1",
  "https://casy.app/join/abc#top",
  "https://CASY.APP/join/abc",
  "https://casy-red.vercel.app/join/tok",
  "https://vifinderligeendag.dk/app",
  "https://www.vifinderligeendag.com/join/x9",
  "https://www.casy.app/join/abc",
  "http://casy.app/join/abc",
  "https://evil.example/join/abc",
  "https://casy.app.evil.example/join/abc",
  "https://casy.app/JOIN/abc",
  "https://casy.app/join/a%20b",
  "casy.app/join/abc",
  "",
  "not a link",
];

const TEXTS = [
  "https://casy.app/join/abc123",
  "Kom med: https://casy.app/join/abc123!",
  "Kom med i gruppen (https://casy.app/join/abc123).",
  "Her: https://casy.app/join/abc123, ses!",
  "Først https://example.com/x og så https://casy.app/join/tok2",
  "https://example.com/only",
  "<https://casy.app/join/ang>",
  '"https://casy.app/join/quoted"',
  "Hej\nhttps://casy.app/friend/ven1\nmvh",
  "  https://casy.app/join/spaces   ",
  "https://casy.app/join/abc?.",
  "https://casy.app/join/abc;:",
  "https://casy.app/join/abc]",
  "Ingen link her",
  "",
  "https://casy.app/app",
  "http://casy.app/join/plain",
];

export function appLinksCases(): ParityCase[] {
  const { cases, add } = caseBook(20261121);
  for (const url of URLS) add("path", { url }, appLinkPath(url));
  for (const text of TEXTS) add("text", { text }, inviteInText(text));
  return cases;
}
