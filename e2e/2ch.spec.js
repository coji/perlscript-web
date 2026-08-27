import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/examples/2ch.html#/php/", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.removeItem("perlscript-web/2ch/threads-v3"));
  await page.reload({ waitUntil: "domcontentloaded" });
});

test("routes between board, thread, and subback", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "WEBプログラミング＠PerlUI掲示板" })).toBeVisible();
  await page.getByRole("link", { name: "ブラウザでPerlを動かすスレ" }).first().click();
  await expect(page).toHaveURL(/#\/test\/read\.cgi\/php\/1018267179\/$/);
  await expect(page.getByText("DOMより先にfilehandleとして見えそう。")).toBeVisible();
  await page.getByRole("link", { name: "スレッド一覧" }).click();
  await expect(page).toHaveURL(/#\/php\/subback\.html$/);
  await expect(page.getByRole("heading", { name: "WEBプログラミング板＠スレッド一覧" })).toBeVisible();
});

test("tours distinct boards and their own threads", async ({ page }) => {
  const boards = [
    ["プログラマー", "納期まであと二週間なわけだが", "議事録を書く時間もスケジュールにありません。"],
    ["UNIX", "自宅サーバのuptimeを晒すスレ", "止めたら何が起きるか誰も知らない。"],
    ["Web制作", "かっこいい入口ページを作りたい", "MIDIも自動再生にしておきます。"],
    ["レンタルサーバ", "CGIが使える格安鯖を探してます", "まず掲示板を置いて様子を見ます。"],
  ];
  await page.getByRole("link", { name: "■ 掲示板一覧 ■" }).click();
  for (const [board, thread, finalPost] of boards) {
    await page.getByRole("link", { name: board, exact: true }).click();
    await expect(page.getByRole("heading", { name: `${board}＠PerlUI掲示板` })).toBeVisible();
    await page.getByRole("link", { name: thread }).first().click();
    await expect(page.getByText(finalPost)).toBeVisible();
    await page.getByRole("link", { name: "■ 掲示板一覧 ■" }).click();
  }
});

test("each seeded thread has its own conversation", async ({ page }) => {
  const conversations = [
    ["ブラウザでPerlを動かすスレ", "1987年の文法のまま、実行環境だけ2026年にするということか。"],
    ["正規表現道場＠Webプログラミング", "ブラウザの戻るボタンまでwatchで拾えるならrouterとして十分だな。"],
    ["Perlで作ったサイトを語ろう", "それ全部Perlでできるじゃん。"],
    ["【Perl】初心者コーナー＠PerlUI", "HTML文字列は渡せないので、そのほうが安全でもある。"],
    ["localStorageをファイルとして使う", "ブラウザがファイルシステムに見えてきた。"],
  ];
  for (const [title, finalPost] of conversations) {
    await page.getByRole("link", { name: title }).first().click();
    await expect(page.getByText(finalPost)).toBeVisible();
    await page.getByRole("link", { name: "掲示板に戻る" }).first().click();
  }
});

test("creates a thread, replies, persists it, and exposes editable Perl", async ({ page }) => {
  await expect(page.getByLabel("題名：")).toHaveCount(0);
  await page.getByRole("link", { name: "新規スレッド作成画面へ" }).click();
  await expect(page).toHaveURL(/#\/test\/new\.cgi\/php\/$/);
  await page.getByLabel("題名：").fill("Perl 1.0でUIを作るスレ");
  await page.getByLabel("本文：").fill("routerもstorageもfilehandleだった。");
  await page.getByRole("button", { name: "新規スレッド作成" }).click();
  await expect(page).toHaveURL(/#\/test\/read\.cgi\/php\/[0-9]+\/$/);
  await expect(page.getByRole("heading", { name: "Perl 1.0でUIを作るスレ" })).toBeVisible();
  await page.getByLabel("本文：").fill("保存後の返信です。");
  await page.getByRole("button", { name: "書き込む" }).click();
  await expect(page.getByText("保存後の返信です。")).toBeVisible();
  await page.reload();
  await expect(page.getByText("保存後の返信です。")).toBeVisible();
  await page.getByRole("button", { name: "Perlソース" }).click();
  await expect(page.getByRole("textbox", { name: "Perl source" })).toHaveValue(/route:hash/);
  await expect(page.getByRole("button", { name: "Run Perl" })).toBeVisible();
});
