All notable changes to this project will be documented in this file.

## Unreleased

### Why the next release is a major

This branch is a rewrite of jsthermalcomfort 1.4.0 in TypeScript (`d57c456`), shipped as ESM only (`ca66e01`), with its scope reduced to the PMV / PPD and adaptive comfort models and what they rest on, and with its names and applicability rules aligned to the current `pythermalcomfort`. Every retained equation replays the published 1.4.0 package byte-for-byte — `tests/baseline.test.ts` proves it against a recording of 1.4.0 — except where a bullet below says otherwise and gives the reason.

### Migrating from 1.x

| 1.x                                                                                                         | Unreleased                                                                                                                                                  |
| ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `import jsthermalcomfort from "jsthermalcomfort"; jsthermalcomfort.models.pmv_ppd_iso(…)`                   | `import { pmv_ppd_iso } from "jsthermalcomfort";` — the default-export namespace objects are gone (see below).                                              |
| `import { models, utilities, psychrometrics } from ".../lib/esm/index.js"`                                  | Named imports from the root, or from the subpaths `jsthermalcomfort/models`, `/utilities`, `/psychrometrics`. New subpaths: `/reference`, `/io`, `/charts`. |
| `require("jsthermalcomfort")`                                                                               | ESM only. Node `^20.19.0 \|\| ^22.13.0 \|\| >=24` can `require()` it through `require(esm)`; bundlers and browsers import it. There is no CommonJS build.   |
| `lib/cjs/…`, `lib/esm/types/…` deep paths                                                                   | `./lib/*` and `./package.json` stay reachable through the `exports` map; types are at `lib/esm/types`; `src/` is shipped so source maps resolve.            |
| `two_nodes`, `t_o`, `t_mrt`, `t_wb`, `t_dp`, `enthalpy`, `rh_from_humidity_ratio`, `clo_dynamic`, `pmv_ppd` | Renamed or split to match upstream — see the table under _Breaking — renamed to match upstream_ and the `clo_dynamic` and `pmv_ppd` bullets below.          |

### Removed models

Twenty of the 28 model functions 1.4.0 exported are no longer part of this package. They fall outside the PMV / adaptive scope this fork maintains; their equations remain in `jsthermalcomfort@1.4.0` on npm, which is the version to pin for any of them:

`a_pmv`, `ankle_draft`, `at`, `athb`, `clo_tout`, `discomfort_index`, `e_pmv`, `heat_index`, `humidex`, `net`, `pet_steady`, `phs`, `pmv`, `solar_gain`, `use_fans_heatwaves`, `utci`, `vertical_tmp_grad_ppd`, `wbgt`, `wc`, `wind_chill_temperature`.

Retained: `adaptive_ashrae`, `adaptive_en`, `cooling_effect`, `pmv_ppd_ashrae`, `pmv_ppd_iso`, `set_tmp` and `two_nodes_gagge` (renamed from `two_nodes`). `pmv_ppd` survives as the unexported kernel the two PMV models share; its bullet is below.

### Utilities and psychrometrics surface

- Added: `clo_dynamic_ashrae`, `clo_dynamic_iso`, `ComplianceCheck`, `UNIT_SYSTEMS`, `valid_range`; in `psychrometrics`, `antoine`, `hr_to_rh`, `rh_from_dew_point`, `rh_from_vapour_pressure`, `rh_from_wet_bulb`.
- Removed: `clo_dynamic` (split in two, bullet below). The renamed functions are listed in the table under _Breaking — renamed to match upstream_.

### New layers

`jsthermalcomfort/reference` publishes the sensation scales, acceptability offsets, applicability limits and standard membership as data, so a consuming tool reads one definition instead of transcribing numbers. `jsthermalcomfort/io` reduces every model to one input and output shape (`Outcome`, `Measure`, `Quantity`) without changing what the models themselves return. `jsthermalcomfort/charts` computes the psychrometric comfort zone and the adaptive bands, reproducing what the CBE Thermal Comfort Tool draws. See [Examples](examples.md) for each in use.

### Known numerical differences from pythermalcomfort

Measured while aligning this package; **no behaviour was changed for either**, and the reasoning is recorded at each site in the source.

- **PMV, up to 5.1e-3 before rounding.** The unrounded PMV kernel differs from pythermalcomfort on 86% of a 33 750-point grid. The two-decimal rounding absorbs most of it: over the same grid `pmv_ppd_iso` differs on 1.0% of rows and `pmv_ppd_ashrae` on 0.9% (the latter mixing in the cooling-effect cause below). What survives is enough to flip results either side of the ±2 ISO applicability bound. The cause is the clothing-surface-temperature initial guess: upstream adopted the ISO 7730:2025 Annex D spelling in its commit `4051929`, which describes the change as "output-neutral". It is not, because ISO 7730's own convergence tolerance (`eps = 0.00015`, used by both packages) stops the iteration before the initial guess washes out. Neither spelling is more accurate — converged tightly they agree to 3.4e-11, and against that fixed point the loose-tolerance error is 7.189e-3 here versus 7.210e-3 upstream. This package keeps its spelling because it is the one the deployed CBE Thermal Comfort Tool uses, and `tests/charts.test.ts` reproduces that tool's ISO comfort-zone geometry to 1e-9 °C; upstream's spelling moves that boundary by 1.0e-2 °C and buys no accuracy.
- **Cooling effect, over 1 °C in 2.2% of cases.** The equation `cooling_effect` solves is not monotonic: SET is piecewise in the Gagge model's regime switches, so the objective can cross zero several times within a narrow band. Over the ASHRAE 55 applicability box, 479 of 21 407 bracketed cases have more than one root — at every metabolic rate — spanning up to 2.1 °C. Where that happens the cooling effect has no single value and the answer depends on the root finder; both this package's Brent implementation and upstream's `scipy.optimize.brentq` return legitimate roots. Wherever the root is unique the two agree.

- **Breaking — renamed to match upstream.** Every equation is unchanged; these are pure renames, verified by `tests/baseline.test.ts` still replaying the 1.4.0 recordings against the new names.

  | was                                 | is                                            | upstream                                     |
  | ----------------------------------- | --------------------------------------------- | -------------------------------------------- |
  | `two_nodes`                         | `two_nodes_gagge`                             | `pythermalcomfort/models/two_nodes_gagge.py` |
  | `t_o`                               | `operative_tmp`                               | `pythermalcomfort/utilities.py`              |
  | `t_mrt`                             | `mean_radiant_tmp`                            | `pythermalcomfort/utilities.py`              |
  | `t_wb`                              | `wet_bulb_tmp`                                | `pythermalcomfort/utilities.py`              |
  | `t_dp`                              | `dew_point_tmp`                               | `pythermalcomfort/utilities.py`              |
  | `enthalpy`                          | `enthalpy_air`                                | `pythermalcomfort/utilities.py`              |
  | `rh_from_humidity_ratio`            | `hr_to_rh`                                    | `pythermalcomfort/utilities.py`              |
  | `TwoNodesKwargs` / `TwoNodesResult` | `TwoNodesGaggeKwargs` / `TwoNodesGaggeResult` | `GaggeTwoNodes`                              |

  Along with them:
  - `psy_ta_rh`'s result fields `t_wb` / `t_dp` are now `wet_bulb_tmp` / `dew_point_tmp`, matching upstream's `PsychrometricValues` (`pythermalcomfort/classes_return.py`). The `io.quantities` entries follow — `quantities.t_wb` → `quantities.wet_bulb_tmp`, `t_dp` → `dew_point_tmp`, `t_o` → `operative_tmp` — because `quantityFor` resolves a field name to its quantity, and half a rename would leave the returned field unresolvable.
  - `set_tmp` and `two_nodes_gagge` parameters `body_position` → `position` and `p_atmospheric` → `p_atm`.
  - `set_tmp` lost its `units` parameter and is SI-only, as upstream's is: `f20200c` hard-coded `units="SI"` in that model's validation and the signature has carried no unit system since. `limit_inputs` and `kwargs` therefore shift one position left. `cooling_effect` keeps `units`, because upstream's does.
  - `clo_typical_ensembles` is a lookup table rather than a function, as upstream's is — `clo_typical_ensembles["Trousers, long-sleeve shirt"]`. `clo_individual_garments` next to it was already a table. `ClothingEnsemble` is now `keyof typeof clo_typical_ensembles`, so a typo is a compile error rather than a runtime throw.
  - `Standard` (the `check_standard_compliance` dispatch key) is now `ComplianceCheck`, so three separate ideas stop sharing one word: `StandardRef` is the standard a model belongs to, `edition` is which edition of it, and this is which applicability table to check against.

- Removed the dead `calculate_percent_satisfied` helper from `two_nodes_gagge`: its result was computed and discarded on every call, and upstream keeps the same formula only as a comment — `GaggeTwoNodes` has no `ps` field.
- Documentation fixes: `psy_ta_rh`'s `@example` showed a negative humidity ratio and a negative enthalpy (values from an unrelated `p_atm = 1000` case); `cooling_effect`'s SI example said `1.64` where the function returns `1.68`, and its IP example passed `"IP"` in the `wme` slot, which throws; `adaptive_en`'s out-of-range example claimed `acceptability_cat_i: true` where every flag is `false`. All four were checked by running them.
- **Breaking:** `pmv_ppd` is no longer exported. Upstream deleted the combined function outright (commit `61de959`, "split pmv iso and ashrae; … replaced input standard with model; deleted pmv function"); here it survives as the shared kernel `pmv_ppd_iso` and `pmv_ppd_ashrae` delegate to, which in TypeScript means not exporting it — not an `_` prefix, which is a Python convention with nothing to say here. `PmvPpdStandard` is gone with it. Migration: call `pmv_ppd_iso` or `pmv_ppd_ashrae` directly; the arguments are the same minus `standard`.
- **Breaking:** `charts.psychrometricZone` takes `model: PmvPpdModel` — the model function itself — instead of `standard?: "ISO" | "ASHRAE"`, and it is **required**. The old option defaulted to `"ASHRAE"`, so a consumer drawing the ISO model's comfort zone silently got ASHRAE geometry unless it remembered to pass a string the model function already hard-codes. A model function carries the standard it applies, so the two can no longer disagree. `PsychrometricZone.standard` becomes `PsychrometricZone.model`, echoing what it solved with. `PmvPpdModel` is exported so consumers can annotate.
- `pmv_ppd_iso` and `pmv_ppd_ashrae` accept `kwargs.edition`: `"7730-2005"` / `"7730-2025"` (default `"7730-2025"`, as upstream) and `"55-2023"` respectively, with `PMV_PPD_ISO_EDITIONS` / `PMV_PPD_ASHRAE_EDITIONS` published as data and echoed on the functions as `.editions`. Upstream's two ISO editions run the same kernel over the same limits, so this changes no numbers — it exists so a result can say which edition it was computed under. An unimplemented edition throws, as upstream raises.
  - **Naming deviation:** upstream calls the parameter `model`. Here `model` already means "a model function" — and `psychrometricZone` now literally takes one — so `model: "7730-2005"` would read as a category error. `edition` is used and documented as upstream's `model`.
- Tests: added `tests/models/pmv_ppd_ashrae.test.js`. The ASHRAE rows of the shared `ts_pmv_ppd.json` fixture had no test; only the ISO half was checked.
- **Breaking:** `clo_dynamic(clo, met, standard)` is replaced by `clo_dynamic_ashrae(clo, met, edition?)` and `clo_dynamic_iso(clo, met, v, i_a?, edition?)`, matching upstream's split (`pythermalcomfort/utilities.py`). The two are different equations, not one equation behind a switch: ASHRAE 55 applies `Icl × (0.6 + 0.4/met)` above 1.2 met and rounds to three decimals, while ISO 7730 Annex C applies the ISO 9920:2007 correction, which needs the air speed, estimates walking speed from the metabolic rate (`v_walk = 0.0052(M − 58)`, clipped 0–0.7 m/s) and returns unrounded. This fork's old `"ISO"` branch was neither — it ran the ASHRAE formula with the threshold moved to met > 1. `ClothingStandard` is gone; `ClothingEditionAshrae` and `ClothingEditionIso` replace it. Verified against upstream across a 210-point clo × met × v grid (worst |Δ| 2.2e-16).
  - **Naming deviation:** upstream calls the edition parameter `model`. In this package and in its consumers `model` already means "a model function", so `model="55-2023"` reads as a category error; `edition` is used instead and documented as upstream's `model`.
  - The four ISO 9920 helpers upstream exports (`clo_area_factor`, `clo_total_insulation`, `clo_insulation_air_layer`, `clo_correction_factor_environment`) stay private here — nothing calls them on their own.
- **Breaking:** `reference.ashraeThermalSensation` is now **left-closed**, matching `isoThermalSensation`, so `pmv = -0.5` is "Neutral" under both standards instead of "Slightly Cool" under ASHRAE. A deliberate divergence from upstream's current behaviour: `pythermalcomfort` introduced `tsv` on both models with `right=False` (`cfebb56`), then dropped the flag from the ASHRAE call while hoisting it into a local variable in an unrelated compliance refactor (`ac50f1c` at 14:00, carried forward by `4ef336c` at 14:28) — and at 15:00 the same day `07b0746` ("Update expected value in ASHRAE tests") rewrote the one assertion that crosses a band edge to match, rather than restoring the flag. ASHRAE 55 publishes no right-closed rule and the band table is byte identical to ISO's, so reproducing the asymmetry would make the two standards' pages disagree at six shared boundaries for no citable reason. **Be aware** this means the scale disagrees with that upstream test: at `pmv = 2.5` this package says "Hot", which is what pythermalcomfort itself expected before `07b0746`. The provenance is recorded in `src/reference/bands.ts`.
- Added `antoine(tdb)` to `psychrometrics`: saturated vapour pressure in [kPa] from the Antoine equation, matching upstream `antoine` (`pythermalcomfort/utilities.py`) including the kPa return unit. `pmv_ppd` inlined the same expression; it now calls this. It lives in `psychrometrics` rather than `utilities` because this package keeps psychrometrics as its own module for tree-shaking — a deliberate divergence from upstream's single `utilities.py`.
- **Breaking:** the ISO 7730 `met` lower applicability limit is now `0.8`, not `0`. jsthermalcomfort 1.4.0 checked `met < 0` while printing "between 0.8 and 4.0", so the bound never fired; upstream uses `(0.8, 4.0)` (`pythermalcomfort/models/pmv_ppd_iso.py`, `limit_inputs` block). `pmv_ppd_iso` and `check_standard_compliance("ISO", …)` now flag `met` below 0.8 with `limit_inputs: true`.
- **Breaking:** `pmv_ppd` now enforces ISO 7730's bound on the derived water vapour partial pressure, `pa ≤ 2700 Pa`, which 1.4.0 did not check at all. Upstream checks it in the same block. ASHRAE 55 has no equivalent bound, so this is ISO-only.
- `ApplicabilityLimit` gained a `role` field (`LimitRole` = `"input" | "derived" | "output"`), so the published tables can carry bounds that are not arguments. `iso7730PmvLimits` now has all seven ISO rows: the two new ones are exported individually as `iso7730VapourPressureLimit` (derived, 0–2700 Pa) and `iso7730PmvRangeLimit` (output, −2…2), and `pmv_ppd` reads them rather than repeating the numbers. `check_standard_compliance` range-checks the `"input"` rows only. Upstream's answer is inline `valid_range` calls per model, which a consumer cannot read; publishing the table is this package's own design.
- `two_nodes` now rounds every returned quantity to **two** decimal places instead of one, matching upstream `pythermalcomfort/models/two_nodes_gagge.py` (`np.around(output[key], 2)`). One decimal — jsthermalcomfort 1.4.0's behaviour — was too coarse for the adimensional fields: skin wettedness `w` read `0.1` where the shared validation data says `0.12`. `set_tmp` and `cooling_effect` are unaffected: both call `two_nodes` with `round: false` and do their own rounding.
- Tests: the shared validation dataset (`FedericoTartarini/validation-data-comfort-models`) is now subscribed to for every model this package ships, not just two. Added `ts_adaptive_en`, `ts_cooling_effect`, `ts_set` and `ts_two_nodes_gagge` — `set_tmp` and `two_nodes` had no upstream cross-check at all before this. The default `VALIDATION_DATA_REF` moved from `main` to `v1.0.0`, the tag upstream's own `tests/conftest.py` pins, so both repositories read the same rows.
- Added `rh_from_dew_point`, `rh_from_humidity_ratio`, `rh_from_vapour_pressure` and `rh_from_wet_bulb` to `psychrometrics`: the inverses of the `t_dp`, `hr`, `p_vap` and `t_wb` that `psy_ta_rh` returns, SI only, clamped to `[0, 100]`.
- Added the `hr`, `t_dp`, `t_wb` and `p_vap` quantities to `io.quantities` (`hr` under the new `QuantityKind` `"humidityRatio"`). `quantities.p_atm` now reads `"Pa"` rather than `"kPa"`, which is the unit `psy_ta_rh`, `set_tmp` and `psychrometricZone` actually take.
- Removed the `ANKLE_DRAFT`, `FAN_HEATWAVES`, `7933-2004` and `7933-2023` standards from `check_standard_compliance` and from `Standard`, together with the `rh` and `p_a` fields of `ComplianceKwargs` that only they read. The models they served (`ankle_draft`, `use_fans_heatwaves`, `phs`) are no longer part of this package; the checks return with them.
- Removed `transpose_sharp_altitude` (a `solar_gain` helper with no remaining caller) and the unused `roundArray` export of `two_nodes`.
- Removed the `PmvPpdIso` type: `pmv_ppd_iso` returns `PmvPpdResult`. `PmvPpdIsoKwargs` is now `Omit<PmvPpdKwargs, "airspeed_control">`, which is what it always was in substance.
- Removed `LabeledInterval.notation`; read `lower` / `upper` (`{ value, inclusive }`) instead.
- `pmv_ppd_iso` and `pmv_ppd_ashrae` no longer validate their arguments before delegating to `pmv_ppd`, which validates them identically. The errors thrown are unchanged.
- Tooling: the pre-commit hook is a plain git hook in `.githooks/` (`npm install` points `core.hooksPath` at it); `husky` and `lint-staged` are gone. `npm run typecheck` reads the root `tsconfig.json`.
- **Breaking — fix:** `adaptive_ashrae` now applies `round_output` last: the comfort temperature **and the four bounds** are rounded to one decimal in the output unit, after any IP conversion, and the acceptability flags are computed from the unrounded band — the order `adaptive_en` already used, adopted upstream in `c3c110e` (PR #188, issue #179). 1.4.0 rounded `t_cmf` first and derived the bounds from it. Consequences: `acceptability_80` / `acceptability_90` no longer depend on `round_output`; IP results are one decimal in °F (was the °C rounding converted, e.g. `56.66`); the bounds no longer carry float noise (`25.599999999999998` → `25.6`); at an input sitting on a rounded edge a flag can be `false` while the rounded bound reads equal to the operative temperature, which is what pythermalcomfort reports. `tests/baseline.test.ts` exempts the affected 1.4.0 rows (every rounded, finite `adaptive_ashrae` case) and `tests/models/adaptive_ashrae.test.js` pins the new values.
- **Breaking:** the `default` exports of the root, `models`, `psychrometrics` and `utilities` entry points are gone. They were namespace objects that had already drifted from the named surface — `utilities`' omitted `valid_range`, `ComplianceCheck` and `UNIT_SYSTEMS` — and typedoc documented each as a variable. Use named imports: `import { pmv_ppd_iso } from "jsthermalcomfort"`, or from the subpath. The README's `import { models, utilities, psychrometrics }` CDN example never worked against this build (those were keys of the default object, not named exports) and is corrected.
- **Breaking:** the `io` Outputs classes no longer copy the model's fields onto themselves. `Outcome<TInputs, TResult>` gains `readonly result: TResult`, which is the model function's own return object — `pmvPpdIso(...).pmv` is now `.result.pmv`, `adaptiveEn(...).tmp_cmf` is `.result.tmp_cmf`. Holding the object rather than re-declaring its fields is what guarantees the layer cannot drop or rename one. `tsv`, `compliance`, `warnings`, `inputs` and `toMeasures()` are unchanged.
- **Breaking:** `charts.psychrometricZone` no longer takes `suppressModelWarnings`, and `cooling_effect` no longer writes to `console.warn` when its root search fails: it returns `{ ce: 0 }`, which is now documented. The option existed only to hide that line, which fired hundreds of times per traced zone (the search probes −50 °C on purpose) and also on a genuine zero; the library now writes nothing to the console. A failed search is still indistinguishable from a real zero in the result, as it is in pythermalcomfort's return value.
- **Breaking:** `pmv_ppd_ashrae.COMPLIANCE_LIMIT` is removed; nothing read it. `pmv_ppd_ashrae.compliance` — a `LabeledInterval`, open at both ends, as pythermalcomfort computes `(pmv > -0.5) & (pmv < 0.5)` — is the single definition and is what `io` judges compliance with.
- **Breaking (minor):** the `io` input classes (`BaseInputs`, `PmvPpdInputs`, `PmvPpdAshraeInputs`, `AdaptiveInputs`) no longer validate; they resolve defaults and upper-case `units`. Every model already validates the same fields with the same messages, and every `io` factory runs a model immediately, so `io.pmvPpdIso({...})` and the others throw exactly as before — only constructing an input object directly with a bad value has stopped throwing. The three schemas the layer kept were copies of the models' own.

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
