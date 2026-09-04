import { rh_from_vapour_pressure } from "./rh_from_vapour_pressure.js";

/**
 * Relative humidity from the humidity ratio.
 *
 * Inverse of the `hr` that {@link psy_ta_rh} returns, through the vapour
 * pressure `p_vap = hr · p_atm / (0.62198 + hr)`. Clamped to `[0, 100]`.
 *
 * Named `hr_to_rh` after upstream's `hr_to_rh`
 * (`pythermalcomfort/utilities.py`); it was `rh_from_humidity_ratio` here.
 * The clamp is this package's own — upstream returns the raw ratio, which can
 * exceed 100 % for a humidity ratio above saturation.
 *
 * @public
 * @category Psychrometrics
 *
 * @param hr - humidity ratio, [kg water / kg dry air]
 * @param tdb - dry-bulb air temperature, [°C]
 * @param p_atm - atmospheric pressure, [Pa]
 * @returns relative humidity, [%]
 */
export function hr_to_rh(hr: number, tdb: number, p_atm = 101325): number {
  return rh_from_vapour_pressure((hr * p_atm) / (0.62198 + hr), tdb);
}
