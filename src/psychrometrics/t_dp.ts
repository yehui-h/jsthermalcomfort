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
 */
export function t_dp(tdb: number, rh: number): number {
  const c = 257.14;
  const b = 18.678;
  const d = 234.5;

  const gamma_m = Math.log(
    (rh / 100) * Math.exp((b - tdb / d) * (tdb / (c + tdb))),
  );

  return round((c * gamma_m) / (b - gamma_m), 1);
}
