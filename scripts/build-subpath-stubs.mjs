// Legacy TypeScript/bundler resolution ("node10") predates the `exports` field:
// it resolves `jsthermalcomfort/models` by looking for a real ./models directory
// in the package. These stubs give it one. Modern resolvers ignore them entirely
// and go through `exports`.
//
// Generated at build time and listed in package.json "files", so they ship in the
// tarball without being committed. Verified by `attw --pack .` in CI.
import { mkdirSync, writeFileSync } from "node:fs";

const SUBPATHS = [
  "models",
  "psychrometrics",
  "utilities",
  "reference",
  "io",
  "charts",
];

for (const sub of SUBPATHS) {
  mkdirSync(sub, { recursive: true });
  writeFileSync(
    `${sub}/package.json`,
    JSON.stringify(
      {
        main: `../lib/cjs/${sub}/index.js`,
        module: `../lib/esm/${sub}/index.js`,
        types: `../lib/cjs/types/${sub}/index.d.ts`,
        sideEffects: false,
      },
      null,
      2,
    ) + "\n",
  );
}
console.log(`generated node10 stubs for: ${SUBPATHS.join(", ")}`);
