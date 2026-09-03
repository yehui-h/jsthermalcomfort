import { isoThermalSensation } from "../reference/bands.js";
import { pmv_ppd } from "./pmv_ppd.js";
import { validateInputs } from "../utilities/utilities.js";
import type { UnitSystem, ValidationSchema } from "../utilities/utilities.js";

/**
 * @typedef {Object} PmvPpdIso
 * @property {number} pmv - Predicted Mean Vote on the ISO 7730 scale [-3, +3]
 * @property {number} ppd - Predicted Percentage of Dissatisfied [%]
 * @public
 */

/**
 * Calculate PMV and PPD in accordance with ISO 7730.
 *
 * Delegates to {@link pmv_ppd} with the standard fixed to `'ISO'`.
 * The ISO equation uses Fanger's original PMV formulation without the
 * ASHRAE cooling-effect adjustment.
 *
 * ISO 7730 applies stricter input limits than ASHRAE 55. When
 * `limit_inputs` is true (the default), inputs outside the following
 * ranges cause the function to return NaN:
 * - 10 < tdb [°C] < 30
 * - 10 < tr  [°C] < 40
 * -  0 < vr  [m/s] < 1
 * - 0.8 < met [met] < 4
 * -  0 < clo [clo] < 2
 * - -2 < PMV < 2 (result is clamped to NaN outside this range)
 *
 * @param {number} tdb - Dry-bulb air temperature [°C] (or [°F] if units = 'IP')
 * @param {number} tr  - Mean radiant temperature [°C] (or [°F] if units = 'IP')
 * @param {number} vr  - Relative air speed [m/s] (or [fps] if units = 'IP')
 * @param {number} rh  - Relative humidity [%]
 * @param {number} met - Metabolic rate [met]
 * @param {number} clo - Clothing insulation [clo]
 * @param {number} [wme=0] - External work [met]
 * @param {Object} [kwargs={}] - Optional overrides
 * @param {'SI'|'IP'} [kwargs.units='SI'] - Unit system
 * @param {boolean}   [kwargs.limit_inputs=true] - Return NaN for out-of-range inputs
 * @param {boolean}   [kwargs.round_output=true] - Round pmv to 2 decimal places and ppd to 1
 * @returns {PmvPpdIso} PMV and PPD values
 *
 * @example
 * const r = pmv_ppd_iso(25, 25, 0.1, 50, 1.2, 0.5);
 * console.log(r.pmv); // 0.08
 * console.log(r.ppd); // 5.1
 *
 * @public
 * @category Models
 */
/** Optional overrides accepted by {@link pmv_ppd_iso}. */
export interface PmvPpdIsoKwargs {
  units?: UnitSystem;
  limit_inputs?: boolean;
  round_output?: boolean;
}

/** PMV and PPD on the ISO 7730 scale. */
export interface PmvPpdIso {
  /** Predicted Mean Vote on the ISO 7730 scale [-3, +3] */
  pmv: number;
  /** Predicted Percentage of Dissatisfied [%] */
  ppd: number;
}

const PMV_PPD_ISO_SCHEMA = {
  tdb: { type: "number" },
  tr: { type: "number" },
  vr: { type: "number" },
  rh: { type: "number" },
  met: { type: "number" },
  clo: { type: "number" },
  wme: { type: "number" },
  units: { enum: ["SI", "IP"], required: false },
  limit_inputs: { type: "boolean", required: false },
  round_output: { type: "boolean", required: false },
} satisfies ValidationSchema;

export function pmv_ppd_iso(
  tdb: number,
  tr: number,
  vr: number,
  rh: number,
  met: number,
  clo: number,
  wme = 0,
  kwargs: PmvPpdIsoKwargs = {},
): PmvPpdIso {
  validateInputs(
    {
      tdb,
      tr,
      vr,
      rh,
      met,
      clo,
      wme,
      units: kwargs.units?.toUpperCase(),
      limit_inputs: kwargs.limit_inputs,
      round_output: kwargs.round_output,
    },
    PMV_PPD_ISO_SCHEMA,
  );
  return pmv_ppd(tdb, tr, vr, rh, met, clo, wme, "ISO", kwargs);
}

// Metadata, not behaviour: attaching these leaves the function's arguments and
// return value untouched (pinned by tests/baseline.test.ts). They exist so a
// consuming tool can label and shade a result without transcribing the bands.
pmv_ppd_iso.label = "PMV / PPD (ISO 7730)";
pmv_ppd_iso.description =
  "Predicted Mean Vote and Predicted Percentage of Dissatisfied per ISO 7730.";
/** Thermal sensation scale, left-closed: `[-1.5, -0.5)` is "Slightly Cool". */
pmv_ppd_iso.tsv = isoThermalSensation;
