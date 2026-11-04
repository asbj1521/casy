import type { Page } from "@playwright/test";

import { expect } from "./fixtures";

/**
 * Picks `label` on the wheel a settings button (named `current`) opens, and
 * checks it took. The wheel repeats its options 15 times to loop, and opens
 * on the middle repeat (WheelPicker): the 8th copy is the one beside the
 * current value. It is turned the way a finger leaves it, with that copy in
 * the centre, where the wheel settles on it. A click raced (#208): Playwright
 * first scrolls the item into view, which turns the wheel to a neighbour,
 * while the click asks for a smooth scroll to the item, and on a busy
 * machine the neighbour could win.
 */
export async function pickOnWheel(page: Page, current: string, label: string) {
  await page.getByRole("button", { name: current, exact: true }).filter({ visible: true }).click();
  const item = page.getByText(label, { exact: true }).filter({ visible: true }).nth(7);
  await item.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await expect(page.getByRole("button", { name: label, exact: true }).first()).toBeVisible();
  await page.keyboard.press("Escape");
}
