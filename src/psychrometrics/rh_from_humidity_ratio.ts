import { rh_from_vapour_pressure } from "./rh_from_vapour_pressure.js";

/**
 * Relative humidity from the humidity ratio.
 *
 * Inverse of the `hr` that {@link psy_ta_rh} returns, through the vapour
 * pressure `p_vap = hr · p_atm / (0.62198 + hr)`. Clamped to `[0, 100]`.
 *
 * @public
 * @category Psychrometrics
 *
 * @param hr - humidity ratio, [kg water / kg dry air]
 * @param tdb - dry-bulb air temperature, [°C]
 * @param p_atm - atmospheric pressure, [Pa]
 * @returns relative humidity, [%]
 */
export function rh_from_humidity_ratio(
  hr: number,
  tdb: number,
  p_atm = 101325,
): number {
  return rh_from_vapour_pressure((hr * p_atm) / (0.62198 + hr), tdb);
}
