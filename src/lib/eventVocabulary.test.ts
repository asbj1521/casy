import { describe, expect, it } from "vitest";

// The server's copy, read as text through Vite (?raw): Edge Functions can't
// import from src/, so the two lists are kept by hand and checked here.
import serverSource from "../../supabase/functions/_shared/eventVocabulary.ts?raw";
import * as browser from "@/lib/eventVocabulary";

/** `export const NAME = [...]` or `= 3` in the server's file, as values. */
function serverConst(name: string): unknown {
  const match = new RegExp(`export const ${name} = (\\[[^\\]]*\\]|\\d+)`).exec(serverSource);
  if (!match) throw new Error(`${name} is missing from the server's eventVocabulary.ts`);
  return JSON.parse(match[1].replace(/,\s*\]/, "]"));
}

describe("the event vocabulary", () => {
  it.each(["EFFECTS", "STRAIN", "CONFIDENCE", "MAX_RECOVERY_DAYS"] as const)(
    "%s is the same in the browser and on the server",
    (name) => {
      expect(serverConst(name)).toEqual(browser[name]);
    },
  );
});
