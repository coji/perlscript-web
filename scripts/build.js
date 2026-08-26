import { build } from "esbuild";

const shared = {
  entryPoints: ["src/auto.js"],
  bundle: true,
  platform: "browser",
  format: "iife",
  globalName: "PerlScript",
};

await Promise.all([
  build({
    ...shared,
    outfile: "dist/perlscript-web.js",
    sourcemap: true,
  }),
  build({
    ...shared,
    outfile: "dist/perlscript-web.min.js",
    minify: true,
    legalComments: "inline",
  }),
]);
