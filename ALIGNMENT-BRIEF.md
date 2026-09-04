# jsthermalcomfort fork — pythermalcomfort alignment brief

Paste this whole file into a new Claude Code session opened in
`/Users/yehuihuang/SoftwareProjects/USYD/forked repo/jsthermalcomfort`
(branch `typescript`). It is self-contained: nothing from the originating
conversation is needed.

---

## 1. Where you are

You are working in **jsthermalcomfort**, a TypeScript rewrite of the JS port of
**pythermalcomfort**. Two facts about the surroundings:

- Upstream Python is checked out at
  `/Users/yehuihuang/SoftwareProjects/USYD/main repo/pythermalcomfort` — read it
  directly rather than guessing; it is the reference for every decision below.
- This package is symlinked (`file:`) into a consumer app at
  `/Users/yehuihuang/SoftwareProjects/USYD/main repo/comfort-tool` (the CBE
  Thermal Comfort Tool rewrite). That app consumes **build output**
  (`lib/esm/`), so every change needs `npm run build` here before the app sees
  it. A second consumer, `../comfort-tool-old`, is a dead draft — ignore it.

The app is mid-rewrite and its contracts freeze at its "Phase 4". Steps 1–4
below must land before that; steps 5–6 may follow.

## 2. The principle (this is the whole brief in one line)

**Follow the latest pythermalcomfort's logic _and_ naming by default. Deviate
only where TypeScript genuinely requires it, and write the reason in the code or
the docs where you deviate.**

Corollaries:

- Do **not** copy Python idioms that have no meaning here: numpy array
  handling, `_leading_underscore` privacy (TS just does not export), flattened
  keyword arguments (TS has none).
- Do **not** rename things "because the old JS package called them that".
  jsthermalcomfort 1.4.0's vocabulary tracks an _older_ pythermalcomfort; where
  upstream has since renamed, upstream wins.
- Where this fork already does something better than upstream (see §5), keep it
  — and say so in a comment, so the divergence reads as a decision rather than
  as drift.

## 3. What the audit found

Verified identical already (do not touch, listed so you do not re-audit):
`adaptive_ashrae` (0.31/17.8, ±3.5/±2.5, ce on the upper bound only, trm
10–33.5), `adaptive_en` (0.33/18.8, asymmetric −3/−4/−5 vs +2/+3/+4),
adaptive cooling effect (0.6→1.2, 0.9→1.8, 1.2→2.2, gated at `to ≥ 25`),
`cooling_effect` (brent 0–40, still-air 0.1, IP `/1.8×3.28`, round 2), the
three `airspeed_control` conditions including
`v_limit = 50.49 − 4.4047·to + 0.096425·to²`, `v_relative`, `f_svv`,
`body_surface_area`, `running_mean_outdoor_temperature`, `units_converter`,
`p_sat`, `p_sat_torr`, `t_dp`, `t_wb` (Stull both sides), `enthalpy`, `t_o`,
`t_mrt`, the humidity-ratio↔RH conversion, and the ISO thermal-sensation bands
(left-closed, matching upstream's `mapping(..., right=False)`).

The PMV kernel is independently confirmed too: run against the deployed CBE
tool's own `comfort-models.js`, worst |Δpmv| was 2.6e-14 over eight cases.

### Not verified by anyone

`set_tmp` and `two_nodes` carry ~400-line numerical kernels that no test in
this repository checks against upstream. Step 1 fixes that, and it comes first
for exactly that reason.

## 4. The work, in order

### Step 1 — subscribe to the whole shared validation dataset

`tests/models/comftest.js` pins `testDataUrls` to two fixtures
(`ts_adaptive_ashrae`, `ts_pmv_ppd`) while this package ships eight models.
Upstream's `tests/conftest.py` lists fixtures that already exist for models we
ship and do not check:

- `ts_adaptive_en.json`
- `ts_cooling_effect.json`
- `ts_set.json`
- `ts_two_nodes_gagge.json`

Add all four with tests in the shape of the existing
`tests/models/adaptive_ashrae.test.js`. Also change the default
`VALIDATION_DATA_REF` from `main` to `v1.0.0` — upstream pins that tag, and this
file's own comment says CI should pin rather than track a moving branch.

**Report the results before starting step 2.** If any model disagrees with the
shared data, that outranks everything below and the order gets rethought.

### Step 2 — applicability data (the consumer reads this table, not your code)

The app calls models with `limit_inputs: false` and gates inputs itself using
`model.limits`. So anything the compliance check knows but `.limits` does not
say is invisible to every consumer.

1. `src/reference/limits.ts`, `iso7730PmvLimits`: `met.min` is `0`. The comment
   there already admits jsthermalcomfort 1.4.0 checked `value < 0` while
   printing "between 0.8 and 4.0". Upstream uses `(0.8, 4.0)`
   (`pythermalcomfort/models/pmv_ppd_iso.py`, the `limit_inputs` block). Fix it
   to 0.8.
2. The same upstream block checks two bounds that `.limits` cannot currently
   express: the derived vapour pressure `pa ≤ 2700 Pa` and the **output** bound
   `PMV ∈ [−2, 2]`. `src/models/pmv_ppd.ts` enforces both internally (see the
   `pmv_outside_iso_range` branch), but the published table does not carry them.
   Extend `ApplicabilityLimit` so a limit can describe a derived quantity or an
   output, and add both rows. This is a type design task for this package —
   upstream's answer (inline `valid_range` calls) is not the model to copy.
3. While you are there: upstream exposes `antoine(tdb)` as a public function;
   this package inlines the same expression
   (`rh * 10 * exp(16.6536 − 4030.183/(tdb + 235))`) in `pmv_ppd.ts`. Give it a
   name and export it, matching upstream.

### Step 3 — the ASHRAE thermal-sensation scale

`src/reference/bands.ts` defines `ashraeThermalSensation` as **right-closed**
(`(−2.5, −1.5]`) while `isoThermalSensation` is **left-closed**
(`[−2.5, −1.5)`). Upstream has no ASHRAE sensation scale at all — only
`pmv_ppd_iso` returns a `tsv`, via `mapping(..., right=False)`.

So this is a fork-original decision with no upstream anchor, and it is visible
to users: at PMV = −0.5 the two standards' pages would disagree on the label.
Either find the ASHRAE 55 / literature basis for the right-closed reading and
cite it in the code, or make it left-closed like ISO. Do not leave it
undocumented.

### Step 4 — split `clo_dynamic`

`clo_dynamic(clo, met, standard)` is the old shape. Upstream split it into two
functions with **different equations and different parameters**
(`pythermalcomfort/utilities.py`):

- `clo_dynamic_ashrae(clo, met, model="55-2023")` → `clo × (0.6 + 0.4/met)`
  above met 1.2.
- `clo_dynamic_iso(clo, met, v, i_a=0.7, model="9920-2007")` → the ISO
  9920:2007 Annex C correction, which needs air speed and estimates walking
  speed from the metabolic rate (`v_walk = 0.0052(M − 58)`, clipped 0–0.7 m/s).

This fork's `"ISO"` branch is neither: it applies the ASHRAE formula with the
threshold moved to met > 1. Implement both functions properly and retire the
`standard` switch.

### Step 5 — retire the `standard` switch wherever it survives

Upstream deleted the combined `pmv_ppd` outright (commit `61de959`, "split pmv
iso and ashrae; … replaced input standard with model; deleted pmv function").
This fork still ships all three, and one chart helper still calls the old shape.

1. `src/models/index.ts`: stop exporting `pmv_ppd`. Keep it as the internal
   shared kernel that `pmv_ppd_iso` / `pmv_ppd_ashrae` delegate to — in TS that
   means simply not exporting it, not a `_` prefix.
2. `src/charts/comfort_zone.ts`: `psychrometricZone` takes
   `standard: "ISO" | "ASHRAE"` and calls `pmv_ppd(..., standard)` with a
   default of `"ASHRAE"`. Replace that option with the **model function
   itself** — both models share the signature
   `(tdb, tr, vr, rh, met, clo, wme?, kwargs?)`, so it is a drop-in. Export a
   type for it (e.g. `PmvPpdModel`) so consumers can annotate. The zone keeps
   controlling `limit_inputs: false` / `round_output: false` internally.

   Why this matters: the default is `"ASHRAE"`, so a consumer drawing the ISO
   model's comfort zone gets ASHRAE geometry unless it remembers to pass a
   string that the model function already hard-codes. The consuming app
   currently carries a `pmvVariant` field in its model declarations purely to
   work around this; that field disappears the moment this lands.

3. Add the **edition** concept upstream introduced: `pmv_ppd_iso` accepts
   `"7730-2005"` and `"7730-2025"` (upstream defaults to 2025), `pmv_ppd_ashrae`
   accepts only `"55-2023"`. Verified: upstream's two ISO editions currently run
   the same kernel with the same limits, so this changes no numbers — it is
   about being able to say which edition the result is.

   **Naming deviation to make here**: upstream calls the parameter `model`.
   In this package and in the consuming app `model` already means "a model
   function / a registered model", so `model="7730-2005"` reads as a category
   error. Use `edition`, and document that it is upstream's `model` parameter.

### Step 6 — naming

Follow upstream. Equations on both sides were confirmed identical for every one
of these, so these are pure renames:

| here                                                            | upstream                         |
| --------------------------------------------------------------- | -------------------------------- |
| `two_nodes`                                                     | `two_nodes_gagge`                |
| `t_o`                                                           | `operative_tmp`                  |
| `t_mrt`                                                         | `mean_radiant_tmp`               |
| `t_wb`                                                          | `wet_bulb_tmp`                   |
| `t_dp`                                                          | `dew_point_tmp`                  |
| `enthalpy`                                                      | `enthalpy_air`                   |
| `rh_from_humidity_ratio`                                        | `hr_to_rh`                       |
| `psy_ta_rh` result fields `t_wb` / `t_dp`                       | `wet_bulb_tmp` / `dew_point_tmp` |
| `set_tmp` / `two_nodes` params `body_position`, `p_atmospheric` | `position`, `p_atm`              |
| `clo_typical_ensembles` (a function)                            | a lookup table                   |

`clo_typical_ensembles` becoming data also fits this package's own `reference/`
layer better than a function does.

One more naming question to settle while you are here: `Standard` (this
package's compliance dispatch key, `utilities.ts`) collides conceptually with
upstream's `Models` enum, which means editions. Upstream has since replaced the
unified `check_standard_compliance` with per-model inline validation, and this
package's `reference/limits.ts` is a better answer than either. Consider
retiring `Standard` or renaming it so the two ideas stop sharing a word.

**Constraint on how**: rename occurrence by occurrence, reading each site. No
`sed`, no codemod, no generated batch-rewrite script — same spelling does not
mean same meaning, and string literals, comments and unrelated modules must not
be swept up.

### Small items to carry along

- `src/models/two_nodes.ts` computes `ps` (percent satisfied) via
  `calculate_percent_satisfied` and never returns it. Either return it (check
  whether upstream's return class has the field) or delete the dead code.
- `set_tmp` here takes a `units` parameter; upstream's signature has none.
  Establish whether upstream moved unit conversion out of that model, then match.
- `src/psychrometrics/psy_ta_rh.ts`'s JSDoc `@example` is wrong: it shows
  `hr: -2.2041754048718936` and `h: -5575107.96`, a negative humidity ratio and
  a negative enthalpy, which are impossible for any input. The function itself
  is correct — `psy_ta_rh(25, 50)` returns
  `{ p_sat: 3169.2, p_vap: 1584.6, hr: 0.00988, t_wb: 18, t_dp: 13.8, h: 50259.66 }`.
  The example presumably predates the recent "invert psy_ta_rh's four humidity
  outputs" change. Fix it and check the neighbouring examples for the same rot.

## 5. Structure to keep (deliberate divergence from upstream)

Do not "align" these; they are this package's own answers, and each is better
than the upstream shape for a typed, tree-shaken library. Where you touch them,
leave a comment saying the divergence is intentional:

- **`reference/`** — limits, bands and offsets as public data. Upstream inlines
  `valid_range` calls per model. Data beats code here: consumers can render a
  warning or gate an input without re-deriving thresholds.
- **`io/`** — `Quantity` / `Measure` / `Outcome`. Upstream's `PMVPPD` dataclass
  carries `tsv` and `compliance` fields directly; this package expresses the
  same logic through `Measure.category` and `Measure.intervals`. Same
  information, better typed.
- **`charts/`** — no upstream counterpart (upstream's `plots/` draws matplotlib
  figures; this is geometry).
- **`psychrometrics/` as its own module** rather than folded into
  `utilities.py`, for tree-shaking.
- **kwargs objects** instead of upstream's flattened keyword parameters
  (`round_output`, `calculate_ce`, `max_sweating`, `w_max`). TypeScript has no
  keyword arguments; flattening would give `two_nodes` thirteen positional
  parameters.

## 6. Definition of done, per step

1. `npm test` and `npm run build` pass here.
2. Then, in `/Users/yehuihuang/SoftwareProjects/USYD/main repo/comfort-tool`:
   `npm test`, `npm run check`, `npm run lint`, `npm run build` all pass. The app
   is a live consumer; a breaking rename must be followed through there in the
   same pass, occurrence by occurrence.
3. Public API changes are recorded in this package's docs/CHANGELOG, with the
   upstream reference (file, and commit where relevant) and — for any deliberate
   divergence — the reason.

Steps 1–5 must be finished before the consuming app's Phase 4; step 6 may land
after, but the app's `t_o` references ride along with it.
