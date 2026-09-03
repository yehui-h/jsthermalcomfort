import { isoThermalSensation } from "../reference/bands.js";
import { iso7730PmvLimits } from "../reference/limits.js";
import { standards } from "../reference/standards.js";
import { pmv_ppd } from "./pmv_ppd.js";
import type { PmvPpdKwargs, PmvPpdResult } from "./pmv_ppd.js";

/**
 * Optional overrides accepted by {@link pmv_ppd_iso}: everything
 * {@link pmv_ppd} takes except the ASHRAE-only `airspeed_control`.
 */
export type PmvPpdIsoKwargs = Omit<PmvPpdKwargs, "airspeed_control">;

/**
 * Calculate PMV and PPD in accordance with ISO 7730.
 *
 * Delegates to {@link pmv_ppd} with the standard fixed to `'ISO'`, which also
 * validates every argument. The ISO equation uses Fanger's original PMV
 * formulation without the ASHRAE cooling-effect adjustment.
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
 * @param tdb - Dry-bulb air temperature [°C] (or [°F] if units = 'IP')
 * @param tr - Mean radiant temperature [°C] (or [°F] if units = 'IP')
 * @param vr - Relative air speed [m/s] (or [fps] if units = 'IP')
 * @param rh - Relative humidity [%]
 * @param met - Metabolic rate [met]
 * @param clo - Clothing insulation [clo]
 * @param wme - External work [met]
 * @param kwargs - Optional overrides; see {@link PmvPpdIsoKwargs}
 * @returns PMV and PPD values
 *
 * @public
 * @category Models
 *
 * @example
 * const r = pmv_ppd_iso(25, 25, 0.1, 50, 1.2, 0.5);
 * console.log(r.pmv); // 0.08
 * console.log(r.ppd); // 5.1
 */
export function pmv_ppd_iso(
  tdb: number,
  tr: number,
  vr: number,
  rh: number,
  met: number,
  clo: number,
  wme = 0,
  kwargs: PmvPpdIsoKwargs = {},
): PmvPpdResult {
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
pmv_ppd_iso.standard = standards.iso7730;
/** The ranges outside which this model warns and, by default, returns NaN. */
pmv_ppd_iso.limits = iso7730PmvLimits;
