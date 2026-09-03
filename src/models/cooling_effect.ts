import {
  round,
  units_converter,
  validateInputs,
} from "../utilities/utilities.js";
import type { UnitSystem, ValidationSchema } from "../utilities/utilities.js";
import { set_tmp } from "./set_tmp.js";

const COOLING_EFFECT_SCHEMA = {
  tdb: { type: "number" },
  tr: { type: "number" },
  vr: { type: "number" },
  rh: { type: "number" },
  met: { type: "number" },
  clo: { type: "number" },
  wme: { type: "number" },
  units: { enum: ["SI", "IP"] },
} satisfies ValidationSchema;

/**
 * Cooling effect of elevated air speed.
 *
 * @public
 */
export interface CoolingEffectResult {
  /** Cooling Effect, default in [°C], in [°F] if `units` = 'IP' */
  ce: number;
}

/**
 * Returns the value of the Cooling Effect
 * ({@link https://en.wikipedia.org/wiki/Thermal_comfort#Cooling_Effect | CE})
 * calculated in compliance with the ASHRAE 55 2020 Standard [1].
 *
 * The CE of the elevated air speed is the value that, when subtracted equally
 * from both the average air temperature and the mean radiant temperature,
 * yields the same
 * {@link https://en.wikipedia.org/wiki/Thermal_comfort#Standard_effective_temperature | SET}
 * under still air as the first SET calculation under elevated air speed. The
 * cooling effect is calculated only for air speed higher than 0.1 m/s; below
 * that this function returns `{ ce: 0 }`.
 *
 * Two of the inputs are pre-corrected quantities, not raw sensor readings:
 *
 * - `vr` is the relative air speed, the average air speed measured by the
 *   sensor plus the activity-generated air speed (Vag) caused by motion of
 *   individual body parts. Calculate it with `v_relative` from
 *   `jsthermalcomfort/utilities`.
 * - `clo` should be the dynamic clothing insulation. Activity and air speed
 *   both modify the insulation of the clothing and the adjacent air layer, so
 *   ISO 7730 states that the clothing insulation shall be corrected [2]. The
 *   ASHRAE 55 Standard corrects for body movement at met ≥ 1.2 using
 *   `clo = Icl × (0.6 + 0.4/met)`. Calculate it with `clo_dynamic` from
 *   `jsthermalcomfort/utilities`.
 *
 * @param tdb - dry bulb air temperature, default in [°C] in [°F] if `units` = 'IP'
 * @param tr - mean radiant temperature, default in [°C] in [°F] if `units` = 'IP'
 * @param vr - relative air speed, default in [m/s] in [fps] if `units` = 'IP'
 * @param rh - relative humidity, [%]
 * @param met - metabolic rate, [met]
 * @param clo - clothing insulation, [clo]
 * @param wme - external work
 * @param units - select the SI (International System of Units) or the IP (Imperial Units) system.
 * @returns Cooling Effect, default in [°C] in [°F] if `units` = 'IP'
 *
 * @public
 * @category Models
 *
 * @example
 * const CE = cooling_effect(25, 25, 0.3, 50, 1.2, 0.5);
 * console.log(CE); // Output: {ce: 1.64}
 *
 * // For users who want to use the IP system
 * const CE_IP = cooling_effect(77, 77, 1.64, 50, 1, 0.6, "IP");
 * console.log(CE_IP); // Output: {ce: 3.74}
 */
export function cooling_effect(
  tdb: number,
  tr: number,
  vr: number,
  rh: number,
  met: number,
  clo: number,
  wme = 0,
  units: UnitSystem = "SI",
): CoolingEffectResult {
  validateInputs(
    { tdb, tr, vr, rh, met, clo, wme, units: units.toUpperCase() },
    COOLING_EFFECT_SCHEMA,
  );

  if (units.toLowerCase() === "ip") {
    const result = units_converter({ tdb, tr, vr }, "IP");
    tdb = result.tdb;
    tr = result.tr;
    vr = result.vr;
  }

  if (vr <= 0.1) {
    return { ce: 0 };
  }

  const still_air_threshold = 0.1;

  const initial_set_tmp = set_tmp(
    tdb,
    tr,
    vr,
    rh,
    met,
    clo,
    wme,
    undefined,
    undefined,
    undefined,
    undefined,
    false,
    {
      round: false,
      calculate_ce: true,
    },
  ).set;

  function func(x: number): number {
    return (
      set_tmp(
        tdb - x,
        tr - x,
        still_air_threshold,
        rh,
        met,
        clo,
        wme,
        undefined,
        undefined,
        undefined,
        undefined,
        false,
        {
          round: false,
          calculate_ce: true,
        },
      ).set - initial_set_tmp
    );
  }

  let ce;
  try {
    // Find a root of a function in a bracketing interval
    ce = brent(func, 0, 40);
  } catch (error) {
    ce = 0;
  }

  if (ce === 0) {
    console.warn(
      `Assuming cooling effect = 0 since it could not be calculated for this set of inputs tdb=${tdb}, tr=${tr}, rh=${rh}, vr=${vr}, clo=${clo}, met=${met}`,
    );
  }

  if (units.toLowerCase() === "ip") {
    ce = (ce / 1.8) * 3.28;
  }

  ce = round(ce, 2);

  return { ce: ce };
}

// https://gist.github.com/ryanspradlin/18c1010b7dd2d875284933d018c5c908
// Derived from: https://en.wikipedia.org/wiki/Brent%27s_method#Algorithm
// Brent's method is a hybrid root-finding algorithm that combines the
// faster/less-reliable inverse quadradic interpolation and secant methods with
// the slower/more-reliable bisection method.
export function brent(
  f: (x: number) => number,
  lowerBound: number,
  upperBound: number,
  tolerance = 1e-6,
  maxIterations = 100,
) {
  let a = lowerBound;
  let b = upperBound;
  let fa = f(a);
  let fb = f(b);

  if (fa * fb > 0) {
    // Root is not bracketed.
    throw new Error(`Root is not bracketed: [${fa}, ${fb}].`);
  }

  if (Math.abs(fa) < Math.abs(fb)) {
    [a, b] = [b, a];
    [fa, fb] = [fb, fa];
  }

  let c = a;
  let fc = fa;
  let s = 0;
  let d = 0;
  let mflag = true;
  for (let i = 0; i < maxIterations; i++) {
    // Check if we have succeeded...
    if (fb === 0 || Math.abs(b - a) <= tolerance) {
      // Root found!
      return b;
    }

    // Try to use fast/less-reliable methods first...
    if (fa !== fc && fb !== fc) {
      // Inverse quadratic interpolation.
      s =
        (a * fb * fc) / ((fa - fb) * (fa - fc)) +
        (b * fa * fc) / ((fb - fa) * (fb - fc)) +
        (c * fa * fb) / ((fc - fa) * (fc - fb));
    } else {
      // Secant method.
      s = b - fb * ((b - a) / (fb - fa));
    }

    // If necessary, fallback to slow/more-reliable method...
    if (
      (s - (3 * a + b) / 4) * (s - b) >= 0 ||
      (mflag && Math.abs(s - b) >= Math.abs(b - c) / 2) ||
      (!mflag && Math.abs(s - b) >= Math.abs(c - d) / 2) ||
      (mflag && Math.abs(b - c) < Math.abs(tolerance)) ||
      (!mflag && Math.abs(c - d) < Math.abs(tolerance))
    ) {
      // Bisection method.
      s = (a + b) / 2;
      mflag = true;
    } else {
      mflag = false;
    }

    d = c;
    c = b;
    fc = fb;

    const fs = f(s);
    if (fa * fs < 0) {
      b = s;
      fb = fs;
    } else {
      a = s;
      fa = fs;
    }

    if (Math.abs(fa) < Math.abs(fb)) {
      [a, b] = [b, a];
      [fa, fb] = [fb, fa];
    }
  }

  // Could not achieve required tolerance within iteration limit.
  throw new Error(
    "Could not achieve required tolerance within iteration limit.",
  );
}
