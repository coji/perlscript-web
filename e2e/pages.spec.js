import { expect, test } from "@playwright/test";

test("the Pages landing opens the live BBS and command palette", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Perl is the UI." })).toBeVisible();
  const demo = page.frameLocator("iframe[title='Editable perlscript-web BBS demo']");
  await demo.getByRole("button", { name: "Run Perl" }).click();
  await expect(demo.locator("#count")).toHaveText("0");

  await page.getByRole("button", { name: /Open/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("link", { name: "Run the BBS" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
});

for (const width of [320, 375, 414, 768]) {
  test(`the Pages landing has no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
    }));
    expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
    await expect(page.getByRole("link", { name: "Run the BBS" })).toHaveCSS("white-space", "nowrap");
  });
}
