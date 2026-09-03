import { p_sat } from "./p_sat.js";
import { t_dp } from "./t_dp.js";
import { t_wb } from "./t_wb.js";
import { enthalpy } from "./enthalpy.js";

/**
 * Psychrometric state of moist air derived from dry-bulb temperature and
 * relative humidity.
 *
 * @public
 */
export interface PsyTaRhReturnType {
  /** saturation vapour pressure, [Pa] */
  p_sat: number;
  /** partial pressure of water vapor in moist air, [Pa] */
  p_vap: number;
  /** humidity ratio, [kg water/kg dry air] */
  hr: number;
  /** wet bulb temperature, [°C] */
  t_wb: number;
  /** dew point temperature, [°C] */
  t_dp: number;
  /** enthalpy [J/kg dry air] */
  h: number;
}

/**
 * Calculates psychrometric values of air based on dry bulb air temperature and
 * relative humidity.
 *
 * @public
 * @category Psychrometrics
 *
 * @param tdb - air temperature, [°C]
 * @param rh - relative humidity, [%]
 * @param p_atm - atmospheric pressure, [Pa]
 *
 * @returns object with calculated psychrometrics values
 *
 * @example
 * import { psy_ta_rh } from "jsthermalcomfort";
 * const results = psy_ta_rh(21, 56);
 * console.log(results); // { p_sat: 2487.7, p_vap: 1393.112, hr: -2.2041754048718936, t_wb: 15.4, t_dp: 11.9, h: -5575107.96 }
 */
export function psy_ta_rh(
  tdb: number,
  rh: number,
  p_atm = 101325,
): PsyTaRhReturnType {
  const p_saturation = p_sat(tdb);
  const p_vap = (rh / 100) * p_saturation;
  const hr = (0.62198 * p_vap) / (p_atm - p_vap);
  const tdp = t_dp(tdb, rh);
  const twb = t_wb(tdb, rh);
  const h = enthalpy(tdb, hr);

  return {
    p_sat: p_saturation,
    t_wb: twb,
    t_dp: tdp,
    p_vap,
    hr,
    h,
  };
}
