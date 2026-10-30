/** Profile pictures (#187): picked, made into a small square JPEG on the page, shown, removed. */
import { expect, test } from "./fixtures";
import { PNG } from "./world";

test("a profile picture is picked, sent as a small JPEG, shown, and removed", async ({
  page,
  backend,
}) => {
  await page.goto("/profile");
  const add = page.getByRole("button", { name: "Tilføj profilbillede" });
  await expect(add).toBeVisible();
  await page
    .locator('input[type="file"][accept="image/*"]')
    .setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: PNG });

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

test("any member gives a group a picture, shown in place of its members, and removes it (#188)", async ({
  page,
  backend,
}) => {
  await page.goto("/groups/g-running");
  const add = page.getByRole("button", { name: "Tilføj et billede til gruppen" });
  await expect(add).toBeVisible();
  await page
    .locator('input[type="file"][accept="image/*"]')
    .setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: PNG });
  await expect
    .poll(() => backend.calls.find((c) => c.body.action === "set-group-picture")?.body)
    .toMatchObject({ groupId: "g-running", image: expect.stringMatching(/^\/9j\//) });
  const change = page.getByRole("button", { name: "Skift gruppens billede" });
  await expect(change.locator("img")).toBeVisible();

  await page.getByRole("button", { name: "Fjern billede" }).click();
  await expect(add).toBeVisible();
  expect(backend.world.groups.find((g) => g.id === "g-running")?.pictureUrl).toBeNull();
});
