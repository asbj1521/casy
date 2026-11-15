/**
 * CasyUI's eventTitle reads stored event names as the web's does: every
 * English name in STORED_TITLES maps to its type in Strings.swift, so "Evening"
 * shows as "Aften" in the app too (#199).
 */
import { expect, it } from "vitest";

import stringsSwift from "../../../ios/Packages/CasyUI/Sources/CasyUI/Strings.swift?raw";
import { STORED_TITLES } from "@/i18n/eventTitle";

it("the app knows every stored event name", () => {
  for (const [id, name] of Object.entries(STORED_TITLES)) {
    expect(stringsSwift, name).toContain(`"${name}": "${id}"`);
  }
});
