import { p_sat } from "./p_sat.js";
import { dew_point_tmp } from "./dew_point_tmp.js";
import { wet_bulb_tmp } from "./wet_bulb_tmp.js";
import { enthalpy_air } from "./enthalpy_air.js";

/**
 * Psychrometric state of moist air derived from dry-bulb temperature and
 * relative humidity.
 *
 * The two temperature fields are named after upstream's `PsychrometricValues`
 * (`pythermalcomfort/classes_return.py`); they were `t_wb` and `t_dp` here.
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
  wet_bulb_tmp: number;
  /** dew point temperature, [°C] */
  dew_point_tmp: number;
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
 * console.log(results);
 * // { p_sat: 2487.7, p_vap: 1393.112, hr: 0.008670783861904020,
 * //   wet_bulb_tmp: 15.4, dew_point_tmp: 11.9, h: 43098.3 }
 */
export function psy_ta_rh(
  tdb: number,
  rh: number,
  p_atm = 101325,
): PsyTaRhReturnType {
  const p_saturation = p_sat(tdb);
  const p_vap = (rh / 100) * p_saturation;
  const hr = (0.62198 * p_vap) / (p_atm - p_vap);
  const tdp = dew_point_tmp(tdb, rh);
  const twb = wet_bulb_tmp(tdb, rh);
  const h = enthalpy_air(tdb, hr);

  return {
    p_sat: p_saturation,
    wet_bulb_tmp: twb,
    dew_point_tmp: tdp,
    p_vap,
    hr,
    h,
  };
}
