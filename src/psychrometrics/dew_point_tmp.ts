import { round } from "../utilities/round.js";

/**
 * Calculates the dew point temperature.
 *
 * @public
 * @category Psychrometrics
 *
 * @param tdb - dry bulb air temperature, [°C]
 * @param rh - relative humidity, [%]
 * @returns dew point temperature, [°C]
 *
 * @remarks
 * Named `dew_point_tmp` after upstream's `dew_point_tmp`
 * (`pythermalcomfort/utilities.py`); it was `t_dp` here.
 */
export function dew_point_tmp(tdb: number, rh: number): number {
  const c = 257.14;
  const b = 18.678;
  const d = 234.5;

  const gamma_m = Math.log(
    (rh / 100) * Math.exp((b - tdb / d) * (tdb / (c + tdb))),
  );

  return round((c * gamma_m) / (b - gamma_m), 1);
}
