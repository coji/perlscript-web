import { test, expect } from "@playwright/test";

test("PerlGPT configures a secret and streams an API response from its Perl program", async ({ page }) => {
  test.setTimeout(60_000);
  let requestBody;
  await page.route("https://api.openai.com/v1/responses", async route => {
    requestBody = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: [
        'data: {"type":"response.output_text.delta","delta":"Perlが"}\n\n',
        'data: {"type":"response.output_text.delta","delta":"読みました。"}\n\n',
        'data: {"type":"response.completed","response":{"id":"resp_demo"}}\n\n',
        "data: [DONE]\n\n",
      ].join(""),
    });
  });

  await page.goto("/examples/perlgpt.html");
  await expect(page.getByRole("button", { name: "PerlGPT 1.0" })).toBeVisible();
  const perlStyle = page.locator('style[data-perlscript-css="perlgpt"]');
  await expect(perlStyle).toHaveCount(1);
  expect(await perlStyle.evaluate(element => element.textContent)).toContain(".chat-app");
  await expect(page.locator('script[src*="ace-builds"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Source", exact: true }).click();
  await expect(page.locator("#source-editor.ace_editor")).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("#source-editor .ace_keyword").first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByLabel("Perl runtime inspector")).toContainText("APP");
  await expect(page.getByLabel("Perl runtime inspector")).toContainText("ui");
  await page.getByRole("button", { name: "I/O", exact: true }).click();
  expect(await page.evaluate(() => {
    const editor = globalThis.ace.edit("source-editor");
    return editor.session.getLine(editor.getCursorPosition().row);
  })).toContain("sub connect_http");
  expect(await page.evaluate(() => globalThis.ace.edit("source-editor").getValue())).toContain("sub request_chat");
  await page.evaluate(() => globalThis.ace.edit("source-editor").session.insert({ row: 0, column: 0 }, "# edited in Ace\n"));
  await page.getByRole("button", { name: "Run Perl" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-source-open", "false");
  await expect(page.locator('style[data-perlscript-css="perlgpt"]')).toHaveCount(1);
  await page.getByRole("button", { name: "PerlGPT 1.0" }).click();
  await page.getByLabel("OpenAI API key").fill("sk-test-only");
  await page.getByRole("button", { name: "保存" }).click();

  await page.getByRole("textbox", { name: "レビューしてほしいコードや質問" }).fill("このコードを見て");
  await page.getByRole("button", { name: "送信" }).click();

  await expect(page.getByLabel("PerlGPT preview").getByText("Perlが読みました。", { exact: true })).toBeVisible();
  expect(requestBody.model).toBe("gpt-5.6-luna");
  expect(requestBody.reasoning).toEqual({ effort: "none" });
  expect(requestBody.stream).toBe(true);
  expect(requestBody.input).toContain("このコードを見て");
  expect(requestBody.input).toContain("sub request_chat");
  expect(requestBody.input).toContain("# edited in Ace");

  await page.getByRole("button", { name: "Source", exact: true }).click();
  const inspector = page.getByLabel("Perl runtime inspector");
  await expect(inspector).toContainText("write HTTP");
  await expect(inspector).toContainText("read HTTP");
  await expect(inspector).not.toContainText("sk-test-only");
  await page.locator("#source-close").click();

  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("perlgpt/chats")));
  expect(saved[0]).toMatchObject({ title: "このコードを見て", answer: "Perlが読みました。", response_id: "resp_demo" });

  await page.reload();
  await page.getByRole("button", { name: "このコードを見て", exact: true }).click();
  await expect(page.getByLabel("PerlGPT preview").getByText("Perlが読みました。", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "このコードを見て を削除" }).click();
  await expect(page.getByRole("button", { name: "このコードを見て", exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("perlgpt/chats")))).toEqual([]);
});
