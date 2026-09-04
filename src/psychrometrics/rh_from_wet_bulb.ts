import { bisect } from "../utilities/root_finding.js";
import { stull } from "./wet_bulb_tmp.js";

/**
 * Relative humidity from the wet-bulb temperature.
 *
 * Numeric inverse of `wet_bulb_tmp()`: bisection on Stull's fit before its
 * 0.1 °C rounding, to 1e-6 % rh, clamped to `[0, 100]` at the fit's own
 * extremes. The fit takes no pressure, so neither does this.
 *
 * Stull's fit dips before it rises: a hair around rh = 2 at room temperature,
 * deeply and widely below about 10 °C, and by −20 °C it never rises at all.
 * Only the rising part is inverted, so a wet-bulb at or below the fit's floor
 * reads as 0, and in the cold the fit has no inverse to speak of.
 *
 * @public
 * @category Psychrometrics
 *
 * @param wet_bulb_tmp - wet-bulb temperature, [°C]
 * @param tdb - dry-bulb air temperature, [°C]
 * @returns relative humidity, [%]
 */
export function rh_from_wet_bulb(wet_bulb_tmp: number, tdb: number): number {
  const fit = (rh: number): number => stull(tdb, rh);
  if (wet_bulb_tmp >= fit(100)) return 100;
  // Bracket from the fit's lowest whole percent so bisection sees one crossing.
  let lo = 0;
  for (let rh = 1; rh <= 100; rh += 1) if (fit(rh) < fit(lo)) lo = rh;
  if (wet_bulb_tmp <= fit(lo)) return 0;
  return bisect(lo, 100, fit, 1e-6, wet_bulb_tmp);
}
