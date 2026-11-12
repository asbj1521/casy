import { describe, expect, it } from "vitest";

import {
  APP_DOOR_HOST,
  APP_LINK_HOST,
  appLinkPath,
  doorUrl,
  fromDoorUrl,
  inAppBrowser,
  inviteInText,
  inviteLinkUrl,
} from "@/lib/appLinks";
// The files an app link depends on, read as text through Vite (?raw), so a
// change to one without the others fails here.
import association from "../../public/.well-known/apple-app-site-association?raw";
import entitlements from "../../ios/App/App/App.entitlements?raw";
import project from "../../ios/App/App.xcodeproj/project.pbxproj?raw";
import vercel from "../../vercel.json?raw";

describe("appLinkPath", () => {
  it("leads an invite link to its join page", () => {
    expect(appLinkPath("https://casy.app/join/abc123")).toBe("/join/abc123");
    expect(appLinkPath("https://casy.app/join/abc123/")).toBe("/join/abc123");
    expect(appLinkPath("https://casy.app/friend/abc123")).toBe("/friend/abc123");
  });

  it("opens the link the server makes, which the QR code, the copied link and the text carry", () => {
    // newInviteToken: 32 random bytes, base64url, so every character of the alphabet.
    const token = "Zm9vYmFyX-_AZaz09Zm9vYmFyX-_AZaz09Zm9vYmFyX-_AZaz09";
    expect(appLinkPath(`https://${APP_LINK_HOST}/join/${token}`)).toBe(`/join/${token}`);
  });

  it("keeps a token as it was written, encoded characters included", () => {
    expect(appLinkPath("https://casy.app/join/a%20b-_9")).toBe("/join/a%20b-_9");
  });

  it("drops what follows the token: a query or a fragment is never carried in", () => {
    expect(appLinkPath("https://casy.app/join/abc123?next=//evil.example#x")).toBe("/join/abc123");
  });

  it.each([
    ["another site", "https://example.com/join/abc123"],
    ["a look-alike host", "https://casy.app.evil.example/join/abc123"],
    ["a subdomain", "https://www.casy.app/join/abc123"],
    ["plain http", "http://casy.app/join/abc123"],
    ["another page of the site", "https://casy.app/privacy"],
    ["the join page without a token", "https://casy.app/join/"],
    ["a longer path", "https://casy.app/join/abc123/extra"],
    ["the site's front page", "https://casy.app/"],
    ["the app's own address", "capacitor://localhost/join/abc123"],
    ["a custom scheme", "casy://join/abc123"],
    ["not a URL", "join/abc123"],
    ["nothing", ""],
  ])("ignores %s", (_, url) => {
    expect(appLinkPath(url)).toBeNull();
  });
});

describe("the door into the app (#257)", () => {
  it("is a second address the app answers to, for the same links", () => {
    expect(appLinkPath(`https://${APP_DOOR_HOST}/join/abc123`)).toBe("/join/abc123");
    expect(appLinkPath(`https://${APP_DOOR_HOST}/privacy`)).toBeNull();
  });

  it("leads from casy.app to the door and back, each a tap to another site that opens the app", () => {
    expect(doorUrl("/join/abc123")).toBe("https://casy-red.vercel.app/join/abc123?door=1");
    expect(fromDoorUrl("/join/abc123")).toBe("https://casy.app/join/abc123?noapp=1");
    // Both are links the app opens, at the invite itself.
    expect(appLinkPath(doorUrl("/join/abc123"))).toBe("/join/abc123");
    expect(appLinkPath(fromDoorUrl("/join/abc123"))).toBe("/join/abc123");
    expect(new URL(doorUrl("/join/a")).hostname).not.toBe(new URL(fromDoorUrl("/join/a")).hostname);
  });

  it("is listed in the app's entitlement beside casy.app", () => {
    expect(entitlements).toContain(`<string>applinks:${APP_DOOR_HOST}</string>`);
  });

  it.each([
    [
      "Messenger",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 [FBAN/MessengerLiteForiOS;FBAV/480.0;FBBV/1;FBDV/iPhone17,1]",
      true,
    ],
    [
      "Instagram",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Instagram 350.0",
      true,
    ],
    [
      "Safari",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 Version/26.0 Mobile/15E148 Safari/604.1",
      false,
    ],
    [
      "Chrome on an iPhone",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 CriOS/140.0 Mobile/15E148 Safari/604.1",
      false,
    ],
  ])("knows %s's own browser from a real one", (_, userAgent, inside) => {
    expect(inAppBrowser(userAgent)).toBe(inside);
  });
});

describe("inviteInText (#237)", () => {
  it("finds the invite a pasted text holds, alone or among other words", () => {
    expect(inviteInText(inviteLinkUrl("/join/abc123"))).toBe("/join/abc123");
    expect(inviteInText("  https://casy.app/join/abc123\n")).toBe("/join/abc123");
    expect(inviteInText("Kom med i gruppen: https://casy.app/join/abc_-123!")).toBe(
      "/join/abc_-123",
    );
    expect(inviteInText("https://example.com/x og https://casy.app/friend/f1.")).toBe("/friend/f1");
  });

  it("finds none in anything else", () => {
    expect(inviteInText("")).toBeNull();
    expect(inviteInText("abc123")).toBeNull();
    expect(inviteInText("https://example.com/join/abc123")).toBeNull();
    expect(inviteInText("https://casy.app/privacy")).toBeNull();
  });
});

describe("the association file", () => {
  const file = JSON.parse(association) as {
    applinks: { details: { appIDs: string[]; components: { "/": string }[] }[] };
  };
  const [detail, ...rest] = file.applinks.details;

  it("names Casy's app, by team and bundle id as the Xcode project has them", () => {
    const team = /DEVELOPMENT_TEAM = (\w+);/.exec(project)?.[1];
    const bundle = /PRODUCT_BUNDLE_IDENTIFIER = ([\w.]+);/.exec(project)?.[1];
    expect(rest).toHaveLength(0);
    expect(detail.appIDs).toEqual([`${team}.${bundle}`]);
  });

  it("lists only the invite links, which is all appLinkPath opens", () => {
    expect(detail.components.map((c) => c["/"])).toEqual(["/join/*", "/friend/*"]);
  });

  it("is what the app's entitlement and appLinkPath are about: casy.app", () => {
    expect(entitlements).toContain(`<string>applinks:${APP_LINK_HOST}</string>`);
  });

  it("is served as JSON, which a file without an extension isn't by default", () => {
    const config = JSON.parse(vercel) as {
      headers: { source: string; headers: { key: string; value: string }[] }[];
    };
    const own = config.headers.find((h) => h.source === "/.well-known/apple-app-site-association");
    expect(own?.headers).toContainEqual({ key: "Content-Type", value: "application/json" });
  });
});
