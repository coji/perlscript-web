import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Runtime } from "../src/runtime.js";
import { BrowserIO } from "../src/browser-io.js";
import { FakeElement, createFakeDocument } from "./helpers/fake-dom.js";

test("the mixi archive keeps navigation, diaries, footprints, communities, and clock in Perl", async () => {
  const html = await readFile(new URL("../examples/mixi.html", import.meta.url), "utf8");
  const source = html.match(/<script id="app"[^>]*>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(source);
  assert.match(source, /open ROUTE, "route:hash"/);
  assert.match(source, /open CLOCK, "clock:60000"/);
  assert.match(source, /storage:local:perlscript-web\/mixi\/diaries-v2/);
  assert.match(source, /storage:local:perlscript-web\/mixi\/footprints-v1/);
  assert.match(source, /storage:local:perlscript-web\/mixi\/communities-v1/);
  assert.match(source, /storage:local:perlscript-web\/mixi\/profile-photo-v1/);
  assert.match(source, /open IMAGE, "stream:image"/);
  assert.match(source, /open STYLE, ">css:mixi-2005"/);
  assert.match(source, /--mixi-orange:#f69223/);
  assert.match(source, /header-banner-v1\.webp/);
  assert.match(source, /width:720px/);
  assert.doesNotMatch(html, /fonts\.googleapis\.com/);

  const root = new FakeElement();
  const stored = new Map();
  const local = {
    getItem: key => stored.get(key) ?? null,
    setItem: (key, value) => stored.set(key, String(value)),
    removeItem: key => stored.delete(key),
  };
  let route = "/home.pl";
  const listeners = new Map();
  const navigation = {
    location: { hash: `#${route}`, pathname: "/examples/mixi.html", search: "" },
    history: { pushState(_state, _title, value) { route = value; navigation.location.pathname = value; } },
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener(type) { listeners.delete(type); },
  };
  const document = createFakeDocument({ "#app-root": root }).document;
  const runtime = new Runtime({ io: new BrowserIO(document, {
    storage: { local },
    streams: { image: () => ({ write() {} }) },
    clock: { now: () => 1787760000000, setInterval: () => 1, clearInterval() {} },
    navigation,
  }) });

  runtime.run(source);
  assert.match(root.textContent, /マイミクシィ最新日記/);
  assert.match(root.textContent, /日記コメント記入履歴/);
  assert.match(root.textContent, /コミュニティ最新書き込み/);
  assert.match(root.textContent, /マイミクシィ最新レビュー/);
  assert.match(root.textContent, /機能制限に関するお知らせ/);
  assert.doesNotMatch(root.textContent, /このデモについて/);
  assert.match(root.textContent, /ブラウザでPerlが動いた/);
  assert.equal(runtime.arrays.users.length, 10);
  assert.equal(runtime.arrays.diaries.length, 10);
  assert.equal(runtime.arrays.communities.length, 2);
  assert.match(root.textContent, /Dan Kogai/);
  assert.match(root.textContent, /miyagawa/);
  assert.match(root.textContent, /naoya/);
  assert.match(root.textContent, /lestrrat/);
  assert.match(root.textContent, /衛藤バタラ/);

  const routeCases = [
    ["/login.pl", ["community entertainment", "次回から自動的にログイン"]],
    ["/register.pl", ["新規登録", "登録内容を確認する"]],
    ["/show_friend.pl?id=7", ["miyagawaのプロフィール", "miyagawaさんの最新の日記", "フィードを一か所に集めたい"]],
    ["/list_diary.pl?id=6", ["Dan Kogaiさんの日記", "use Encode;"]],
    ["/show_friend.pl?id=10", ["衛藤バタラのプロフィール", "mixiの企画と初期開発", "またサーバを買いに行く"]],
    ["/view_diary.pl?id=106&owner_id=6", ["use Encode;", "コメントを書く"]],
    ["/add_diary.pl", ["日記を書く", "写真3", "公開範囲", "日記を公開する"]],
    ["/show_log.pl", ["最近の足あと", "ページ全体のアクセス数"]],
    ["/list_community.pl", ["参加コミュニティ一覧", "Perl Mongers Japan"]],
    ["/view_community.pl?id=10", ["Perl Mongers Japan", "新着のトピック", "参加条件と公開レベル"]],
    ["/list_message.pl", ["受信メッセージ", "デモ見ました"]],
    ["/search.pl", ["検索", "出身地", "キーワード"]],
    ["/invite.pl", ["友人をmixiに招待する", "招待メールを送る"]],
    ["/add_friend.pl?id=7", ["マイミクシィに追加", "miyagawa", "メッセージ（任意）"]],
    ["/edit_profile.pl", ["プロフィール変更", "趣味", "変更内容を確認する"]],
    ["/edit_photo.pl", ["写真を編集する", "512×512", "写真をアップロードする"]],
    ["/edit_account.pl", ["設定変更", "RSSのURL", "日記・ブログの選択"]],
    ["/calendar.pl", ["2005年08月のカレンダー", "YAPC打ち合わせ"]],
    ["/search_community.pl", ["コミュニティを検索・並び替える", "メンバー数順"]],
    ["/review.pl", ["おすすめレビュー", "Programming Perl"]],
  ];
  for (const [nextRoute, expected] of routeCases) {
    runtime.scalars.route = nextRoute;
    runtime.markDirty();
    assert.doesNotThrow(() => runtime.flushUI(), nextRoute);
    for (const text of expected) assert.match(root.textContent, new RegExp(text));
  }
  runtime.scalars.route = "/view_diary.pl?id=106&owner_id=6";
  runtime.markDirty();
  runtime.flushUI();
  assert.match(root.textContent, /最近のコメント/);
  assert.match(root.textContent, /各月の日記/);
  assert.doesNotMatch(root.textContent, /Dan Kogaiさんのマイミクシィ一覧/);

  const createDiary = (title, body) => {
    runtime.scalars.route = "/add_diary.pl";
    runtime.scalars.diary_title = title;
    runtime.scalars.diary_body = body;
    runtime.call("create_diary", []);
    runtime.flushUI();
  };
  runtime.scalars.diary_photo1 = "data:image/webp;base64,AAAA";
  runtime.scalars.diary_photo2 = "data:image/jpeg;base64,BBBB";
  createDiary("Perlで書いた日記", "routeもstorageも普通のfilehandleだった。");
  assert.equal(navigation.location.hash, "#/view_diary.pl?id=111&owner_id=1");
  createDiary("同じ分に書いた二件目", "時計が進まなくても別の日記になる。");
  assert.equal(navigation.location.hash, "#/view_diary.pl?id=112&owner_id=1");
  const diaries = JSON.parse(stored.get("perlscript-web/mixi/diaries-v2"));
  assert.deepEqual(diaries.slice(0, 2).map(diary => diary.id), [112, 111]);
  assert.equal(diaries[0].title, "同じ分に書いた二件目");
  assert.equal(diaries[0].owner, "1");
  assert.deepEqual(diaries[1].photos, ["data:image/webp;base64,AAAA", "data:image/jpeg;base64,BBBB"]);
  assert.deepEqual(diaries[0].photos, []);
  assert.match(diaries[0].date, /^2005年08月27日 [0-9]{2}:[0-9]{2}$/);
  assert.match(runtime.call("display_timestamp", ["UNIX 1787870587"]), /^2005年08月27日 [0-9]{2}:[0-9]{2}$/);

  runtime.scalars.route = "/view_diary.pl?id=111&owner_id=1";
  runtime.scalars.comment_body = "当時の画面にかなり近づいた。";
  runtime.call("add_comment", []);
  const commentedDiaries = JSON.parse(stored.get("perlscript-web/mixi/diaries-v2"));
  assert.equal(commentedDiaries.find(diary => diary.id === 111).comments.at(-1).body, "当時の画面にかなり近づいた。");

  runtime.scalars.route = "/view_community.pl?id=10";
  runtime.scalars.topic_body = "昔のYAPCの話をしましょう。";
  runtime.call("add_topic_reply", []);
  const communities = JSON.parse(stored.get("perlscript-web/mixi/communities-v1"));
  assert.equal(communities[0].topics[0].body, "昔のYAPCの話をしましょう。");

  runtime.scalars.route = "/home.pl";
  runtime.markDirty();
  assert.doesNotThrow(() => runtime.flushUI());
  assert.ok(root.textContent.indexOf("同じ分に書いた二件目") < root.textContent.indexOf("Perlで書いた日記"));

  runtime.scalars.route = "/search.pl";
  runtime.scalars.search_keyword = "Perl";
  runtime.call("run_search", []);
  runtime.flushUI();
  assert.match(runtime.scalars.search_result_message, /Perl/);
  assert.match(root.textContent, /一致するメンバー/);

  runtime.scalars.route = "/invite.pl";
  runtime.scalars.invite_email = "friend@example.jp";
  runtime.call("send_invitation", []);
  runtime.flushUI();
  assert.equal(runtime.scalars.invite_sent, 1);
  assert.match(root.textContent, /招待メールを送信しました/);

  runtime.scalars.route = "/add_friend.pl?id=7";
  runtime.call("send_friend_request", []);
  runtime.flushUI();
  assert.equal(runtime.scalars.friend_request_sent, 1);
  assert.match(root.textContent, /追加リクエストを送信しました/);

  runtime.scalars.view_user = "2";
  runtime.call("record_footprint", []);
  const footprints = JSON.parse(stored.get("perlscript-web/mixi/footprints-v1"));
  assert.deepEqual({ owner: footprints.at(-1).owner, user: footprints.at(-1).user }, { owner: "2", user: "1" });
  runtime.dispose();
});
