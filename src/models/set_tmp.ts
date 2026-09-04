import { two_nodes_gagge } from "../models/two_nodes_gagge.js";
import {
  check_standard_compliance,
  round,
  validateInputs,
} from "../utilities/utilities.js";
import type { ValidationSchema } from "../utilities/utilities.js";

const SET_TMP_SCHEMA = {
  tdb: { type: "number" },
  tr: { type: "number" },
  v: { type: "number" },
  rh: { type: "number" },
  met: { type: "number" },
  clo: { type: "number" },
  wme: { type: "number" },
  body_surface_area: { type: "number" },
  p_atm: { type: "number" },
  position: { enum: ["sitting", "standing"] },
  limit_inputs: { type: "boolean" },
  calculate_ce: { type: "boolean", required: false },
  round: { type: "boolean", required: false },
} satisfies ValidationSchema;

/** Posture accepted by {@link set_tmp}. */
export type BodyPosition = "sitting" | "standing";

/**
 * Optional overrides accepted by {@link set_tmp}.
 *
 * @public
 */
export interface SetTmpKwargs {
  /** Round the result of the SET. Default `true`. */
  round?: boolean;
  /** Select if SET is used to calculate the Cooling Effect. Default `false`. */
  calculate_ce?: boolean;
}

/**
 * Standard Effective Temperature.
 *
 * @public
 */
export interface SetTmpResult {
  /** Standard effective temperature, [°C] */
  set: number;
}

/**
 * Calculates the Standard Effective Temperature (SET). The SET is the
 * temperature of a hypothetical isothermal environment at 50% (rh),
 * <0.1 m/s (20 fpm) average air speed (v), and tr = tdb, in which the
 * total heat loss from the skin of an imaginary occupant wearing
 * clothing, standardized for the activity concerned is the same as
 * that from a person in the actual environment with actual clothing
 * and activity level [10].
 *
 * **SI only.** This model took a `units` parameter until upstream removed it
 * (`f20200c`, "fix(set_tmp): updated function, check type, documentation"),
 * which hard-codes `units="SI"` in its input validation; the signature has
 * carried no unit system since. `cooling_effect` still takes `units`, because
 * upstream's does too. Convert with `units_converter` if you are starting from
 * IP.
 *
 * @param tdb - Dry bulb air temperature, [°C]
 * @param tr - Mean radiant temperature, [°C]
 * @param v - Air speed, [m/s]
 * @param rh - Relative humidity, [%].
 * @param met - Metabolic rate, [W/(m2)]
 * @param clo - Clothing insulation, [clo]
 * @param wme - External work, [W/(m2)], default 0
 * @param body_surface_area - Body surface area, default value 1.8258 [m2]
 * @param p_atm - Atmospheric pressure, default value 101325 [Pa]
 * @param position - Select either "sitting" or "standing". Upstream's
 * parameter name; it was `body_position` here.
 * @param limit_inputs - By default, if the inputs are outside the following
 * limits the function returns NaN. If false returns values regardless of the
 * input values.
 * @param kwargs - Optional overrides; see {@link SetTmpKwargs}
 * @returns set containing results for the model
 *
 * @public
 * @category Models
 *
 * @example
 * const set = set_tmp(25, 25, 0.1, 50, 1.2, 0.5); // returns {set: 24.3}
 */
export function set_tmp(
  tdb: number,
  tr: number,
  v: number,
  rh: number,
  met: number,
  clo: number,
  wme = 0,
  body_surface_area = 1.8258,
  p_atm = 101325,
  position: BodyPosition = "standing",
  limit_inputs = true,
  kwargs: SetTmpKwargs = {},
): SetTmpResult {
  const defaults_kwargs = {
    calculate_ce: false,
    round: true,
  };

  const joint_kwargs = Object.assign(defaults_kwargs, kwargs);

  validateInputs(
    {
      tdb,
      tr,
      v,
      rh,
      met,
      clo,
      wme,
      body_surface_area,
      p_atm,
      position,
      limit_inputs,
      calculate_ce: joint_kwargs.calculate_ce,
      round: joint_kwargs.round,
    },
    SET_TMP_SCHEMA,
  );

  let set_tmp = two_nodes_gagge(
    tdb,
    tr,
    v,
    rh,
    met,
    clo,
    wme,
    body_surface_area,
    p_atm,
    position,
    undefined,
    { round: false, calculate_ce: joint_kwargs.calculate_ce },
  ).set;

  if (limit_inputs) {
    const warnings = check_standard_compliance("ASHRAE", {
      tdb,
      tr,
      v,
      met,
      clo,
    });

    if (warnings.length > 0) {
      set_tmp = NaN;
    }
  }

  if (joint_kwargs.round) {
    set_tmp = round(set_tmp, 1);
  }
  return { set: set_tmp };
}
