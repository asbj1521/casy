import { describe, expect, it } from "vitest";

import { FEEDBACK_EMAIL, feedbackMailto } from "@/lib/feedback";

describe("feedbackMailto", () => {
  const link = feedbackMailto({
    subject: "Feedback på Casy",
    prompt: "Skriv her:",
    build: "abc1234",
    platform: "app",
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 27_0 like Mac OS X)",
  });
  const url = new URL(link);

  it("goes to the feedback address", () => {
    expect(url.protocol).toBe("mailto:");
    expect(url.pathname).toBe(FEEDBACK_EMAIL);
  });

  it("keeps the subject's letters and spaces intact", () => {
    expect(link).toContain("subject=Feedback%20p%C3%A5%20Casy");
    expect(link).not.toContain("+");
  });

  it("puts the build, platform and device under the message", () => {
    const body = decodeURIComponent(link.split("&body=")[1]);
    expect(body.startsWith("Skriv her:\n")).toBe(true);
    expect(body).toContain("Casy abc1234 (app)");
    expect(body.trimEnd().endsWith("like Mac OS X)")).toBe(true);
  });
});
