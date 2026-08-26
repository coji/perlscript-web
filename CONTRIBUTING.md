# Contributing

Issues and pull requests are welcome. Changes to language behavior must include conformance tests and must agree with [Perl 1 Web Profile 1.0](docs/PERL1-WEB-PROFILE.md). Proposed syntax outside that profile should explain its compatibility and migration impact.

## Local checks

Use Node.js 20 or newer.

```sh
pnpm install --frozen-lockfile
pnpm run check
pnpm exec playwright install chromium firefox webkit
pnpm run test:e2e
```

Keep source modules strictly type-checked through JSDoc. Browser behavior needs both a focused fake-DOM test where practical and an end-to-end test for user-visible integration.
