import { adaptiveAshraeOffsets } from "../reference/offsets.js";
import { ashrae55AdaptiveLimits } from "../reference/limits.js";
import { standards } from "../reference/standards.js";
import { quantities } from "../io/quantity.js";
import { t_o } from "../psychrometrics/t_o.js";
import {
  UNIT_SYSTEMS,
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

const ADAPTIVE_ASHRAE_SCHEMA = {
  tdb: { type: "number" },
  tr: { type: "number" },
  t_running_mean: { type: "number" },
  v: { type: "number" },
  units: { enum: UNIT_SYSTEMS },
  limit_inputs: { type: "boolean" },
  round_output: { type: "boolean", required: false },
} satisfies ValidationSchema;

/**
 * Determines the adaptive thermal comfort based on ASHRAE 55. The adaptive
 * model relates indoor design temperatures or acceptable temperature ranges
 * to outdoor meteorological or climatological parameters. The adaptive model
 * can only be used in occupant-controlled naturally conditioned spaces that
 * meet all the following criteria:
 *
 * - There is no mechanical cooling or heating system in operation
 * - Occupants have a metabolic rate between 1.0 and 1.5 met
 * - Occupants are free to adapt their clothing within a range as wide as 0.5 and 1.0 clo
 * - The prevailing mean (running mean) outdoor temperature is between 10 and 33.5 °C
 *
 * Use it to calculate whether your conditions fall within the adaptive thermal
 * comfort region. Calculations comply with the ASHRAE 55 2020 Standard [1].
 *
 * The ASHRAE 55 2020 limits are 10 < tdb [°C] < 40, 10 < tr [°C] < 40,
 * 0 < vr [m/s] < 2, 10 < t running mean [°C] < 33.5.
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
 * @param round_output - if true, rounds `t_cmf` to one decimal place in SI
 * before the bounds are derived; if false, returns the unrounded values. Under
 * `units = 'IP'` the rounded SI value is then converted to °F, so IP outputs
 * carry the additional decimals from the °C-to-°F conversion.
 *
 * @returns set containing results for the model
 *
 * @public
 * @category Models
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
    ({ tdb, tr, t_running_mean, v } = units_converter({
      tdb,
      tr,
      t_running_mean,
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
  // The bounds and the message both come from the table; this is the one row
  // `check_standard_compliance("ASHRAE", …)` does not cover.
  const trm = ashrae55AdaptiveLimits.find(
    ({ quantity }) => quantity === quantities.t_running_mean,
  )!;
  if (t_running_mean < trm.min || t_running_mean > trm.max) {
    warnings.push(trm.warning);
  }
  if (limit_inputs && warnings.length > 0) t_cmf = NaN;

  if (round_output) {
    t_cmf = round(t_cmf, 1);
  }

  // The band widths come from the reference table, not from literals repeated
  // here: `adaptiveAshraeOffsets` is what `adaptive_ashrae.offsets` publishes
  // and what the I/O and chart layers label these bounds with.
  const [band80, band90] = adaptiveAshraeOffsets;
  let tmp_cmf_80_low = t_cmf + band80.low;
  let tmp_cmf_90_low = t_cmf + band90.low;
  let tmp_cmf_80_up = t_cmf + band80.up + ce;
  let tmp_cmf_90_up = t_cmf + band90.up + ce;

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
adaptive_ashrae.standard = standards.ashrae55;
/** The ranges this model warns outside of, including the running mean. */
adaptive_ashrae.limits = ashrae55AdaptiveLimits;
