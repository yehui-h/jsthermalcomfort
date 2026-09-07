Contributions are welcome, and they are greatly appreciated! Every little bit helps, and credit will always be given.

## Bug reports

When [reporting a bug](https://github.com/FedericoTartarini/jsthermalcomfort/issues) please include:

- Your operating system name and version.
- Any details about your local setup that might be helpful in troubleshooting.
- Detailed steps to reproduce the bug.

## Documentation improvements

If you find any issue in our online documentation please open
an [issue](https://github.com/FedericoTartarini/jsthermalcomfort/issues).

jsthermalcomfort could always use more documentation, whether as part of the official jsthermalcomfort docs, in TSDoc
comments in the source, or even on the web in blog posts, articles, and such.

## Feature requests and feedback

The best way to send feedback is to file an issue
at [https://github.com/FedericoTartarini/jsthermalcomfort/issues](https://github.com/FedericoTartarini/jsthermalcomfort/issues)

If you are proposing a feature:

- Explain in detail how it would work.
- Keep the scope as narrow as possible, to make it easier to implement.
- Remember that this is a volunteer-driven project, and that code contributions are welcome :)

## Local development

To set up jsthermalcomfort for local development:

1. Fork jsthermalcomfort (look for the “Fork” button).
2. Clone your fork locally. Fetch and pull all the updates from the main branch before you do anything:

   ```bash
   git clone git@github.com:FedericoTartarini/jsthermalcomfort.git
   ```

3. Create a branch for local development. The naming rule for new branch are, as follows:
   - If this update is for a new feature Feature/feature_name_here
   - If this update is for bug fix Fix/bug_name_here
   - If this update is for documentation Documentation/doc_name_here

   You can create a branch locally using the following command. Make sure you only push updates to this new branch only:

   ```bash
   git checkout -b name-of-your-bugfix-or-feature
   ```

   Now you can make your changes locally.

4. When you’re done making changes run all tests using Vitest:
   - Install dependencies

   ```bash
   npm install
   ```

   ```bash
   npm run test
   ```
   - Run prettier to format your code:

   ```bash
   npm run format
   ```
   - Commit your changes:

   ```bash
   git add .
   git commit -m "Your detailed description of your changes."
   ```
   - Update the docs:

   ```bash
   npm run docs
   ```
   - Commit your documentation changes:

   ```bash
   git add .
   git commit -m "Your detailed description of your changes."
   ```
   - Push your branch to GitHub:

   ```bash
   git push origin name-of-your-bugfix-or-feature
   ```

5. Submit a pull request after you have done all your modifications and tested your work. The pull request should
   include a detailed description of your work:
   - What this pull request is about
   - Have you tested your work
   - Will this work affect other component in the product

### Pull Request Guidelines

If you need some code review or feedback while you’re developing the code just make the pull request.

For merging, you should:

- Include passing tests (run `npm run test`).
- Update documentation when there’s new API, functionality etc.

## Documentation

The API reference is generated from TypeScript declarations and TSDoc comments
by [TypeDoc](https://typedoc.org/), configured in `typedoc.json`. The narrative
pages (this one included) are Markdown files in `docs-src/`, listed under
`projectDocuments` in that config.

```bash
npm run docs
```

The output goes to `docs/`, which is git-ignored and rebuilt on every push by
the `CI` workflow; the `Deploy Documentation` workflow publishes it to GitHub
Pages when `CI` succeeds. Never commit anything under `docs/`.

To preview locally, open `docs/index.html` in a browser after running the
command above.

### Writing TSDoc that actually renders

TypeDoc attaches a comment block to the declaration **immediately following
it**. This is the single most common way to lose documentation in this
codebase: if anything — a `const` schema, a helper type, another comment —
sits between your block and the `export function` it describes, the whole
block is silently dropped. There is no error and no warning; the page just
renders as a bare signature.

Put constants and helper types **above** the doc block, so the block sits
flush against the declaration it documents:

```ts
const MY_MODEL_SCHEMA = {
  tdb: { type: "number" },
} satisfies ValidationSchema;

/**
 * One-line summary of the model.
 * ...
 */
export function my_new_model(tdb: number): number {}
```

A few more rules that this codebase follows:

- **Types come from the signature.** Write `@param tdb - description`, not
  `@param {number} tdb - description`. The brace form is a leftover from
  documentation.js; TypeDoc ignores it and it drifts from the real type.
- **`@example` goes last.** Any block tag placed after `@example` is swallowed
  into the rendered code sample and shows up as literal text.
- **Tag the public surface** with `@public` and a `@category` (`Models`,
  `Psychrometrics`, `Utilities`, `Reference values`) so it is grouped correctly.
  Use `@internal` for exported helpers that are not part of the package API —
  `typedoc.json` sets `excludeInternal`.
- **Document object shapes on the interface**, not in the function header:
  put per-field descriptions on the `*Kwargs` / `*Result` interface properties.
  Positional parameters have nowhere else to go, so those keep `@param`.
- **`{@link Name}` resolves by symbol name**, and not across every module — run
  `npm run docs` and check for `Failed to resolve link` warnings. When a link
  will not resolve, use an inline code span and name the entry point instead.

## How to Add a New Thermal Comfort Model

### 1. Create the Model File

Create a new TypeScript file in `src/models/` (e.g. `my_new_model.ts`).

### 2. Implement the Logic and Add TSDoc

Validate the inputs with `validateInputs` from `src/utilities/utilities.ts`,
declare explicit result and options interfaces, and document them:

```ts
import { validateInputs } from "../utilities/utilities.js";
import type { ValidationSchema } from "../utilities/utilities.js";

const MY_NEW_MODEL_SCHEMA = {
  tdb: { type: "number" },
  rh: { type: "number" },
} satisfies ValidationSchema;

/**
 * What this model returns.
 *
 * @public
 */
export interface MyNewModelResult {
  /** The calculated index value. */
  index: number;
}

/**
 * Calculates a new thermal comfort index.
 *
 * @param tdb - Dry bulb air temperature [°C]
 * @param rh - Relative humidity [%]
 * @returns the calculated index
 *
 * @public
 * @category Models
 *
 * @example
 * const result = my_new_model(25, 50);
 */
export function my_new_model(tdb: number, rh: number): MyNewModelResult {
  validateInputs({ tdb, rh }, MY_NEW_MODEL_SCHEMA);
  // your implementation here
  return { index: 0 };
}
```

### 3. Register the Model

`src/models/index.ts` has two places to update — the type re-export and the
named export. There is no default-export object to maintain: this branch removed
them, and named imports are the only surface.

```ts
import { my_new_model } from "./my_new_model.js";

export type { MyNewModelResult } from "./my_new_model.js";

export {
  // ... existing models
  my_new_model,
};
```

`tests/index.test.js` asserts the exact set of names each entry point exports,
so add the new name there too — that test is what catches an export
accidentally being dropped.

### 4. Verify It Appears in the Docs

Run `npm run docs` and open `docs/functions/models.my_new_model.html`. If the
page shows only a bare signature, the comment block is not attached to the
declaration — see the rule at the top of this section.

New entry points (not new models) need adding to `entryPoints` in
`typedoc.json` and to `exports` in `package.json`.

## How to Update the Documentation Site

- **Narrative pages**: edit the Markdown in `docs-src/`. To add a page, create
  the file and list it under `projectDocuments` in `typedoc.json`.
- **Landing page**: `docs-src/overview.md`, wired up via the `readme` option.
- **Navigation, grouping and link checking**: the `navigationLinks`,
  `categorizeByGroup` and `validation` options in `typedoc.json`.

Then rebuild and check the result:

```bash
npm run docs
```

`npm run docs` exits 0 even when TypeDoc emits warnings, so read its output
rather than trusting the exit code, and open the affected pages.

---

## Developer Workflow

- **Install Dependencies**: `npm ci`
- **Run Tests**: `npm test`
- **Format Code**: `npm run format` (Please run this before committing!)
- **Format Check**: `npm run check:format`
- **Lint**: `npm run lint`
- **Type Check**: `npm run typecheck`
- **Build**: `npm run build`
- **Export Wiring**: `npm run check:exports` (verifies the ESM/types entry
  points still resolve for node16 and bundler consumers, and that `main` and
  `types` point at files that exist)
- **Docs**: `npm run docs`

CI runs every one of these. Please ensure they all pass before submitting a
Pull Request.

## How to publish a new version of jsthermalcomfort

Releases are published from Git tags by GitHub Actions. Local builds are not required for publishing.

1. Ensure your branch is merged to `main` and CI is green.
2. Bump the package version with npm:
   - Patch release: `npm version patch`
   - Minor release: `npm version minor`
   - Major release: `npm version major`
   - Exact version: `npm version 1.2.3`
3. Push the commit and tags:
   ```bash
   git push && git push --tags
   ```
4. Pushing a `v*` tag (for example `v1.0.3`) triggers the publish workflow.

The publish workflow runs checks (`npm run check:format`, `npm test`, `npm run build`) and then automatically:

- Runs `npm publish` to publish the package to the NPM registry.
- Creates a new GitHub Release with automatically generated release notes based on merged PRs.
