# Releasing

## Release candidate checklist

1. Run `pnpm install --frozen-lockfile` in a clean checkout.
2. Run `pnpm run check`.
3. Install Playwright browsers with `pnpm exec playwright install chromium firefox webkit` and run `pnpm run test:e2e`.
4. Run `pnpm pack --dry-run` and inspect the included files.
5. Test the produced tarball from a separate fixture project.
6. Publish a prerelease with `pnpm publish --tag next --provenance` or create a GitHub prerelease for the publish workflow.
7. Verify the exact prerelease from npm, jsDelivr, and unpkg using both inline and external `text/perl` examples.
8. Promote only after the release candidate has no open profile-conformance or cross-browser regressions.

## Stable release

1. Update `CHANGELOG.md` and the version together.
2. Ensure CI is green on the release commit.
3. Create a signed `vX.Y.Z` tag and GitHub release.
4. Let the publish workflow run with npm provenance.
5. Verify package metadata, ESM imports, declaration files, IIFE globals, source maps, and CDN examples.

Publishing is intentionally not performed by local tests or `pnpm run check`.
