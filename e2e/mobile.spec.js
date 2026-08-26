import { expect, test } from "@playwright/test";

const pages = [
  "/",
  "/examples/counter.html",
  "/examples/bbs.html",
  "/examples/todo.html",
  "/examples/hello.html",
];

for (const width of [320, 375, 414, 768]) {
  test(`every page is usable without horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });

    for (const path of pages) {
      await page.goto(path);
      const layout = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        content: document.documentElement.scrollWidth,
        overflow: getComputedStyle(document.documentElement).overflowX,
      }));
      expect(layout.content, `${path} overflows at ${width}px`).toBeLessThanOrEqual(layout.viewport);
      expect(layout.overflow, `${path} does not clip root overflow`).toBe("clip");

      const wrappedAffordances = await page.locator("a:visible, button:visible").evaluateAll(elements => elements
        .filter(element => getComputedStyle(element).whiteSpace !== "nowrap")
        .map(element => element.textContent?.trim()));
      expect(wrappedAffordances, `${path} has wrapping affordances`).toEqual([]);
    }
  });
}

test("mobile workbenches expose the useful pane and switch without scrolling through both", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });

  await page.goto("/examples/counter.html");
  await expect(page.getByRole("button", { name: "Preview" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Count: 0" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Perl source" })).toBeHidden();
  await page.getByRole("button", { name: "Source" }).click();
  await expect(page.getByRole("textbox", { name: "Perl source" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Count: 0" })).toBeHidden();

  await page.goto("/examples/bbs.html");
  await expect(page.getByRole("button", { name: "Source" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("textbox", { name: "Perl source" })).toBeVisible();
  await page.getByRole("button", { name: "Run Perl" }).click();
  await expect(page.getByRole("button", { name: "Preview" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("heading", { name: "Guestbook" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Perl source" })).toBeHidden();
});
