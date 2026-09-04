import { round } from "../utilities/round.js";

/**
 * Calculates air enthalpy.
 *
 * Named `enthalpy_air` after upstream's `enthalpy_air`
 * (`pythermalcomfort/utilities.py`); it was `enthalpy` here.
 *
 * @public
 * @category Psychrometrics
 *
 * @param tdb - air temperature [C]
 * @param hr - humidity ratio [kg water/kg dry air]
 * @returns enthalpy [J/kg dry air]
 */
export function enthalpy_air(tdb: number, hr: number): number {
  const cp_air = 1004;
  const h_fg = 2501000;
  const cp_vapor = 1805.0;

  const dryAir = cp_air * tdb;
  const satVap = h_fg + cp_vapor * tdb;
  const h = dryAir + hr * satVap;

  return round(h, 2);
}
