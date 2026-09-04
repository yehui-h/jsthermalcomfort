/**
 * Stull's wet-bulb fit before rounding. Internal: {@link wet_bulb_tmp} rounds
 * it and `rh_from_wet_bulb` inverts it.
 *
 * @internal
 */
export function stull(tdb: number, rh: number): number {
  return (
    tdb * Math.atan(0.151977 * Math.pow(rh + 8.313659, 0.5)) +
    Math.atan(tdb + rh) -
    Math.atan(rh - 1.676331) +
    0.00391838 * Math.pow(rh, 1.5) * Math.atan(0.023101 * rh) -
    4.686035
  );
}

/**
 * Calculates the wet-bulb temperature using the Stull equation [6].
 *
 * @public
 * @category Psychrometrics
 *
 * @param tdb - air temperature, [°C]
 * @param rh - relative humidity, [%]
 * @returns wet-bulb temperature, [°C]
 *
 * @remarks
 * Named `wet_bulb_tmp` after upstream's `wet_bulb_tmp`
 * (`pythermalcomfort/utilities.py`); it was `t_wb` here.
 */
export function wet_bulb_tmp(tdb: number, rh: number): number {
  return Math.round(stull(tdb, rh) * 10) / 10;
}
