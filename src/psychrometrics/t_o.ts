/** Standards for which an operative-temperature weighting is defined. */
export type OperativeTemperatureStandard = "ISO" | "ASHRAE";

/**
 * Calculates operative temperature in accordance with ISO 7726:1998 [5].
 *
 * @public
 * @category Psychrometrics
 *
 * @param tdb - air temperature [C]
 * @param tr - mean radiant temperature [C]
 * @param v - air speed [m/s]
 * @param standard - the standard to use
 * @returns operative temperature [C]
 *
 * @throws {Error} if `v` is negative, or `standard` is not ISO or ASHRAE
 */
export function t_o(
  tdb: number,
  tr: number,
  v: number,
  standard: OperativeTemperatureStandard = "ISO",
): number {
  if (v < 0) {
    throw new Error("v cannot be negative");
  }

  switch (standard) {
    case "ISO":
      return _t_o_calculation_iso(tdb, tr, v);
    case "ASHRAE":
      return _t_o_calculation_ashrae(tdb, tr, v);
    default:
      // Reachable from untyped JavaScript callers, so the runtime guard stays.
      throw new Error("standard must be one of ISO or ASHRAE");
  }
}

/** Runs the ISO t_o calculation for scalar values. */
function _t_o_calculation_iso(tdb: number, tr: number, v: number): number {
  return (tdb * Math.sqrt(10 * v) + tr) / (1 + Math.sqrt(10 * v));
}

/** Runs the ASHRAE t_o calculation for scalar values. */
function _t_o_calculation_ashrae(tdb: number, tr: number, v: number): number {
  let adjustment = v < 0.6 ? 0.6 : 0.7;
  adjustment = v < 0.2 ? 0.5 : adjustment;
  return adjustment * tdb + (1 - adjustment) * tr;
}
