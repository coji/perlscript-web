import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/examples/bbs.html");
  await expect(page.locator("#count")).toHaveText("0");
});

test("posts, filters, and ignores IME composition", async ({ page }) => {
  await page.locator("#message").fill("first");
  await page.locator("#post").click();
  await page.locator("#name").fill("coji");
  await page.locator("#message").fill("Perl at YAPC");
  await page.locator("#message").press("Enter");

  await expect(page.locator("#count")).toHaveText("2");
  await expect(page.locator("#posts")).toHaveText("anonymous\tfirst\ncoji\tPerl at YAPC");

  await page.locator("#search").fill("perl|yapc");
  await expect(page.locator("#posts")).toHaveText("coji\tPerl at YAPC");

  await page.locator("#message").fill("must not post");
  await page.locator("#message").dispatchEvent("keydown", { key: "Enter", keyCode: 229, isComposing: true });
  await expect(page.locator("#count")).toHaveText("2");
});

test("shows event errors and recovers with the same listener", async ({ page }) => {
  await page.locator("#message").fill("Perl survives");
  await page.locator("#post").click();

  await page.locator("#search").fill("[");
  await expect(page.locator("#error")).toBeVisible();
  await expect(page.locator("#error-title")).toContainText("PerlScriptRuntimeError");

  await page.locator("#search").fill("perl");
  await expect(page.locator("#error")).toBeHidden();
  await expect(page.locator("#posts")).toContainText("Perl survives");
});

test("a failed editor run preserves the previous app", async ({ page }) => {
  const original = await page.locator("#source").inputValue();
  await page.locator("#source").fill("do missing();");
  await page.locator("#run").click();
  await expect(page.locator("#error")).toBeVisible();
  await expect(page.locator("#error-title")).toContainText("Undefined subroutine missing");

  await page.locator("#message").fill("old runtime is alive");
  await page.locator("#post").click();
  await expect(page.locator("#count")).toHaveText("1");

  await page.locator("#source").fill(original);
  await page.locator("#run").click();
  await expect(page.locator("#error")).toBeHidden();
  await expect(page.locator("#count")).toHaveText("0");
});
