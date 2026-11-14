/**
 * The iPhone app's own copy of Hjælp og kontakt, Sådan virker det, Vilkår and
 * Privatliv (#198): the web pages' words, both languages, written to CasyUI's
 * HelpPages.json for the native screens to lay out. A change to a page fails
 * here until the file is written again (UPDATE_PARITY=1 npx vitest run
 * e2e/helpPages), so the app's legal text can never drift from the site's.
 *
 * A section's body becomes blocks: a paragraph, or a list's items, each as
 * Markdown with a Term as **bold** and a link as [words](address).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";

import type { LegalCopy } from "@/components/LegalPage";
import { COPY as HOW_IT_WORKS } from "@/pages/HowItWorks";
import { COPY as PRIVACY } from "@/pages/Privacy";
import { COPY as SUPPORT } from "@/pages/Support";
import { COPY as TERMS } from "@/pages/Terms";

// Only the words are wanted: the pages' top bar and back link reach for the browser.
vi.mock("@/components/ProfilePageTop", () => ({ default: () => null }));
vi.mock("@/components/welcome/AppBackLink", () => ({ default: () => null }));

const FILE = resolve(process.cwd(), "ios/Packages/CasyUI/Sources/CasyUI/Resources/HelpPages.json");

type Block = { text: string } | { list: string[] };

const decode = (s: string) =>
  s
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");

/** One paragraph or item as Markdown; anything else in it fails, to be taught here first. */
function inline(html: string): string {
  const text = html
    .replace(/<span class="font-medium text-foreground">([\s\S]*?)<\/span>/g, "**$1**")
    .replace(/<a [^>]*?href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g, "[$2]($1)");
  if (/<[a-z]/i.test(text)) throw new Error(`A tag the app can't show yet: ${text}`);
  const words = decode(text).replace(/\s+/g, " ").trim();
  if (/[_`]/.test(words)) throw new Error(`Markdown would change: ${words}`);
  return words;
}

function blocks(body: ReactNode): Block[] {
  const html = renderToStaticMarkup(createElement(MemoryRouter, null, body));
  const found: Block[] = [];
  const rest = html.replace(
    /<(p|ul)[^>]*>([\s\S]*?)<\/\1>/g,
    (_all, tag: string, inner: string) => {
      if (tag === "p") found.push({ text: inline(inner) });
      else
        found.push({
          list: [...inner.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((m) => inline(m[1])),
        });
      return "";
    },
  );
  if (rest.trim()) throw new Error(`Text outside a paragraph or list: ${rest}`);
  return found;
}

const legal = (copy: LegalCopy) => ({
  title: copy.title,
  updated: copy.updated,
  sections: copy.sections.map((s) => ({
    ...(s.id ? { id: s.id } : {}),
    title: s.title,
    blocks: blocks(s.body),
  })),
});

const both = <T, U>(copy: { da: T; en: T }, f: (c: T) => U) => ({ da: f(copy.da), en: f(copy.en) });

it("the app's help pages say what the site's say", () => {
  const pages = {
    support: both(SUPPORT, legal),
    howItWorks: both(HOW_IT_WORKS, (c) => c),
    terms: both(TERMS, legal),
    privacy: both(PRIVACY, legal),
  };
  const text = `${JSON.stringify(pages, null, 2)}\n`;
  if (process.env.UPDATE_PARITY) writeFileSync(FILE, text);
  expect(readFileSync(FILE, "utf8")).toBe(text);
});
