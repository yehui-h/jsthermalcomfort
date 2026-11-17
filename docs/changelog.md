All notable changes to this project will be documented in this file.

## Unreleased

Changes since 1.4.0. A model takes one inputs object and returns a frozen object. A nullable output with no value is `null`, not `NaN`, and the call's range and notice rows are on `warnings`. Helpers that are not models stay positional.

- **Breaking:** `clo_dynamic(clo, met, standard)` is removed. ASHRAE 55's correction above 1.2 met is `clo_dynamic_ashrae(clo, met, standard = "55-2023")`. ISO 7730 Annex C is `clo_dynamic_iso(clo, met, v, i_a = 0.7, standard = "9920-2007")`, which derives the relative air speed with `v_relative`. A caller that already holds that speed uses `clo_dynamic_iso_vr(clo, met, vr, i_a = 0.7, standard = "9920-2007")`. `clo_dynamic_iso_vr` has no `pythermalcomfort` counterpart: `clo_dynamic_iso(clo, met, v)` is `clo_dynamic_iso_vr(clo, met, v_relative(v, met))`. Migration: `clo_dynamic(clo, met)` and `clo_dynamic(clo, met, "55-2023")` become `clo_dynamic_ashrae(clo, met)`. `clo_dynamic_ashrae` rounds with the same half-even rule as numpy's `around`, which can move the third decimal by one from the old value. `clo_dynamic(clo, met, "7730-2025")` has no equivalent: it applied the ASHRAE formula above 1 met, which is not ISO 7730's correction; use `clo_dynamic_iso(clo, met, v)`, which also takes the air speed and returns different values. `clo_area_factor`, `clo_insulation_air_layer` and `clo_total_insulation` are exported with them, and `Standard` includes `iso_9920_2007` (`"9920-2007"`).
- **Fix:** `v_relative()` rounds to three decimals as numpy's `around` does, matching `pythermalcomfort`. The old rounding added an epsilon before rounding half up, so a value at or just under a tie went up: `v_relative(0, 1.005)` returned 0.002 where it now returns 0.001. `clo_dynamic_iso()` derives its relative air speed with it.
- **Breaking:** `"ISO"`, `"ASHRAE"`, `"ANKLE_DRAFT"` and `"FAN_HEATWAVES"` are not `Standard` values. `Standard` is importable from the package root. There is no `LimitSet`, no `is_iso_7730()`, and no `check_standard_compliance()`. `ankle_draft` and `use_fans_heatwaves` are models. The operative-temperature function is `operative_tmp(tdb, tr, v, standard = "ISO")`: it still accepts only `"ISO"` and `"ASHRAE"`, and a versioned identifier such as `"7730-2025"` throws. `mean_radiant_tmp` still accepts `"ISO"` and `"Mixed Convection"`. On a model `standard` input, pass the edition that model lists:

  | Before, on a model `standard` input | After                                            |
  | ----------------------------------- | ------------------------------------------------ |
  | `"ISO"`                             | `"7730-2025"` or `Standard.iso_7730_2025`        |
  | `"ISO"` (2005 edition)              | `"7730-2005"` or `Standard.iso_7730_2005`        |
  | `"ASHRAE"`                          | `"55-2023"` or `Standard.ashrae_55_2023`         |
  | `"ANKLE_DRAFT"`                     | call `ankle_draft({ ... })`                      |
  | `"FAN_HEATWAVES"`                   | call `use_fans_heatwaves({ ... })`               |
  | `t_o(...)`                          | `operative_tmp(...)`, still `"ISO"` / `"ASHRAE"` |

  An unrecognized `standard` throws a message that names the values that model accepts. `pmv_ppd_iso` says `ISO 7730-2005` or `ISO 7730-2025`. `clo_dynamic` is gone; see the clothing bullet.

- **Breaking:** `pmv_ppd` is not exported. Call `pmv_ppd_iso({ tdb, tr, vr, rh, met, clo, ... })` or `pmv_ppd_ashrae({ ... })`. `pmv_ppd_iso`'s `standard` is `"7730-2025"` (the default) or `"7730-2005"`. The two editions share the PMV equation and the input limits. Their comfort `category` labels differ: `"7730-2025"` uses I–IV and `"7730-2005"` uses A–C. ISO 7730 Clause 4's partial vapour-pressure limit is the derived check `PMV_PPD_ISO_INFO.derived.pa`, 0–2700 Pa inclusive, computed from `tdb` and `rh` (fixes #195). Outside an applicability limit, with `limit_inputs` left on, `pmv`, `ppd`, `tsv` and `category` are `null`. The metabolic-rate limit is 0.8–4 met inclusive: `met = 0.8` is valid, and `0 <= met < 0.8` yields `null` where an older check against 0 returned a number. Pass `{ limit_inputs: false }` to keep the number. `pmv_ppd_iso` returns `{ pmv, ppd, tsv, category, warnings }`. `pmv_ppd_ashrae` returns `{ pmv, ppd, tsv, compliance, warnings }` and has no vapour-pressure limit. `tsv` uses the bins `[-2.5, -1.5, -0.5, 0.5, 1.5, 2.5, 10]` and the labels Cold, Cool, Slightly Cool, Neutral, Slightly Warm, Warm, Hot. ISO is left-inclusive and ASHRAE is right-inclusive, so at `pmv = -0.5` ISO returns `"Neutral"` and ASHRAE returns `"Slightly Cool"`. `tsv` is classified from the `pmv` value after rounding when `round_output` is left on; `category` is classified from the unrounded absolute PMV. A `tsv` or `category` with no bin is `null`. This boundary split matches pythermalcomfort (pythermalcomfort#382).
- **Breaking:** `heat_index` is not exported, and it is not an alias of `heat_index_rothfusz`. `heat_index_rothfusz({ tdb, rh, round_output, limit_inputs })` has no `units` input. It returns `{ hi, stress_category, warnings }`. `stress_category` is taken from the unrounded `hi`, then `hi` is rounded to one decimal when `round_output` is left on, so rounding does not change the category (pythermalcomfort#381). The bins are right-inclusive, edges `[27, 32, 41, 54, 1000]`, labels `"no risk"`, `"caution"`, `"extreme caution"`, `"danger"`, `"extreme danger"`: 27 °C is `"no risk"` and 27.1 °C is `"caution"`. With `limit_inputs` left on, `tdb < 27` makes `hi` and `stress_category` `null`. `heat_index_schoen` and `heat_index_lu` are separate models; `heat_index_lu` returns `stress_category: null`.
- Every TypeScript model exports its `<NAME>_INFO` from the package root (`HEAT_INDEX_ROTHFUSZ_INFO`, `PMV_PPD_ISO_INFO`, and the rest of the `*_INFO` constants). The objects are deeply frozen, and the metadata shape is stable within this major version. `classifyFromBins(value, bins)` is a public export of the package root and of `jsthermalcomfort/models`; its source is `src/_internal/classifierBins.ts`. `HEAT_INDEX_STRESS_CATEGORY_BINS`, `PMV_THERMAL_SENSATION_VOTE_BINS_ISO` and `PMV_THERMAL_SENSATION_VOTE_BINS_ASHRAE` are not exports. The public ISO comfort-category table is `PMV_CATEGORY_BINS_ISO_7730`. `JOS3` has no `*_INFO`.
- **Fix: TypeScript consumer compatibility (#196):** generated `.d.ts` files name JSDoc `@callback` parameters, which TypeScript requires. `pet_steady.d.ts` had been failing `tsc` in strict consumer projects.
- **Breaking for snapshot tests:** `heat_index` and `pmv_ppd` are gone. Compare `heat_index_rothfusz` to `{ hi, stress_category, warnings }`, `pmv_ppd_iso` to `{ pmv, ppd, tsv, category, warnings }`, and `pmv_ppd_ashrae` to `{ pmv, ppd, tsv, compliance, warnings }`.
- **Fix: `adaptive_ashrae` acceptability:** `acceptability_80` and `acceptability_90` are computed from the unrounded comfort temperature, so `round_output` cannot flip them.
- **Behaviour change: `adaptive_ashrae` IP rounding:** IP numeric outputs (`tmp_cmf` and the bounds) are rounded to one decimal after the °C to °F conversion. A value that previously kept the conversion's extra digits (for example 65.12°F) is now 65.1°F, as in `adaptive_en`.

## 1.4.0

- Added `wind_chill_temperature(tdb, v)`, which returns the Wind Chill Temperature in °C using the North American formula adopted by the US National Weather Service and Environment Canada. Mirrors `pythermalcomfort` 3.9.3 `wind_chill_temperature`. Wind speed `v` is in km/h, which differs from the existing `wc()` Wind Chill Index that uses m/s. Returns `{ wct }`.
- Added optional `round_output` parameter to `adaptive_ashrae(tdb, tr, t_running_mean, v, units, limit_inputs, round_output)` and `adaptive_en(tdb, tr, t_running_mean, v, units, limit_inputs, round_output)`. Defaults to `true`, preserving current behaviour. Passing `false` returns full-precision comfort temperatures and bounds, useful when chaining downstream calculations or when the caller applies its own formatting. This parameter is a jsthermalcomfort-specific enhancement and is not present in `pythermalcomfort`.

## 1.3.1 (2026-05-06)

- `heat_index` now returns `{ hi: NaN }` by default when `tdb < 27 °C`, matching `pythermalcomfort` 3.9.3 `heat_index_rothfusz`. IP mode uses the equivalent threshold, `tdb < 80.6 °F`, so the same physical temperature is accepted or rejected regardless of unit system. This is a breaking change compared with previous versions; callers needing the previous behaviour should pass `{ limit_inputs: false }`.

## 1.2.0

- Removed `check_standard_compliance_array` from public exports. This is a breaking change for consumers that imported the array helper directly. Internal callers (`adaptive_ashrae`, `pmv_ppd`, `set_tmp`, `use_fans_heatwaves`) have been migrated to the scalar `check_standard_compliance` helper, which now also covers the ASHRAE `airspeed_control` cross-field check (pass `airspeed_control: false` to enable) and the `FAN_HEATWAVES` standard.
- Migration: replace `check_standard_compliance_array(standard, kwargs)` with `check_standard_compliance(standard, kwargs)` and check `warnings.length === 0` for compliance.
- Removed `t_o_array` public export. The function was retained in 1.1.0 as an internal helper for `check_standard_compliance_array`; with that helper now removed, `t_o_array` no longer has any in-tree caller. Migration: use scalar `t_o` instead.

## 1.1.0 (2026-06-31)

- Removed all `*_array` function exports from models, utilities and psychrometrics. This is a breaking change compared with previous versions.
- Removed functions: `adaptive_ashrae_array`, `adaptive_en_array`, `a_pmv_array`, `athb_array`, `clo_tout_array`, `discomfort_index_array`, `e_pmv_array`, `pmv_array`, `pmv_ppd_array`, `set_tmp_array`, `two_nodes_array`, `utci_array`, `v_relative_array`, `clo_dynamic_array`, `units_converter_array`, `p_sat_torr_array`, `t_mrt_array`.
- Migration: use `Array.map()` with the scalar equivalent. See PR #141 for before/after examples.

## 1.0.2 (2026-03-19)

- Integrated `Lunr.js` to provide high-performance, client-side indexing and searching across all documentation pages.
- Added a search button to the top navigation bar with a `Ctrl + K` keyboard shortcut.
- Implemented a modern modal overlay for quick search results with snippets and direct links.
- Created a persistent search results page (`search.html`) that supports deep searching and query parameters.
- Modified the build script to automatically generate `search-data.json` during every `npm run docs` execution.
- Developed three new browser-runnable interactive examples:
  - **Heat Index**: Apparent temperature calculation.
  - **Humidex**: Canadian index for perceived heat discomfort.
  - **Solar Gain**: Detailed impacts of solar radiation on human MRT.
- Updated the "Examples" page to provide consistent links to all 10 available browser-runnable demos.
- Fixed several redundant and broken relative paths to ensure seamless navigation across the documentation.
- Aligned table aesthetics with the `pythermalcomfort` reference, including:
  - Header background color (`#f3f4f5`) and text color.
  - A continuous teal/blue border (`#038699`) at the bottom of every table header.
  - Zebra-striping and refined cell borders for improved readability.
- Unified the font sizes of "Section Navigation" and "On this page" sidebar items.
- Adjusted margins, padding, and Flexbox containers to prevent content overlap and ensure a premium, modern feel.

## 1.0.1 (2026-03-18)

- Standardized the layout, margins, and padding of all documentation pages (including `models.html` and `psychrometrics.html`) to achieve 100% visual consistency with the `pythermalcomfort` reference documentation and the `clo.html` layout.
- Transitioned to a robust Flexbox-based layout which ensures the primary sidebar, main article, and secondary sidebar (TOC) remain perfectly aligned without overlapping, even on wider viewports.
- Reordered the "Section Navigation" items to prioritize core documentation.
- Aligned the font sizes and weights of the "Section Navigation" and "On this page" headers and list items to be identical (0.9rem).
- Increased the `levelIndex1` font size to 2.5rem for improved readability.
- Removed checkboxes from the "Quick checklist" on the home page for a cleaner aesthetic.
- Updated the Surveys documentation with revised sections on "Point-in-time" and "Satisfaction" surveys.
- Integrated a new visual reference image for "Clothing and activity" levels directly into the Surveys page.
- Implemented text-wrapping and overflow handling for the Table of Contents (TOC) links to prevent them from obscuring main text on smaller screens or with long section titles.
- Refined the theme color palette to ensure code blocks, tags, and navigation elements have optimal contrast and premium aesthetics in dark mode.

## 1.0.0 (2026-03-17)

- Redesigned the entire documentation site to match the professional and modern aesthetic of `pythermalcomfort`.
- Transitioned the documentation from a single-page layout to a multi-page structure with dedicated sections for Models, Psychrometrics, Surveys, and Reference Values, directly mirroring the content organization of `pythermalcomfort`.
- Added a dedicated "Section Navigation" sidebar on the left for all internal documentation pages, facilitating easier movement between core sections.
- Restored the right-side Table of Contents for all pages, including JSDoc-generated ones like Models and Psychrometrics. Added sticky positioning and scroll-spy highlighting.
- Implemented a breadcrumb navigation bar at the top of every page (except the landing page) for better site-wide orientation.
- Updated the top banner to include the project version and quick-links/icons for GitHub, LinkedIn, and Google Scholar.
- Adjusted header sizes (e.g., 3rem for main titles) and branding elements for a cleaner, more readable hierarchy.
- Standardized the appearance of all code blocks, JSDoc function signatures, and `<pre>` tags with a custom dark/light theme background and a teal left-accent border.
- Fine-tuned syntax highlighting for dark mode, specifically improving the readability of script tags (#FFD900) and inline code backticks (#3fb1c5).
- Applied a consistent professional look to all data tables (alternating row colors, teal header accents, removed vertical borders).
- Set the main background to a pure white (#ffffff) and updated block containers to utilize subtle grey tones and borders.
- Successfully divided the "Clo and Met reference values" into two separate, dedicated pages for clearer reference.
- Added the detailed Surveys documentation page content to mirror the reference implementation in `pythermalcomfort`.
- Optimized the EJS/CSS logic to remove JSDoc artifacts like the `fill-light` class, ensuring a cleaner final output.
