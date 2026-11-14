/**
 * Design rule 11 (CLAUDE.md): every native sheet's buttons sit in the same
 * places, so no screen may place them itself. The top bar comes from CasyUI's
 * casySheetBar or casyPushedBar, and the main action is a FlowButton along the
 * bottom; a ToolbarItem in a screen would put a button wherever it likes.
 */
import { describe, expect, it } from "vitest";

const screens = import.meta.glob<string>("../../../ios/App/App/Native/Screens/*.swift", {
  query: "?raw",
  import: "default",
  eager: true,
});

describe("the native sheets' buttons (design rule 11)", () => {
  it("finds the screens", () => {
    expect(Object.keys(screens).length).toBeGreaterThan(5);
  });

  it.each(Object.entries(screens))("%s places none by hand", (_file, code) => {
    expect(code).not.toMatch(/ToolbarItem\(|\.cancellationAction|\.confirmationAction/);
  });
});
