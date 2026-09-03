import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Jest injected describe/it/expect as globals; several shared test helpers
    // (tests/models/testUtils.js, tests/test_utilities.js) rely on that rather
    // than importing them. Keeping globals on avoids rewriting those helpers.
    globals: true,
    include: ["tests/**/*.test.{js,ts}"],
    // Model expectations come from the upstream validation-data repository over
    // the network (see tests/models/comftest.js); the default 5s can be tight
    // on a cold connection.
    testTimeout: 20_000,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/index.ts"],
    },
  },
});
