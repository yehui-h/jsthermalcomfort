import {
  adaptiveCoolingEffectMinOperative,
  adaptiveCoolingEffectSteps,
  adaptiveEnOffsets,
} from "../reference/offsets.js";
import { standards } from "../reference/standards.js";
import { operative_tmp } from "../psychrometrics/operative_tmp.js";
import {
  UNIT_SYSTEMS,
  units_converter,
  round,
  validateInputs,
} from "../utilities/utilities.js";
import type { UnitSystem, ValidationSchema } from "../utilities/utilities.js";

const ADAPTIVE_EN_SCHEMA = {
  tdb: { type: "number" },
  tr: { type: "number" },
  t_running_mean: { type: "number" },
  v: { type: "number" },
  units: { enum: UNIT_SYSTEMS },
  limit_inputs: { type: "boolean" },
  round_output: { type: "boolean", required: false },
} satisfies ValidationSchema;

/**
 * Adaptive comfort result per EN 16798-1.
 *
 * Every temperature is in [°C], or in [°F] when `units` = 'IP'.
 *
 * @public
 */
export interface AdaptiveEnResult {
  /** Comfort temperature at that specific running mean temperature */
  tmp_cmf: number;
  /** If the indoor conditions comply with comfort category I */
  acceptability_cat_i: boolean;
  /** If the indoor conditions comply with comfort category II */
  acceptability_cat_ii: boolean;
  /** If the indoor conditions comply with comfort category III */
  acceptability_cat_iii: boolean;
  /** Upper acceptable comfort temperature for category I */
  tmp_cmf_cat_i_up: number;
  /** Upper acceptable comfort temperature for category II */
  tmp_cmf_cat_ii_up: number;
  /** Upper acceptable comfort temperature for category III */
  tmp_cmf_cat_iii_up: number;
  /** Lower acceptable comfort temperature for category I */
  tmp_cmf_cat_i_low: number;
  /** Lower acceptable comfort temperature for category II */
  tmp_cmf_cat_ii_low: number;
  /** Lower acceptable comfort temperature for category III */
  tmp_cmf_cat_iii_low: number;
}

/**
 * Determines the adaptive thermal comfort based on EN 16798-1 2019 [3].
 *
 * Use it to calculate whether your conditions fall within the EN adaptive
 * thermal comfort region. Calculations comply with EN 16798-1 2019 [3].
 *
 * **Elevated air speed.** The indoor operative temperature correction applies
 * to buildings equipped with fans or personal systems that give occupants
 * personal control over air speed at occupant level. For operative
 * temperatures above 25 °C the comfort zone upper limit can be increased by
 * 1.2 °C (0.6 < v < 0.9 m/s), 1.8 °C (0.9 < v < 1.2 m/s) or 2.2 °C
 * (v > 1.2 m/s). The same steps are published as data in
 * `jsthermalcomfort/reference` as `adaptiveCoolingEffectSteps`.
 *
 * @param tdb - dry bulb air temperature, default in [°C] in [°F] if `units` = 'IP'
 * @param tr - mean radiant temperature, default in [°C] in [°F] if `units` = 'IP'
 * @param t_running_mean - running mean temperature, default in [°C] in [°F] if
 * `units` = 'IP'. It can be calculated with
 * {@link running_mean_outdoor_temperature}.
 * @param v - air speed, default in [m/s] in [fps] if `units` = 'IP'
 * @param units - select the SI (International System of Units) or the IP (Imperial Units) system.
 * @param limit_inputs - By default, if the inputs are outside the standard
 * applicability limits the function returns NaN. If false returns values even
 * if the inputs are outside the applicability limits of the model.
 * @param round_output - if true, rounds the returned comfort temperature and
 * bounds to one decimal place in the output unit (rounding is applied after any
 * IP unit conversion); if false, returns the unrounded values.
 *
 * @returns result set
 *
 * @public
 * @category Models
 *
 * @example
 * const results = adaptive_en(25, 25, 20, 0.1);
 * console.log(results); // {tmp_cmf: 25.4, acceptability_cat_i: true, acceptability_cat_ii: true, ... }
 * console.log(results.acceptability_cat_i); // true
 * // The conditions you entered are considered to comply with Category I
 *
 * @example
 * // for users who wants to use the IP system
 * const results = adaptive_en(77, 77, 68, 0.3, 'IP');
 * console.log(results); // {tmp_cmf: 77.7, acceptability_cat_i: true, acceptability_cat_ii: true, ... }
 *
 * @example
 * const results = adaptive_en(25, 25, 9, 0.1);
 * console.log(results); // {tmp_cmf: NaN, acceptability_cat_i: false, acceptability_cat_ii: false, ... }
 * // The adaptive thermal comfort model can only be used
 * // if the running mean temperature is between 10 °C and 33.5 °C.
 * // Every bound is NaN, and no comparison with NaN holds, so every
 * // acceptability flag is false.
 */
export function adaptive_en(
  tdb: number,
  tr: number,
  t_running_mean: number,
  v: number,
  units: UnitSystem = "SI",
  limit_inputs = true,
  round_output = true,
): AdaptiveEnResult {
  validateInputs(
    {
      tdb,
      tr,
      t_running_mean,
      v,
      units: units.toUpperCase(),
      limit_inputs,
      round_output,
    },
    ADAPTIVE_EN_SCHEMA,
  );

  const standard = "ISO";

  if (units.toLowerCase() == "ip") {
    ({ tdb, tr, t_running_mean, v } = units_converter({
      tdb,
      tr,
      t_running_mean,
      v,
    }));
  }

  const to = operative_tmp(tdb, tr, v, standard);

  const ce = get_ce(v, to);

  let t_cmf = 0.33 * t_running_mean + 18.8;

  if (limit_inputs) {
    const trm_valid = t_running_mean >= 10.0 && t_running_mean <= 33.5;
    if (!trm_valid) t_cmf = NaN;
  }

  // Category widths come from the reference table, not from literals repeated
  // here: `adaptiveEnOffsets` is what `adaptive_en.offsets` publishes and what
  // the I/O and chart layers label these bounds with.
  const [catI, catII, catIII] = adaptiveEnOffsets;
  let t_cmf_i_lower = t_cmf + catI.low;
  let t_cmf_ii_lower = t_cmf + catII.low;
  let t_cmf_iii_lower = t_cmf + catIII.low;
  let t_cmf_i_upper = t_cmf + catI.up + ce;
  let t_cmf_ii_upper = t_cmf + catII.up + ce;
  let t_cmf_iii_upper = t_cmf + catIII.up + ce;

  const acceptability_i = t_cmf_i_lower <= to && to <= t_cmf_i_upper;
  const acceptability_ii = t_cmf_ii_lower <= to && to <= t_cmf_ii_upper;
  const acceptability_iii = t_cmf_iii_lower <= to && to <= t_cmf_iii_upper;

  if (units.toLocaleLowerCase() === "ip") {
    ({
      tmp_cmf: t_cmf,
      tmp_cmf_cat_i_up: t_cmf_i_upper,
      tmp_cmf_cat_ii_up: t_cmf_ii_upper,
      tmp_cmf_cat_iii_up: t_cmf_iii_upper,
    } = units_converter(
      {
        tmp_cmf: t_cmf,
        tmp_cmf_cat_i_up: t_cmf_i_upper,
        tmp_cmf_cat_ii_up: t_cmf_ii_upper,
        tmp_cmf_cat_iii_up: t_cmf_iii_upper,
      },
      "SI",
    ));
    ({
      tmp_cmf_cat_i_low: t_cmf_i_lower,
      tmp_cmf_cat_ii_low: t_cmf_ii_lower,
      tmp_cmf_cat_iii_low: t_cmf_iii_lower,
    } = units_converter(
      {
        tmp_cmf_cat_i_low: t_cmf_i_lower,
        tmp_cmf_cat_ii_low: t_cmf_ii_lower,
        tmp_cmf_cat_iii_low: t_cmf_iii_lower,
      },
      "SI",
    ));
  }

  if (round_output) {
    t_cmf = round(t_cmf, 1);
    t_cmf_i_lower = round(t_cmf_i_lower, 1);
    t_cmf_ii_lower = round(t_cmf_ii_lower, 1);
    t_cmf_iii_lower = round(t_cmf_iii_lower, 1);
    t_cmf_i_upper = round(t_cmf_i_upper, 1);
    t_cmf_ii_upper = round(t_cmf_ii_upper, 1);
    t_cmf_iii_upper = round(t_cmf_iii_upper, 1);
  }

  return {
    tmp_cmf: t_cmf,
    acceptability_cat_i: acceptability_i,
    acceptability_cat_ii: acceptability_ii,
    acceptability_cat_iii: acceptability_iii,
    tmp_cmf_cat_i_up: t_cmf_i_upper,
    tmp_cmf_cat_ii_up: t_cmf_ii_upper,
    tmp_cmf_cat_iii_up: t_cmf_iii_upper,
    tmp_cmf_cat_i_low: t_cmf_i_lower,
    tmp_cmf_cat_ii_low: t_cmf_ii_lower,
    tmp_cmf_cat_iii_low: t_cmf_iii_lower,
  };
}
/**
 * The EN 16798-1 cooling effect of elevated air speed, as a step function of
 * air speed. Zero below the first step or below the minimum operative
 * temperature.
 *
 * The steps are `adaptiveCoolingEffectSteps` (`src/reference/offsets.ts`) and
 * the threshold is `adaptiveCoolingEffectMinOperative`. Both are read here
 * rather than repeated, so the published table and the chart kink that uses it
 * cannot disagree with what this returns.
 *
 * @param v - air speed, [m/s]
 * @param to - operative temperature, [°C]
 * @returns the cooling effect to add to the upper comfort bound, [°C]
 *
 * @internal
 */
export function get_ce(v: number, to: number): number {
  if (to < adaptiveCoolingEffectMinOperative) return 0;
  // The table is ascending, so the last step the air speed reaches wins; below
  // the first one nothing does and the effect stays zero.
  let ce = 0;
  for (const step of adaptiveCoolingEffectSteps) {
    if (v >= step.minAirSpeed) ce = step.coolingEffect;
  }
  return ce;
}

// Metadata, not behaviour.
adaptive_en.label = "Adaptive comfort (EN 16798-1)";
adaptive_en.description =
  "Adaptive comfort temperature and category I/II/III ranges per EN 16798-1.";
/** Offsets from `tmp_cmf`. Asymmetric and nested: I \u2282 II \u2282 III. */
adaptive_en.offsets = adaptiveEnOffsets;
// No `.limits`: EN 16798-1 has no applicability table in this package —
// `adaptive_en` calls no compliance check at all.
adaptive_en.standard = standards.en16798;
