import { ashraeThermalSensation } from "../reference/bands.js";
import { LabeledInterval } from "../reference/interval.js";
import { pmv_ppd } from "./pmv_ppd.js";
import { validateInputs } from "../utilities/utilities.js";
import type { ValidationSchema } from "../utilities/utilities.js";
import type { PmvPpdKwargs, PmvPpdResult } from "./pmv_ppd.js";

const PMV_PPD_ASHRAE_SCHEMA = {
  tdb: { type: "number" },
  tr: { type: "number" },
  vr: { type: "number" },
  rh: { type: "number" },
  met: { type: "number" },
  clo: { type: "number" },
  wme: { type: "number" },
  units: { enum: ["SI", "IP"], required: false },
  limit_inputs: { type: "boolean", required: false },
  airspeed_control: { type: "boolean", required: false },
  round_output: { type: "boolean", required: false },
} satisfies ValidationSchema;

/**
 * Calculate PMV and PPD in accordance with ASHRAE 55.
 *
 * Delegates to {@link pmv_ppd} with the standard fixed to `'ASHRAE'`.
 * The ASHRAE equation applies a cooling effect (via SET) before computing
 * PMV — this lowers the result compared to the raw ISO equation when
 * elevated air speed is present.
 *
 * Valid ASHRAE 55 input ranges (when `limit_inputs` is true):
 * - 10 < tdb [°C] < 40
 * - 10 < tr  [°C] < 40
 * -  0 < vr  [m/s] < 2
 * -  1 < met [met] < 4
 * -  0 < clo [clo] < 1.5
 *
 * @param tdb - Dry-bulb air temperature [°C] (or [°F] if units = 'IP')
 * @param tr - Mean radiant temperature [°C] (or [°F] if units = 'IP')
 * @param vr - Relative air speed [m/s] (or [fps] if units = 'IP')
 * @param rh - Relative humidity [%]
 * @param met - Metabolic rate [met]
 * @param clo - Clothing insulation [clo]
 * @param wme - External work [met]
 * @param kwargs - Optional overrides; see {@link PmvPpdKwargs}
 * @returns PMV and PPD values
 *
 * @public
 * @category Models
 *
 * @example
 * const r = pmv_ppd_ashrae(25, 25, 0.1, 50, 1.2, 0.5);
 * console.log(r.pmv); // 0.08
 * console.log(r.ppd); // 5.1
 */
export function pmv_ppd_ashrae(
  tdb: number,
  tr: number,
  vr: number,
  rh: number,
  met: number,
  clo: number,
  wme = 0,
  kwargs: PmvPpdKwargs = {},
): PmvPpdResult {
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
      airspeed_control: kwargs.airspeed_control,
      round_output: kwargs.round_output,
    },
    PMV_PPD_ASHRAE_SCHEMA,
  );
  return pmv_ppd(tdb, tr, vr, rh, met, clo, wme, "ASHRAE", kwargs);
}

// Metadata, not behaviour — see the note on pmv_ppd_iso.
pmv_ppd_ashrae.label = "PMV / PPD (ASHRAE 55)";
pmv_ppd_ashrae.description =
  "Predicted Mean Vote and Predicted Percentage of Dissatisfied per ASHRAE 55.";
/** Thermal sensation scale, right-closed: `(-1.5, -0.5]` is "Slightly Cool". */
pmv_ppd_ashrae.tsv = ashraeThermalSensation;
/** ASHRAE 55 considers a space compliant while |PMV| stays under this. */
pmv_ppd_ashrae.COMPLIANCE_LIMIT = 0.5;
/**
 * The compliance range, **open at both ends** — pythermalcomfort computes it as
 * `(pmv > -0.5) & (pmv < 0.5)` (`models/pmv_ppd_ashrae.py:194`), so a PMV of
 * exactly ±0.5 is not compliant.
 */
pmv_ppd_ashrae.compliance = new LabeledInterval(
  "Compliant",
  { value: -0.5, inclusive: false },
  { value: 0.5, inclusive: false },
);
