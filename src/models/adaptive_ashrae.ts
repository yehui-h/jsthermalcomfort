import { adaptiveAshraeOffsets } from "../reference/offsets.js";
import { t_o } from "../psychrometrics/t_o.js";
import {
  check_standard_compliance,
  round,
  units_converter,
  validateInputs,
} from "../utilities/utilities.js";
import { get_ce } from "./adaptive_en.js";
import type { UnitSystem, ValidationSchema } from "../utilities/utilities.js";

/**
 * Adaptive comfort result per ASHRAE 55.
 *
 * @public
 */
export interface AdaptiveAshraeResult {
  /** Comfort temperature a that specific running mean temperature, default in [°C] or in [°F] */
  tmp_cmf: number;
  /** Lower acceptable comfort temperature for 80% occupants, default in [°C] or in [°F] */
  tmp_cmf_80_low: number;
  /** Upper acceptable comfort temperature for 80% occupants, default in [°C] or in [°F] */
  tmp_cmf_80_up: number;
  /** Lower acceptable comfort temperature for 90% occupants, default in [°C] or in [°F] */
  tmp_cmf_90_low: number;
  /** Upper acceptable comfort temperature for 90% occupants, default in [°C] or in [°F] */
  tmp_cmf_90_up: number;
  /** Acceptability for 80% occupants */
  acceptability_80: boolean;
  /** Acceptability for 90% occupants */
  acceptability_90: boolean;
}

/**
 * Determines the adaptive thermal comfort based on ASHRAE 55. The adaptive
 * model relates indoor design temperatures or acceptable temperature ranges
 * to outdoor meteorological or climatological parameters. The adaptive model
 * can only be used in occupant-controlled naturally conditioned spaces that
 * meet all the following criteria:
 *
 * - There is no mechianical cooling or heating system in operation
 * - Occupants have a metabolic rate between 1.0 and 1.5 met
 * - Occupants are free to adapt their clothing within a range as wide as 0.5 and 1.0 clo
 * - The prevailing mean (runnin mean) outdoor temperature is between 10 and 33.5 °C
 *
 *
 * @public
 * @category Models
 *
 * @param {number} tdb - dry bulb air temperature, default in [°C] in [°F] if `units` = 'IP'
 * @param {number} tr - mean radiant temperature, default in [°C] in [°F] if `units` = 'IP'
 * @param {number} t_running_mean - running mean temperature, default in [°C] in [°C] in [°F] if `units` = 'IP'
 * The running mean temperature can be calculated using the function {@link #running_mean_outdoor_temperature|running_mean_outdoor_temperature}
 * @param {number} v - air speed, default in [m/s] in [fps] if `units` = 'IP'
 * @param {"SI" | "IP"} units - select the SI (International System of Units) or the IP (Imperial Units) system.
 * @param {boolean} limit_inputs - By default, if the inputs are outsude the standard applicability limits the
 * function returns nan. If False returns pmv and ppd values even if input values are
 * outside the applicability limits of the model.
 * @param {boolean} [round_output=true] - if true, rounds `t_cmf` to one decimal place in SI before bounds are derived; if false, returns the unrounded values. Under `units = 'IP'` the rounded SI value is then converted to °F, so IP outputs carry the additional decimals from the °C-to-°F conversion.
 *
 * @returns {AdaptiveAshraeResult} set containing results for the model
 *
 * The ASHRAE 55 2020 limits are 10 < tdb [°C] < 40, 10 < tr [°C] < 40,
 * 0 < vr [m/s] < 2, 10 < t running mean [°C] < 33.5
 *
 * You can use this function to calculate if your conditions are within the `adaptive thermal comfort region`.
 * Calculations with comply with the ASHRAE 55 2020 Standard [1].
 *
 * @example
 * import { adaptive_ashrae } from "jsthermalcomfort/models";
 * const results = adaptive_ashrae(25, 25, 20, 0.1);
 * console.log(results);
 * // {tmp_cmf: 24.0, tmp_cmf_80_low: 20.5, tmp_cmf_80_up: 27.5,
 * //   tmp_cmf_90_low: 21.5, tmp_cmf_90_up: 26.5, acceptability_80: true,
 * //   acceptability_90: true}
 * console.log(results.acceptability_80);
 * // true
 *
 * @example
 * import { adaptive_ashrae } from "jsthermalcomfort/models";
 * // For users who want to use the IP system
 * const results = adaptive_ashrae(77, 77, 68, 0.3, 'IP');
 * console.log(results);
 * // {tmp_cmf: 75.2, tmp_cmf_80_low: 68.9, tmp_cmf_80_up: 81.5,
 * //  tmp_cmf_90_low: 70.7, tmp_cmf_90_up: 79.7, acceptability_80: true,
 * //  acceptability_90: true}
 *
 * @example
 * import { adaptive_ashrae } from "jsthermalcomfort/models";
 * const results = adaptive_ashrae(25, 25, 9, 0.1);
 * console.log(results);
 * // {tmp_cmf: NaN, tmp_cmf_80_low: NaN, ...}
 * // The adaptive thermal comfort model can only be used
 * // if the running mean temperature is higher than 10°C
 */
const ADAPTIVE_ASHRAE_SCHEMA = {
  tdb: { type: "number" },
  tr: { type: "number" },
  t_running_mean: { type: "number" },
  v: { type: "number" },
  units: { enum: ["SI", "IP"] },
  limit_inputs: { type: "boolean" },
  round_output: { type: "boolean", required: false },
} satisfies ValidationSchema;

export function adaptive_ashrae(
  tdb: number,
  tr: number,
  t_running_mean: number,
  v: number,
  units: UnitSystem = "SI",
  limit_inputs = true,
  round_output = true,
): AdaptiveAshraeResult {
  const r = adaptive_ashrae_with_warnings(
    tdb,
    tr,
    t_running_mean,
    v,
    units,
    limit_inputs,
    round_output,
  );
  // Warnings are intentionally dropped here: this function's return shape is
  // public API. The I/O layer calls the kernel directly to get them.
  return {
    tmp_cmf: r.tmp_cmf,
    tmp_cmf_80_low: r.tmp_cmf_80_low,
    tmp_cmf_80_up: r.tmp_cmf_80_up,
    tmp_cmf_90_low: r.tmp_cmf_90_low,
    tmp_cmf_90_up: r.tmp_cmf_90_up,
    acceptability_80: r.acceptability_80,
    acceptability_90: r.acceptability_90,
  };
}

/**
 * Identical to {@link adaptive_ashrae}, but also returns the applicability
 * warnings that `adaptive_ashrae` computes and discards.
 *
 * Internal: not re-exported from `models/index.ts`. Note it adds one message
 * the public function has no equivalent for — an out-of-range running mean
 * outdoor temperature silently NaNs `tmp_cmf` there, with nothing to explain it.
 *
 * @internal
 */
export function adaptive_ashrae_with_warnings(
  tdb: number,
  tr: number,
  t_running_mean: number,
  v: number,
  units: UnitSystem = "SI",
  limit_inputs = true,
  round_output = true,
): AdaptiveAshraeResult & { warnings: readonly string[] } {
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
    ADAPTIVE_ASHRAE_SCHEMA,
  );

  const standard = "ASHRAE";
  if (units.toUpperCase() === "IP") {
    ({
      tdb,
      tr,
      tmp_running_mean: t_running_mean,
      v,
    } = units_converter({
      tdb,
      tr,
      tmp_running_mean: t_running_mean,
      v,
    }));
  }
  const to = t_o(tdb, tr, v, standard);
  // calculate cooling effect (ce) of elevated air speed when top > 25 degC.
  const ce = get_ce(v, to);
  // Relation between comfort and outdoor temperature
  let t_cmf = 0.31 * t_running_mean + 17.8;

  // Computed unconditionally: `check_standard_compliance` is pure, and the
  // I/O layer needs the messages even when limit_inputs is false. The
  // decision to NaN the result stays gated on limit_inputs exactly as before.
  const warnings: string[] = check_standard_compliance(standard, {
    tdb,
    tr,
    v,
  });
  const trm_valid = t_running_mean >= 10.0 && t_running_mean <= 33.5;
  if (!trm_valid) {
    warnings.push(
      "ASHRAE running mean outdoor temperature applicability limits between 10.0 and 33.5 °C",
    );
  }
  if (limit_inputs && warnings.length > 0) t_cmf = NaN;

  if (round_output) {
    t_cmf = round(t_cmf, 1);
  }

  let tmp_cmf_80_low = t_cmf - 3.5;
  let tmp_cmf_90_low = t_cmf - 2.5;
  let tmp_cmf_80_up = t_cmf + 3.5 + ce;
  let tmp_cmf_90_up = t_cmf + 2.5 + ce;

  const acceptability_80 = tmp_cmf_80_low <= to && to <= tmp_cmf_80_up;
  const acceptability_90 = tmp_cmf_90_low <= to && to <= tmp_cmf_90_up;

  if (units.toUpperCase() === "IP") {
    ({
      tmp_cmf: t_cmf,
      tmp_cmf_80_low,
      tmp_cmf_80_up,
      tmp_cmf_90_low,
      tmp_cmf_90_up,
    } = units_converter(
      {
        tmp_cmf: t_cmf,
        tmp_cmf_80_low,
        tmp_cmf_80_up,
        tmp_cmf_90_low,
        tmp_cmf_90_up,
      },
      "SI",
    ));
  }

  return {
    tmp_cmf: t_cmf,
    tmp_cmf_80_low,
    tmp_cmf_80_up,
    tmp_cmf_90_low,
    tmp_cmf_90_up,
    acceptability_80,
    acceptability_90,
    warnings,
  };
}

// Metadata, not behaviour. This model produces acceptability *ranges* rather
// than a sensation label, so it carries offsets instead of a scale.
adaptive_ashrae.label = "Adaptive comfort (ASHRAE 55)";
adaptive_ashrae.description =
  "Adaptive comfort temperature and 80%/90% acceptability ranges per ASHRAE 55.";
/** Offsets from `tmp_cmf`; the upper bound also gains the cooling effect. */
adaptive_ashrae.offsets = adaptiveAshraeOffsets;
