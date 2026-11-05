/**
 * The iPhone's text size in the app (#216): lib/textSize.ts sets the root's
 * size from iOS. Chromium has no iOS setting to read, so these set the largest
 * size followed as it would, and check that the screens still fit.
 */
import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";

test.beforeEach(({ isMobile }) => test.skip(!isMobile, "the app is a phone"));

async function largestText(page: Page) {
  await page.addInitScript(() => {
    addEventListener("DOMContentLoaded", () => {
      const root = document.documentElement;
      root.style.fontSize = "21.6px";
      root.classList.add("large-text");
    });
  });
}

const fits = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test("at the largest text size the toolbar stays on screen, on the month and the day", async ({
  page,
}) => {
  await largestText(page);
  for (const path of ["/", "/?day=2026-10-07"]) {
    await page.goto(path);
    const today = page.getByRole("button", { name: "I dag" });
    await expect(today).toBeVisible();
    const box = (await today.boundingBox())!;
    expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    // One line: the capsule's height, not two lines of it.
    const lines = await today.evaluate((el) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      return new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size;
    });
    expect(lines).toBe(1);
    expect(await fits(page)).toBe(true);
  }
});

test("at the largest text size Planlæg's rows keep their words", async ({ page }) => {
  await largestText(page);
  await page.goto("/?plan");
  const sheet = page.getByRole("dialog", { name: "Planlæg" });
  const label = sheet.getByText("Tidspunkt", { exact: true });
  await expect(label).toBeVisible();
  const cut = await label.evaluate((el) => el.scrollWidth > el.clientWidth);
  expect(cut).toBe(false);
  expect(await fits(page)).toBe(true);
});

test("a small link's touch area reaches 44 pt, without moving it", async ({ page }) => {
  await page.goto("/?profile=groups");
  const block = page.getByRole("button", { name: "Bloker afsenderen" });
  await expect(block).toBeVisible();
  const after = await block.evaluate((el) => {
    const s = getComputedStyle(el, "::after");
    return { height: parseFloat(s.height), content: s.content };
  });
  expect(after.content).not.toBe("none");
  expect(after.height).toBeGreaterThanOrEqual(44);
});
