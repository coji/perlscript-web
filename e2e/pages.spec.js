import { expect, test } from "@playwright/test";

test("the Pages landing runs the live Counter and opens the command palette", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Perl is the UI." })).toBeVisible();
  const demo = page.frameLocator("iframe[title='Live PerlUI Counter demo']");
  await expect(demo.getByRole("button", { name: "Source" })).toBeVisible();
  await demo.getByRole("button", { name: "Count: 0" }).click();
  await expect(demo.getByRole("button", { name: "Count: 1" })).toBeVisible();

  await page.getByRole("button", { name: /Open/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("link", { name: "Run the BBS" })).toBeVisible();
  await expect(dialog.getByRole("link", { name: "Enter the 2ch archive" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
});

for (const width of [320, 375, 414, 768]) {
  test(`the Pages landing has no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
    }));
    expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
    await expect(page.getByRole("link", { name: "Try the Counter" })).toHaveCSS("white-space", "nowrap");
  });
}
