// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["lib/**", "docs/**", "coverage/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts"],
    rules: {
      // ADR §4.0.3 / §6: the build sets `erasableSyntaxOnly`, which already
      // rejects these. Linting them too gives the error at edit time with a
      // message that says what to do instead.
      "no-restricted-syntax": [
        "error",
        {
          selector: "TSEnumDeclaration",
          message:
            "No `enum` (erasableSyntaxOnly). Use a class with `static readonly` instances.",
        },
        {
          selector: "TSModuleDeclaration[kind='namespace']",
          message: "No `namespace` (erasableSyntaxOnly). Use modules.",
        },
        {
          selector: "TSParameterProperty",
          message:
            "No constructor parameter properties (erasableSyntaxOnly). Declare the field and assign it in the constructor body.",
        },
      ],
      "@typescript-eslint/consistent-type-imports": "error",
      // `const { warnings, ...result } = …` is how a field is dropped from a
      // return value; the named sibling is the point, not an unused variable.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { ignoreRestSiblings: true },
      ],
    },
  },
  {
    // Ported verbatim from jsthermalcomfort 1.4.0 and pinned byte-for-byte by
    // tests/baseline.test.ts. Dead stores, unused locals and empty catch
    // bindings are carried over from the original; leaving them in place keeps
    // these files auditable against upstream, which matters more here than
    // tidiness. Purely syntactic fixes (prefer-const) are still applied.
    files: [
      "src/models/adaptive_en.ts",
      "src/models/cooling_effect.ts",
      "src/models/pmv_ppd_ashrae.ts",
      "src/models/set_tmp.ts",
      "src/models/two_nodes_gagge.ts",
    ],
    rules: {
      "no-useless-assignment": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    files: ["scripts/**/*.mjs", "*.config.js", "*.config.ts"],
    languageOptions: { globals: { console: "readonly", process: "readonly" } },
  },
  {
    // Test helpers predate the TS migration and lean on Jest-style globals.
    files: ["tests/**/*.js"],
    languageOptions: { globals: { console: "readonly" } },
    rules: { "no-undef": "off" },
  },
);
