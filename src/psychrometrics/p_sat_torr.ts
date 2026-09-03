/**
 * Estimates the saturation vapour pressure in [torr].
 *
 * @public
 * @category Psychrometrics
 *
 * @param tdb - dry bulb air temperature [C]
 * @returns saturation vapour pressure [torr]
 */
export function p_sat_torr(tdb: number): number {
  return Math.exp(18.6686 - 4030.183 / (tdb + 235.0));
}
