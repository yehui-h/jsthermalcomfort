import { p_sat } from "./p_sat.js";

/**
 * Relative humidity from the partial pressure of water vapour.
 *
 * Inverse of the `p_vap` that {@link psy_ta_rh} returns. Clamped to `[0, 100]`.
 *
 * @public
 * @category Psychrometrics
 *
 * @param p_vap - partial pressure of water vapour, [Pa]
 * @param tdb - dry-bulb air temperature, [°C]
 * @returns relative humidity, [%]
 */
export function rh_from_vapour_pressure(p_vap: number, tdb: number): number {
  return Math.min(100, Math.max(0, (100 * p_vap) / p_sat(tdb)));
}
