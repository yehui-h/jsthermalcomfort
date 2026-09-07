import { quantities } from "../io/quantity.js";
import type { Quantity } from "../io/quantity.js";

/**
 * Where in a model's evaluation the constrained value appears.
 *
 * A standard's applicability table is not only about arguments. ISO 7730
 * Clause 4 also bounds the water vapour partial pressure, which the model
 * derives from `tdb` and `rh`, and the PMV it returns. Those are not things a
 * caller can type into a form, so a consumer gating an input panel wants the
 * `"input"` rows alone, while one rendering the standard's applicability table
 * wants all three.
 *
 * `check_standard_compliance` range-checks the `"input"` rows only. The other
 * two are enforced where the value exists — inside `pmv_ppd`, after the
 * derivation and after the PMV equation respectively.
 *
 * @public
 */
export type LimitRole = "input" | "derived" | "output";

/**
 * One quantity's applicability range under one standard.
 *
 * The range is inclusive at both ends: a value equal to `min` or `max` is in
 * range, and `check_standard_compliance` warns only outside it.
 *
 * @public
 */
export interface ApplicabilityLimit {
  /** The quantity constrained, by identity — `quantities.tdb`, not `"tdb"`. */
  readonly quantity: Quantity;
  /** Whether the value is passed in, derived, or returned. */
  readonly role: LimitRole;
  /** Lowest in-range value, in SI units. */
  readonly min: number;
  /** Highest in-range value, in SI units. */
  readonly max: number;
  /**
   * The sentence `check_standard_compliance` emits when the value falls
   * outside `[min, max]`.
   *
   * Carried as data rather than templated because the wording is not regular:
   * ASHRAE says "application limits" where every other check says
   * "applicability limits", the numbers are spelled inconsistently
   * (`0 and 1`, `0.0 and 2`, `1.0 and 4.0`), and the degree sign is U+00BA
   * MASCULINE ORDINAL INDICATOR in `utilities.ts` but U+00B0 DEGREE SIGN in
   * `adaptive_ashrae.ts`. `tests/baseline.test.ts` pins every one of those
   * strings byte for byte, so they are the contract, not copy.
   */
  readonly warning: string;
}

/**
 * ISO 7730's bound on the water vapour partial pressure, which the model
 * derives from `tdb` and `rh` as `rh × 10 × antoine(tdb)` rather than taking
 * as an argument.
 *
 * `pmv_ppd` reads this row — it is not a second copy of the number — so the
 * published table and the check cannot drift apart.
 *
 * @public
 */
export const iso7730VapourPressureLimit: ApplicabilityLimit = {
  quantity: quantities.p_vap,
  role: "derived",
  min: 0,
  max: 2700,
  warning:
    "ISO water vapour partial pressure applicability limits between 0 and 2700 Pa",
};

/**
 * ISO 7730's bound on the PMV the model returns. Outside it the standard does
 * not claim the prediction holds, so `pmv_ppd` returns NaN under
 * `limit_inputs: true` however valid the arguments were.
 *
 * ASHRAE 55 has no equivalent output bound, which is why this row belongs to
 * {@link iso7730PmvLimits} alone.
 *
 * @public
 */
export const iso7730PmvRangeLimit: ApplicabilityLimit = {
  quantity: quantities.pmv,
  role: "output",
  min: -2,
  max: 2,
  warning: "ISO PMV applicability limits between -2 and 2",
};

/**
 * ISO 7730 applicability limits, as read by `_iso_compliance`
 * (`src/utilities/utilities.ts`) and, for the two non-input rows, by
 * `pmv_ppd`.
 *
 * **Source, not mirror** — unlike {@link adaptiveAshraeOffsets}, the check
 * function reads these rows, so there is one copy of each number.
 *
 * Mirrors the seven bounds upstream lists in the `limit_inputs` block of
 * `pythermalcomfort/models/pmv_ppd_iso.py`: 10 < tdb < 30, 10 < tr < 40,
 * 0 < vr < 1, 0.8 < met < 4, 0 < clo < 2, 0 < pa < 2700, −2 < PMV < 2.
 *
 * @public
 */
export const iso7730PmvLimits: readonly ApplicabilityLimit[] = [
  {
    quantity: quantities.tdb,
    role: "input",
    min: 10,
    max: 30,
    warning: "ISO air temperature applicability limits between 10 and 30 ºC",
  },
  {
    quantity: quantities.tr,
    role: "input",
    min: 10,
    max: 40,
    warning:
      "ISO mean radiant temperature applicability limits between 10 and 40 ºC",
  },
  {
    quantity: quantities.v,
    role: "input",
    min: 0,
    max: 1,
    warning: "ISO air speed applicability limits between 0 and 1 m/s",
  },
  {
    quantity: quantities.vr,
    role: "input",
    min: 0,
    max: 1,
    warning: "ISO air speed applicability limits between 0 and 1 m/s",
  },
  {
    // `min` was 0 while the warning said 0.8: jsthermalcomfort 1.4.0 checked
    // `value < 0`, so the ISO lower met limit never fired. Upstream uses
    // (0.8, 4.0) — see the `limit_inputs` block of
    // `pythermalcomfort/models/pmv_ppd_iso.py` — and the warning was already
    // quoting that, so 0.8 is what both the check and the message now mean.
    quantity: quantities.met,
    role: "input",
    min: 0.8,
    max: 4,
    warning: "ISO met applicability limits between 0.8 and 4.0 met",
  },
  {
    quantity: quantities.clo,
    role: "input",
    min: 0,
    max: 2,
    warning: "ISO clo applicability limits between 0.0 and 2 clo",
  },
  iso7730VapourPressureLimit,
  iso7730PmvRangeLimit,
];

// The three rows ASHRAE 55 constrains identically for its PMV and its adaptive
// model. Shared by identity so "same as ASHRAE" is literally true.
const ashraeTdb: ApplicabilityLimit = {
  quantity: quantities.tdb,
  role: "input",
  min: 10,
  max: 40,
  warning:
    "ASHRAE dry-bulb temperature application limits between 10 and 40 ºC",
};

const ashraeTr: ApplicabilityLimit = {
  quantity: quantities.tr,
  role: "input",
  min: 10,
  max: 40,
  warning:
    "ASHRAE mean radiant temperature application limits between 10 and 40 ºC",
};

const ashraeV: ApplicabilityLimit = {
  quantity: quantities.v,
  role: "input",
  min: 0,
  max: 2,
  warning: "ASHRAE air speed applicability limits between 0 and 2 m/s",
};

/**
 * ASHRAE 55 applicability limits for the PMV/PPD model, as read by
 * `_ashrae_compliance` (`src/utilities/utilities.ts`).
 *
 * The cross-field rule from table 7.3.4 — the extra air-speed ceiling that
 * applies when the occupant cannot control the airspeed — is not a per-quantity
 * range and stays in the check function.
 *
 * @public
 */
export const ashrae55PmvLimits: readonly ApplicabilityLimit[] = [
  ashraeTdb,
  ashraeTr,
  ashraeV,
  {
    quantity: quantities.vr,
    role: "input",
    min: 0,
    max: 2,
    warning: ashraeV.warning,
  },
  {
    quantity: quantities.met,
    role: "input",
    min: 1,
    max: 4,
    warning: "ASHRAE met applicability limits between 1.0 and 4.0 met",
  },
  {
    quantity: quantities.clo,
    role: "input",
    min: 0,
    max: 1.5,
    warning: "ASHRAE clo applicability limits between 0.0 and 1.5 clo",
  },
];

/**
 * ASHRAE 55 applicability limits for the adaptive model.
 *
 * The first three rows are the very objects in {@link ashrae55PmvLimits} —
 * ASHRAE 55 bounds `tdb`, `tr` and `v` identically for both models. The running
 * mean is the adaptive model's own extra check, and is the reason this table
 * exists separately; `adaptive_ashrae` range-checks all four rows in one pass
 * over this table.
 *
 * @public
 */
export const ashrae55AdaptiveLimits: readonly ApplicabilityLimit[] = [
  ashraeTdb,
  ashraeTr,
  ashraeV,
  {
    quantity: quantities.t_running_mean,
    role: "input",
    min: 10,
    max: 33.5,
    // U+00B0 DEGREE SIGN here, not the U+00BA the utilities messages use.
    warning:
      "ASHRAE running mean outdoor temperature applicability limits between 10.0 and 33.5 °C",
  },
];

/**
 * EN 16798-1 applicability limits for the adaptive model: the running mean
 * outdoor temperature alone.
 *
 * Source, not mirror: `adaptive_en` reads this row for its bound and the `io`
 * layer reads it for the sentence, so the number and the message have one
 * home. The wording keeps the U+00B0 degree sign the sentence has always had.
 *
 * The bound is 33.5 °C, not the 30 °C pythermalcomfort's `adaptive_en.py` documents.
 * pythermalcomfort has the same split — `adaptive_en.py` documents 30 and
 * checks `valid_range(t_running_mean, (10.0, 33.5))` — and the code is what
 * decides the result.
 *
 * @public
 */
export const en16798AdaptiveLimits: readonly ApplicabilityLimit[] = [
  {
    quantity: quantities.t_running_mean,
    role: "input",
    min: 10,
    max: 33.5,
    warning:
      "EN running mean outdoor temperature applicability limits between 10.0 and 33.5 °C",
  },
];

/**
 * The PMV magnitude each EN 16798-1 category allows.
 *
 * These are what the CBE Thermal Comfort Tool passes to its comfort-zone
 * solver, one call per category (`static/js/EN/psych-chart-en.js`,
 * `drawComfortRegions`), and they nest: Category I is the innermost zone.
 *
 * The labels match {@link adaptiveEnOffsets}, so the same category can be
 * named consistently whether it is drawn on a psychrometric chart or an
 * adaptive one.
 *
 * @public
 */
export const enCategoryPmvLimits: readonly {
  readonly label: string;
  /** Comfort holds while |PMV| stays below this. */
  readonly pmvLimit: number;
}[] = [
  { label: "Category I", pmvLimit: 0.2 },
  { label: "Category II", pmvLimit: 0.5 },
  { label: "Category III", pmvLimit: 0.7 },
];
