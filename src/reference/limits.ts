import { quantities } from "../io/quantity.js";
import type { Quantity } from "../io/quantity.js";

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
 * ISO 7730 applicability limits, as read by `_iso_compliance`
 * (`src/utilities/utilities.ts`).
 *
 * **Source, not mirror** — unlike {@link adaptiveAshraeOffsets}, the check
 * function reads these rows, so there is one copy of each number.
 *
 * @public
 */
export const iso7730PmvLimits: readonly ApplicabilityLimit[] = [
  {
    quantity: quantities.tdb,
    min: 10,
    max: 30,
    warning: "ISO air temperature applicability limits between 10 and 30 ºC",
  },
  {
    quantity: quantities.tr,
    min: 10,
    max: 40,
    warning:
      "ISO mean radiant temperature applicability limits between 10 and 40 ºC",
  },
  {
    quantity: quantities.v,
    min: 0,
    max: 1,
    warning: "ISO air speed applicability limits between 0 and 1 m/s",
  },
  {
    quantity: quantities.vr,
    min: 0,
    max: 1,
    warning: "ISO air speed applicability limits between 0 and 1 m/s",
  },
  {
    // NOTE: `min` is 0, not the 0.8 the warning names. jsthermalcomfort 1.4.0
    // checks `value < 0` while printing "between 0.8 and 4.0", so the ISO lower
    // met limit never actually fires; pythermalcomfort uses (0.8, 4.0).
    // `tests/baseline.test.ts` pins the 1.4.0 behaviour, so the code keeps 0
    // and the discrepancy is recorded here — as the comment in
    // `_iso_compliance` promises.
    quantity: quantities.met,
    min: 0,
    max: 4,
    warning: "ISO met applicability limits between 0.8 and 4.0 met",
  },
  {
    quantity: quantities.clo,
    min: 0,
    max: 2,
    warning: "ISO clo applicability limits between 0.0 and 2 clo",
  },
];

// The three rows ASHRAE 55 constrains identically for its PMV and its adaptive
// model. Shared by identity so "same as ASHRAE" is literally true.
const ashraeTdb: ApplicabilityLimit = {
  quantity: quantities.tdb,
  min: 10,
  max: 40,
  warning:
    "ASHRAE dry-bulb temperature application limits between 10 and 40 ºC",
};

const ashraeTr: ApplicabilityLimit = {
  quantity: quantities.tr,
  min: 10,
  max: 40,
  warning:
    "ASHRAE mean radiant temperature application limits between 10 and 40 ºC",
};

const ashraeV: ApplicabilityLimit = {
  quantity: quantities.v,
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
    min: 0,
    max: 2,
    warning: ashraeV.warning,
  },
  {
    quantity: quantities.met,
    min: 1,
    max: 4,
    warning: "ASHRAE met applicability limits between 1.0 and 4.0 met",
  },
  {
    quantity: quantities.clo,
    min: 0,
    max: 1.5,
    warning: "ASHRAE clo applicability limits between 0.0 and 1.5 clo",
  },
];

/**
 * ASHRAE 55 applicability limits for the adaptive model.
 *
 * The first three rows are the very objects in {@link ashrae55PmvLimits} —
 * `adaptive_ashrae` runs the same `check_standard_compliance("ASHRAE", …)` over
 * `tdb`, `tr` and `v`. The running mean is the model's own extra check, and is
 * the reason this table exists separately.
 *
 * @public
 */
export const ashrae55AdaptiveLimits: readonly ApplicabilityLimit[] = [
  ashraeTdb,
  ashraeTr,
  ashraeV,
  {
    quantity: quantities.t_running_mean,
    min: 10,
    max: 33.5,
    // U+00B0 DEGREE SIGN here, not the U+00BA the utilities messages use.
    warning:
      "ASHRAE running mean outdoor temperature applicability limits between 10.0 and 33.5 °C",
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
