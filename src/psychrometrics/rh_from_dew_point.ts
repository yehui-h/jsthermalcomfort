import { p_sat } from "./p_sat.js";
import { rh_from_vapour_pressure } from "./rh_from_vapour_pressure.js";

/**
 * Relative humidity from the dew-point temperature.
 *
 * The dew point is where the vapour present would saturate, so
 * `p_vap = p_sat(t_dp)` and `rh = 100 · p_sat(t_dp) / p_sat(tdb)`; a dew
 * point at or above `tdb` gives 100.
 *
 * {@link t_dp} is a Magnus fit over water, not the inverse of {@link p_sat}
 * (which follows the ice curve below 0 °C), so `rh_from_dew_point(t_dp(tdb,
 * rh), tdb)` returns `rh` only to within that fit's own error — see
 * `tests/psychrometrics.test.ts` for the measured bound.
 *
 * @public
 * @category Psychrometrics
 *
 * @param t_dp - dew-point temperature, [°C]
 * @param tdb - dry-bulb air temperature, [°C]
 * @returns relative humidity, [%]
 */
export function rh_from_dew_point(t_dp: number, tdb: number): number {
  return rh_from_vapour_pressure(p_sat(t_dp), tdb);
}
