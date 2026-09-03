/**
 * Calculates the wet-bulb temperature using the Stull equation [6].
 *
 * @public
 * @category Psychrometrics
 *
 * @param tdb - air temperature, [°C]
 * @param rh - relative humidity, [%]
 * @returns wet-bulb temperature, [°C]
 */
export function t_wb(tdb: number, rh: number): number {
  const twb =
    Math.round(
      (tdb * Math.atan(0.151977 * Math.pow(rh + 8.313659, 0.5)) +
        Math.atan(tdb + rh) -
        Math.atan(rh - 1.676331) +
        0.00391838 * Math.pow(rh, 1.5) * Math.atan(0.023101 * rh) -
        4.686035) *
        10,
    ) / 10;

  return twb;
}
