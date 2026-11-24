import * as math from "mathjs";

/**
 * Calculate operative temperature [°C]
 *
 * @param {math.MathCollection} tdb - Air temperature [°C]
 * @param {math.MathCollection} tr - Mean radiant temperature [°C]
 * @param {math.MathCollection} hc - Convective heat transfer coefficient [W/(m2*K)]
 * @param {math.MathCollection} hr - Radiative heat transfer coefficient [W/(m2*K)]

 * @returns {math.MathCollection} Operative temperature [°C]
 */
export function operative_temp(tdb, tr, hc, hr) {
  return math.dotDivide(
    math.add(math.dotMultiply(hc, tdb), math.dotMultiply(hr, tr)),
    math.add(hc, hr),
  );
}
