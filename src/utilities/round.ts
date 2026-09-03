/**
 * Rounds a number to the given precision.
 *
 * Kept in its own module with no imports of its own: `utilities.ts` needs
 * `p_sat`/`t_o` from `psychrometrics/`, and several `psychrometrics/` modules
 * need `round`. Homing `round` here is what keeps that from being a cycle.
 *
 * @param number - the number to round
 * @param precision - the number of decimal places to round to
 * @returns the rounded result
 */
export function round(number: number, precision: number): number {
  const smudge = 10 ** precision;
  return Math.round(number * smudge) / smudge;
}
