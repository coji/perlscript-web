import { test, expect } from "@playwright/test";

test("Perl routes, captures parameters, persists location, and follows browser history", async ({ page }) => {
  await page.goto("/examples/hello.html#/start");
  const source = String.raw`
    $route = "";
    $board = "";
    $thread = "";
    $changes = 0;

    sub route_changed {
      $route = <ROUTE>;
      if ($route =~ /^\/test\/read\.cgi\/([A-Za-z0-9_]+)\/([0-9]+)$/) {
        $board = $1;
        $thread = $2;
      }
      open LAST_ROUTE, ">storage:session:router/last";
      print LAST_ROUTE $route;
      $changes++;
    }

    open ROUTE, "route:hash";
    do watch(ROUTE, "route_changed");
    print ROUTE "/test/read.cgi/perl/1234567890";
  `;

  await page.evaluate(async perl => {
    const [{ Runtime }, { BrowserIO }] = await Promise.all([
      import("/src/runtime.js"),
      import("/src/browser-io.js"),
    ]);
    globalThis.routerRuntime = new Runtime({ io: new BrowserIO(document) }).run(perl);
  }, source);

  await expect(page).toHaveURL(/#\/test\/read\.cgi\/perl\/1234567890$/);
  expect(await page.evaluate(() => ({
    route: globalThis.routerRuntime.scalars.route,
    board: globalThis.routerRuntime.scalars.board,
    thread: globalThis.routerRuntime.scalars.thread,
    stored: sessionStorage.getItem("router/last"),
  }))).toEqual({
    route: "/test/read.cgi/perl/1234567890",
    board: "perl",
    thread: "1234567890",
    stored: "/test/read.cgi/perl/1234567890",
  });

  await page.goBack();
  await expect(page).toHaveURL(/#\/start$/);
  await expect.poll(() => page.evaluate(() => globalThis.routerRuntime.scalars.route)).toBe("/start");
  expect(await page.evaluate(() => sessionStorage.getItem("router/last"))).toBe("/start");
  await page.evaluate(() => globalThis.routerRuntime.dispose());
});

test("a clock filehandle ticks and stops with its runtime", async ({ page }) => {
  await page.goto("/examples/hello.html");
  await page.evaluate(async () => {
    const [{ Runtime }, { BrowserIO }] = await Promise.all([
      import("/src/runtime.js"),
      import("/src/browser-io.js"),
    ]);
    globalThis.clockRuntime = new Runtime({ io: new BrowserIO(document) }).run(`
      $ticks = 0;
      $now = 0;
      sub clock_tick { $now = <CLOCK>; $ticks++; }
      open CLOCK, "clock:20";
      do watch(CLOCK, "clock_tick");
    `);
  });

  await expect.poll(() => page.evaluate(() => globalThis.clockRuntime.scalars.ticks)).toBeGreaterThan(0);
  const stoppedAt = await page.evaluate(() => {
    const ticks = globalThis.clockRuntime.scalars.ticks;
    globalThis.clockRuntime.dispose();
    return ticks;
  });
  await page.waitForTimeout(80);
  expect(await page.evaluate(() => globalThis.clockRuntime.scalars.ticks)).toBe(stoppedAt);
});
