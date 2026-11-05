import { describe, expect, it } from "vitest";

import { parentScreen, screenDepth, sheetAddress, sheetScreenFor } from "@/lib/profileScreens";

describe("the Profil sheet's screens (#174)", () => {
  it("finds the screen for the profile's old addresses, and none for the help pages", () => {
    expect(sheetScreenFor("/profile/settings")).toBe("settings");
    expect(sheetScreenFor("/profile/data/")).toBe("data");
    expect(sheetScreenFor("/groups")).toBe("groups");
    expect(sheetScreenFor("/groups/g1")).toBe("groups/g1");
    expect(sheetScreenFor("/privacy")).toBeNull();
    expect(sheetScreenFor("/profile/calendars")).toBeNull();
  });

  it("knows how deep each screen is and where back leads", () => {
    expect([screenDepth(""), screenDepth("settings"), screenDepth("groups/g1")]).toEqual([0, 1, 2]);
    expect(parentScreen("groups/g1")).toBe("groups");
    expect(parentScreen("settings")).toBe("");
  });

  it("makes the home page's address, keeping what the link carried", () => {
    expect(sheetAddress("settings")).toBe("/?profile=settings");
    expect(sheetAddress("")).toBe("/?profile");
    expect(sheetAddress("groups/g1")).toBe("/?profile=groups/g1");
    expect(sheetAddress("password", "?password=new")).toBe("/?password=new&profile=password");
  });
});

describe("an invitation in the sheet (#224)", () => {
  it("is a screen under Grupper", () => {
    expect(sheetScreenFor("/invited/g1")).toBe("invited/g1");
    expect(screenDepth("invited/g1")).toBe(2);
    expect(parentScreen("invited/g1")).toBe("groups");
    expect(sheetAddress("invited/g1")).toBe("/?profile=invited/g1");
  });
});
