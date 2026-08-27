import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/examples/mixi.html#/home.pl", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    localStorage.removeItem("perlscript-web/mixi/diaries-v2");
    localStorage.removeItem("perlscript-web/mixi/footprints-v1");
    localStorage.removeItem("perlscript-web/mixi/communities-v1");
  });
  await page.reload({ waitUntil: "domcontentloaded" });
});

test("opens on the meadow login and enters the 2005 network", async ({ page }) => {
  await page.goto("/examples/mixi.html", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("region", { name: "青空と草原のログイン画面" })).toBeVisible();
  await expect(page.getByRole("img")).toHaveCount(0);
  await expect(page.getByLabel("e-mail")).toHaveValue("perl@example.jp");
  await page.getByRole("button", { name: "ログイン" }).click();
  await expect(page).toHaveURL(/#\/home\.pl$/);
  await expect(page.getByRole("heading", { name: "最新情報" })).toBeVisible();
});

test("tours the 2005 home, profiles, footprints, messages, and communities", async ({ page }) => {
  await expect(page.getByRole("link", { name: "mixi ホーム" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "最新情報" })).toBeVisible();
  await expect(page.getByText("マイミクシィ最新日記")).toBeVisible();
  await expect(page.getByText("Dan Kogai", { exact: true })).toBeVisible();
  await expect(page.getByText("miyagawa", { exact: true })).toBeVisible();
  await expect(page.getByText("naoya", { exact: true })).toBeVisible();
  await expect(page.getByText("lestrrat", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: /Dan Kogaiのプロフィール画像 Dan Kogai/ }).click();
  await expect(page.getByRole("heading", { name: "Dan Kogaiのプロフィール" })).toBeVisible();
  await expect(page.getByText(/写真は公開プロフィールを参考にしたAIによる2005年当時の再現/)).toBeVisible();
  await page.getByRole("link", { name: "日記をすべて読む" }).click();
  await expect(page.locator(".left-rail")).toContainText("最近のコメント");
  await expect(page.locator(".left-rail")).toContainText("各月の日記");
  await expect(page.locator(".left-rail .profile-mini")).toHaveCount(0);
  await page.locator(".main-column").getByRole("link", { name: "use Encode;", exact: true }).click();
  await expect(page.locator(".left-rail")).toContainText("use Encode;");
  await expect(page.locator(".left-rail .profile-mini")).toHaveCount(0);
  await page.getByRole("link", { name: "ホーム", exact: true }).click();

  await page.getByRole("link", { name: /シフトさんのプロフィール画像 シフトさん/ }).click();
  await expect(page).toHaveURL(/#\/show_friend\.pl\?id=2$/);
  await expect(page.getByRole("heading", { name: "シフトさんのプロフィール" })).toBeVisible();
  const footprints = await page.evaluate(() => JSON.parse(localStorage.getItem("perlscript-web/mixi/footprints-v1")));
  expect(footprints.at(-1)).toMatchObject({ owner: "2", user: "1" });

  await page.getByRole("link", { name: "足あと", exact: true }).click();
  await expect(page.getByRole("heading", { name: "最近の足あと" })).toBeVisible();
  await expect(page.getByText(/ページ全体のアクセス数：3508/)).toBeVisible();

  await page.getByRole("link", { name: "メッセージ", exact: true }).click();
  await expect(page.getByRole("heading", { name: "受信メッセージ" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "デモ見ました" })).toBeVisible();

  await page.getByRole("link", { name: "コミュニティ", exact: true }).click();
  await page.getByRole("link", { name: "Perl Mongers Japan" }).click();
  await expect(page.getByRole("heading", { name: "Perl Mongers Japan" })).toBeVisible();
  await expect(page.getByText("ブラウザでPerlを動かす会")).toBeVisible();
});

test("writes a diary, comments on it, and persists both", async ({ page }) => {
  await page.getByRole("link", { name: "日記", exact: true }).click();
  await page.getByRole("link", { name: "日記を書く" }).click();
  await page.getByLabel("タイトル").fill("Perlで書いた日記");
  await page.getByLabel("本文").fill("routeもstorageも普通のfilehandleだった。");
  await page.getByRole("button", { name: "日記を公開する" }).click();
  await expect(page).toHaveURL(/#\/view_diary\.pl\?id=[0-9]+&owner_id=1$/);
  await expect(page.getByRole("heading", { name: "Perlで書いた日記" })).toBeVisible();
  await page.getByLabel("コメントを書く").fill("ブラウザを閉じても残りました。");
  await page.getByRole("button", { name: "コメントする" }).click();
  await expect(page.getByText("ブラウザを閉じても残りました。")).toBeVisible();
  await page.reload();
  await expect(page.getByText("ブラウザを閉じても残りました。")).toBeVisible();
});

test("writes to a community and exposes the editable Perl program", async ({ page }) => {
  await page.getByRole("link", { name: "コミュニティ", exact: true }).click();
  await page.getByRole("link", { name: "Web制作の現場" }).click();
  await page.getByLabel("このコミュニティに書き込む").fill("角丸をCSSだけで作れました。");
  await page.getByRole("button", { name: "書き込む" }).click();
  await expect(page.getByText("角丸をCSSだけで作れました。")).toBeVisible();
  await page.getByRole("link", { name: "ホーム", exact: true }).click();
  await expect(page.getByText("Re: コミュニティの話題")).toBeVisible();
  await page.getByRole("button", { name: "Perlソース" }).click();
  const editor = page.getByRole("textbox", { name: "Perl source" });
  await expect(editor).toHaveValue(/route:hash/);
  await expect(editor).toHaveValue(/storage:local:perlscript-web\/mixi\/footprints-v1/);
  await expect(editor).toHaveValue(/storage:local:perlscript-web\/mixi\/diaries-v2/);
  await expect(page.getByRole("button", { name: "Run Perl" })).toBeVisible();
});
