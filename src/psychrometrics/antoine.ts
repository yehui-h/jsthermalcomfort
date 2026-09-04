/**
 * Saturated vapour pressure from the Antoine equation, [kPa].
 *
 * This is the constant pair ISO 7730 uses to derive the water vapour partial
 * pressure from relative humidity: `pa = rh × 10 × antoine(tdb)` gives [Pa]
 * for `rh` in [%]. `pmv_ppd` uses it for exactly that, and the ISO
 * applicability bound on the result is published as
 * `iso7730VapourPressureLimit` in `jsthermalcomfort/reference`.
 *
 * Mirrors upstream `antoine` (`pythermalcomfort/utilities.py`), including the
 * kPa return unit. It lives here rather than in `utilities` because this
 * package keeps psychrometrics as its own module for tree-shaking; upstream
 * has no such split.
 *
 * Distinct from {@link p_sat}, which returns [Pa] from the ASHRAE
 * formulation, and from {@link p_sat_torr}, which is this same equation with
 * the constant that yields [torr].
 *
 * @public
 * @category Psychrometrics
 *
 * @param tdb - dry bulb air temperature, [°C]
 * @returns saturated vapour pressure, [kPa]
 *
 * @example
 * antoine(25); // 3.16735...
 */
export function antoine(tdb: number): number {
  return Math.exp(16.6536 - 4030.183 / (tdb + 235));
}
