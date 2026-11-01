/** Profile pictures (#187): picked, cropped (#190), made into a small square JPEG on the page, shown, removed. */
import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";
import { PNG } from "./world";

/** The crop sheet (#190), shown once a photo is picked. */
function cropSheet(page: Page) {
  return page.getByRole("dialog", { name: "Flyt og skalér" });
}

function pick(page: Page, buffer: Buffer) {
  return page
    .locator('input[type="file"][accept="image/*"]')
    .setInputFiles({ name: "foto.png", mimeType: "image/png", buffer });
}

test("a profile picture is picked, sent as a small JPEG, shown, and removed", async ({
  page,
  backend,
}) => {
  await page.goto("/profile");
  const add = page.getByRole("button", { name: "Tilføj profilbillede" });
  await expect(add).toBeVisible();
  await pick(page, PNG);
  await cropSheet(page).getByRole("button", { name: "Færdig" }).click();

  // Made into a JPEG on the page before it is sent (FF D8 FF is "/9j/").
  await expect
    .poll(() => backend.calls.find((c) => c.body.action === "set-avatar")?.body.image)
    .toMatch(/^\/9j\//);
  const change = page.getByRole("button", { name: "Skift profilbillede" });
  await expect(change.locator("img")).toBeVisible();
  // It is 512 px square, whatever the photo's shape was.
  const size = await change
    .locator("img")
    .evaluate((img: HTMLImageElement) => [img.naturalWidth, img.naturalHeight]);
  expect(size).toEqual([512, 512]);

  await page.getByRole("button", { name: "Fjern billede" }).click();
  await expect(add).toBeVisible();
  expect(backend.world.avatarUrl).toBeNull();
});

test("the photo dragged in the frame chooses the part kept (#190)", async ({ page, backend }) => {
  await page.goto("/profile");
  await expect(page.getByRole("button", { name: "Tilføj profilbillede" })).toBeVisible();
  // A landscape photo, red on the left half and blue on the right: the middle square is both.
  const photo = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 200;
    canvas.height = 100;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#ff0000";
    context.fillRect(0, 0, 100, 100);
    context.fillStyle = "#0000ff";
    context.fillRect(100, 0, 100, 100);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await pick(page, Buffer.from(photo, "base64"));

  // Dragged right as far as it goes: the square kept is the left, red one.
  const frame = cropSheet(page).getByLabel(/^Billedet\./);
  // Measured once the sheet has slid up and stands still (hover waits for that).
  await frame.hover();
  const box = (await frame.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width, box.y + box.height / 2, { steps: 5 });
  await page.mouse.up();
  await cropSheet(page).getByRole("button", { name: "Færdig" }).click();

  await expect.poll(() => backend.calls.some((c) => c.body.action === "set-avatar")).toBe(true);
  const img = page.getByRole("button", { name: "Skift profilbillede" }).locator("img");
  await expect(img).toBeVisible();
  // The picture's middle is red, where the middle square's would be on the edge between.
  const [r, , b] = await img.evaluate((el: HTMLImageElement) => {
    const canvas = document.createElement("canvas");
    canvas.width = el.naturalWidth;
    canvas.height = el.naturalHeight;
    const context = canvas.getContext("2d")!;
    context.drawImage(el, 0, 0);
    return [...context.getImageData(256, 256, 1, 1).data];
  });
  expect(r).toBeGreaterThan(200);
  expect(b).toBeLessThan(60);
});

test("Annuller in the crop sheet keeps the picture as it was (#190)", async ({ page, backend }) => {
  await page.goto("/profile");
  const add = page.getByRole("button", { name: "Tilføj profilbillede" });
  await expect(add).toBeVisible();
  await pick(page, PNG);
  await cropSheet(page).getByRole("button", { name: "Annuller" }).click();
  await expect(cropSheet(page)).toBeHidden();
  await expect(add).toBeVisible();
  expect(backend.calls.filter((c) => c.body.action === "set-avatar")).toHaveLength(0);
});

test("any member gives a group a picture, shown in place of its members, and removes it (#188)", async ({
  page,
  backend,
}) => {
  await page.goto("/groups/g-running");
  const add = page.getByRole("button", { name: "Tilføj et billede til gruppen" });
  await expect(add).toBeVisible();
  await pick(page, PNG);
  await cropSheet(page).getByRole("button", { name: "Færdig" }).click();
  await expect
    .poll(() => backend.calls.find((c) => c.body.action === "set-group-picture")?.body)
    .toMatchObject({ groupId: "g-running", image: expect.stringMatching(/^\/9j\//) });
  const change = page.getByRole("button", { name: "Skift gruppens billede" });
  await expect(change.locator("img")).toBeVisible();

  await page.getByRole("button", { name: "Fjern billede" }).click();
  await expect(add).toBeVisible();
  expect(backend.world.groups.find((g) => g.id === "g-running")?.pictureUrl).toBeNull();
});
