import { test, expect } from "@playwright/test";

test("PerlUI Counter reacts while preserving its button", async ({ page }) => {
  await page.goto("/examples/counter.html");
  await expect(page.getByRole("textbox", { name: "Perl source" })).toHaveValue(/\$count = 0;/);
  await expect(page.getByRole("status")).toHaveText("Run 1 complete");
  const button = page.getByRole("button", { name: "Count: 0" });
  await expect(button).toBeVisible();
  const identity = await button.evaluate(element => {
    globalThis.counterButton = element;
    return element.tagName;
  });
  expect(identity).toBe("BUTTON");
  await button.click();
  await expect(page.getByRole("button", { name: "Count: 1" })).toBeVisible();
  expect(await page.locator("#app-root button").evaluate(element => element === globalThis.counterButton)).toBe(true);

  const source = page.getByRole("textbox", { name: "Perl source" });
  await source.fill((await source.inputValue()).replace("$count = 0;", "$count = 41;"));
  await page.getByRole("button", { name: "Run Perl" }).click();
  await expect(page.getByRole("button", { name: "Count: 41" })).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("Run 2 complete");
});

test("PerlUI Todo binds, submits, toggles, and removes keyed items", async ({ page }) => {
  await page.goto("/examples/todo.html");
  const input = page.getByRole("textbox", { name: "New todo" });
  await page.locator(".todo").first().evaluate(element => { globalThis.firstTodo = element; });
  await input.pressSequentially("Ship PerlUI");
  await expect(input).toBeFocused();
  expect(await input.evaluate(element => element.selectionStart)).toBe("Ship PerlUI".length);
  await page.getByRole("button", { name: "Add" }).click();
  await expect(input).toHaveValue("");
  await expect(page.getByText("Ship PerlUI", { exact: true })).toBeVisible();
  await expect(page.locator(".todo")).toHaveCount(3);
  expect(await page.locator(".todo").first().evaluate(element => element === globalThis.firstTodo)).toBe(true);

  const item = page.locator(".todo").filter({ hasText: "Ship PerlUI" });
  await item.getByRole("checkbox").click();
  await expect(item).toHaveAttribute("data-done", "1");
  await item.getByRole("button", { name: "Remove todo" }).click();
  await expect(page.getByText("Ship PerlUI", { exact: true })).toHaveCount(0);
  await expect(page.locator(".todo")).toHaveCount(2);
});
