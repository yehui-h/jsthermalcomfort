import { t_o } from "../psychrometrics/t_o.js";
import { round } from "./round.js";
// Leaf import on purpose: `reference/limits.js` reaches only `io/quantity.js`,
// which type-imports this module and nothing else at runtime. Importing
// `reference/index.js` here would pull in the models and close a cycle.
import { ashrae55PmvLimits, iso7730PmvLimits } from "../reference/limits.js";
import type { ApplicabilityLimit } from "../reference/limits.js";
// Same leaf, reached directly: `quantities` is where a field name's meaning is
// defined, and both the unit conversion and the range warnings read it there.
import { quantities, quantityFor } from "../io/quantity.js";
import type { QuantityKind } from "../io/quantity.js";

export { round };

/**
 * Converts degrees to radians
 *
 * @param degrees
 *
 * @returns radians
 */
function degrees_to_radians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Converts radians to degree unit
 *
 * @param radians
 *
 * @returns degrees
 */
function radians_to_degrees(radians: number): number {
  return radians * (180 / Math.PI);
}

/**
 * Converts sharp and altittude from radians to degree unit
 * @param sharp
 * @param altitude
 * @returns
 */
export function transpose_sharp_altitude(
  sharp: number,
  altitude: number,
): [number, number] {
  const altitude_new = radians_to_degrees(
    Math.asin(
      Math.sin(degrees_to_radians(Math.abs(sharp - 90))) *
        Math.cos(degrees_to_radians(altitude)),
    ),
  );
  sharp = radians_to_degrees(
    Math.atan(
      Math.sin(degrees_to_radians(sharp)) *
        Math.tan(degrees_to_radians(90 - altitude)),
    ),
  );
  return [round(sharp, 3), round(altitude_new, 3)];
}

/**
 * Inputs accepted by {@link check_standard_compliance}. Every field is optional:
 * each standard inspects only the ones it constrains.
 */
export interface ComplianceKwargs {
  met?: number;
  clo?: number;
  tdb?: number;
  tr?: number;
  v?: number;
  vr?: number;
  v_limited?: number;
  rh?: number;
  /** partial water-vapour pressure, [kPa] — read by the ISO 7933 branches */
  p_a?: number;
  airspeed_control?: boolean;
}

/**
 * Standard names accepted by {@link check_standard_compliance}.
 */
export const Standard = Object.freeze({
  ANKLE_DRAFT: "ANKLE_DRAFT",
  ASHRAE: "ASHRAE",
  FAN_HEATWAVES: "FAN_HEATWAVES",
  ISO: "ISO",
  ISO_7933_2004: "7933-2004",
  ISO_7933_2023: "7933-2023",
} as const);

/** One of the standard identifiers listed in {@link Standard}. */
export type Standard = (typeof Standard)[keyof typeof Standard];

/**
 * Check that the values comply with the standard provided
 *
 * @param standard
 * @param kwargs
 *
 * @returns strings with warnings emitted
 */
export function check_standard_compliance(
  standard: Standard,
  kwargs: ComplianceKwargs,
): string[] {
  switch (standard) {
    case Standard.ANKLE_DRAFT:
      return _ankle_draft_compliance(kwargs);
    case Standard.ASHRAE:
      return _ashrae_compliance(kwargs);
    case Standard.FAN_HEATWAVES:
      return _fan_heatwaves_compliance(kwargs);
    case Standard.ISO:
      return _iso_compliance(kwargs);
    case Standard.ISO_7933_2004:
      return _iso7933_2004_compliance(kwargs);
    case Standard.ISO_7933_2023:
      return _iso7933_2023_compliance(kwargs);
    default:
      throw new Error("Unknown standard");
  }
}

/**
 * @param {ComplianceKwargs} kwargs
 *
 * @returns {string[]} strings with warnings emitted
 */
function _ankle_draft_compliance(kwargs: ComplianceKwargs): string[] {
  const warnings: string[] = [];
  for (const [key, value] of Object.entries(kwargs)) {
    // Only numeric fields are range-checked here; `airspeed_control` is a
    // boolean and is handled by the cross-field checks below.
    if (typeof value !== "number") continue;
    if (key === "met" && value > 1.3)
      warnings.push("The ankle draft model is only valid for met <= 1.3");
    if (key === "clo" && value > 0.7)
      warnings.push("The ankle draft model is only valid for clo <= 0.7");
  }
  return warnings;
}

/**
 * Warns for every argument that falls outside its row in `limits`.
 *
 * The arguments are iterated, not the table: the caller's key order is what
 * decides the order of the returned messages, and `tests/baseline.test.ts`
 * compares those arrays positionally.
 */
function _range_warnings(
  kwargs: ComplianceKwargs,
  limits: readonly ApplicabilityLimit[],
): string[] {
  const warnings: string[] = [];
  for (const [key, value] of Object.entries(kwargs)) {
    // Only numeric fields are range-checked here; `airspeed_control` is a
    // boolean and is handled by the cross-field checks in the callers.
    if (typeof value !== "number") continue;
    // Matched by identity, not by spelling: the field name resolves to the one
    // `Quantity` object the table rows also point at, so the two can never
    // drift apart the way two copies of a string can.
    const quantity = quantityFor(key);
    const limit = limits.find((row) => row.quantity === quantity);
    if (limit === undefined) continue;
    if (value < limit.min || value > limit.max) warnings.push(limit.warning);
  }
  return warnings;
}

/**
 * @param kwargs
 *
 * @returns strings with warnings emitted
 */
function _ashrae_compliance(kwargs: ComplianceKwargs): string[] {
  // Not a range check: `v_limited` throws rather than warns, so it has no row.
  if (typeof kwargs.v_limited === "number" && kwargs.v_limited > 0.2)
    throw new Error(
      "This equation is only applicable for air speed lower than 0.2 m/s",
    );

  const warnings = _range_warnings(kwargs, ashrae55PmvLimits);

  // Cross-field check (ASHRAE 55 table 7.3.4): when the occupant cannot
  // control the airspeed, v has additional upper limits that depend on the
  // operative temperature, clo and met.
  if (
    kwargs.airspeed_control === false &&
    kwargs.v !== undefined &&
    kwargs.met !== undefined &&
    kwargs.clo !== undefined &&
    kwargs.tdb !== undefined &&
    kwargs.tr !== undefined
  ) {
    const v = kwargs.v;
    const met = kwargs.met;
    const clo = kwargs.clo;
    const to = t_o(kwargs.tdb, kwargs.tr, v);
    const v_limit = 50.49 - 4.4047 * to + 0.096425 * to * to;
    const violates =
      (v > 0.8 && clo < 0.7 && met < 1.3) ||
      (to > 23 && to < 25.5 && v > v_limit && clo < 0.7 && met < 1.3) ||
      (to <= 23 && v > 0.2 && clo < 0.7 && met < 1.3);
    if (violates)
      warnings.push(
        "ASHRAE air speed applicability limits when the occupant does not control the airspeed",
      );
  }

  return warnings;
}

/**
 * @param {ComplianceKwargs} kwargs
 *
 * @returns {string[]} strings with warnings emitted
 */
function _fan_heatwaves_compliance(kwargs: ComplianceKwargs): string[] {
  const warnings: string[] = [];
  for (const [key, value] of Object.entries(kwargs)) {
    // Only numeric fields are range-checked here; `airspeed_control` is a
    // boolean and is handled by the cross-field checks below.
    if (typeof value !== "number") continue;
    switch (key) {
      case "tdb":
      case "tr": {
        const parameter = key === "tdb" ? "dry-bulb" : "mean radiant";
        if (value > 50 || value < 20)
          warnings.push(
            `Fan use during heatwaves ${parameter} temperature applicability limits between 20 and 50 ºC`,
          );
        break;
      }
      case "v":
        if (value > 4.5 || value < 0.1)
          warnings.push(
            "Fan use during heatwaves air speed applicability limits between 0.1 and 4.5 m/s",
          );
        break;
      case "rh":
        if (value > 100 || value < 0)
          warnings.push(
            "Fan use during heatwaves rh applicability limits between 0 and 100 %",
          );
        break;
      case "met":
        if (value > 2 || value < 0.7)
          warnings.push(
            "Fan use during heatwaves met applicability limits between 0.7 and 2 met",
          );
        break;
      case "clo":
        if (value > 1 || value < 0)
          warnings.push(
            "Fan use during heatwaves clo applicability limits between 0 and 1 clo",
          );
        break;
    }
  }
  return warnings;
}

/**
 * @param kwargs
 *
 * @returns strings with warnings emitted
 */
function _iso_compliance(kwargs: ComplianceKwargs): string[] {
  // Every bound and every message lives in `iso7730PmvLimits`, including the
  // met row whose lower bound is 0 while its message says 0.8 — that
  // discrepancy is documented there.
  return _range_warnings(kwargs, iso7730PmvLimits);
}

/**
 * @param {ComplianceKwargs} kwargs
 *
 * @returns {string[]} strings with warnings emitted
 */
function _iso7933_2004_compliance(kwargs: ComplianceKwargs): string[] {
  // based on ISO 7933:2004 Annex A
  if (
    kwargs.tdb === undefined ||
    kwargs.p_a === undefined ||
    kwargs.tr === undefined ||
    kwargs.v === undefined ||
    kwargs.met === undefined ||
    kwargs.clo === undefined
  ) {
    throw new Error(
      `Missing arguments for ISO 7933:2004 compliance check, got: ${kwargs} and requires tdb, p_a, tr, v, met and clo`,
    );
  }
  /** @type {string[]} */
  const warnings = [];

  if (kwargs.tdb > 50 || kwargs.tdb < 15)
    warnings.push(
      "ISO 7933:2004 air temperature applicability limits between 15 and 50 ºC",
    );
  if (kwargs.p_a > 4.5 || kwargs.p_a < 0)
    warnings.push(
      "ISO 7933:2004 p_a applicability limits between 0 and 4.5 kPa",
    );
  if (kwargs.tr > 60 || kwargs.tr < 0)
    warnings.push("ISO 7933:2004 tr applicability limits between 0 and 60 ºC");
  if (kwargs.v > 3 || kwargs.v < 0)
    warnings.push(
      "ISO 7933:2004 air speed applicability limits between 0 and 3 m/s",
    );
  if (kwargs.met > 450 || kwargs.met < 100)
    warnings.push(
      "ISO 7933:2004 met applicability limits between 100 and 450 met",
    );
  if (kwargs.clo > 1 || kwargs.clo < 0.1)
    warnings.push(
      "ISO 7933:2004 clo applicability limits between 0.1 and 1 clo",
    );
  return warnings;
}

function _iso7933_2023_compliance(kwargs: ComplianceKwargs): string[] {
  // based on ISO 7933:2023 Annex A
  if (
    kwargs.tdb === undefined ||
    kwargs.p_a === undefined ||
    kwargs.tr === undefined ||
    kwargs.v === undefined ||
    kwargs.met === undefined ||
    kwargs.clo === undefined
  ) {
    throw new Error(
      `Missing arguments for ISO 7933:2023 compliance check, got: ${kwargs} and requires tdb, p_a, tr, v, met and clo`,
    );
  }
  /** @type {string[]} */
  const warnings = [];

  if (kwargs.tdb > 50 || kwargs.tdb < 15)
    warnings.push(
      "ISO 7933:2023 air temperature applicability limits between 15 and 50 ºC",
    );
  if (kwargs.p_a > 4.5 || kwargs.p_a < 0.5)
    warnings.push(
      "ISO 7933:2023 p_a applicability limits between 0.5 and 4.5 kPa",
    );
  if (kwargs.tr > 60 || kwargs.tr < 0)
    warnings.push("ISO 7933:2023 tr applicability limits between 0 and 60 ºC");
  if (kwargs.v > 3 || kwargs.v < 0)
    warnings.push(
      "ISO 7933:2023 air speed applicability limits between 0 and 3 m/s",
    );
  if (kwargs.met > 450 || kwargs.met < 100)
    warnings.push(
      "ISO 7933:2023 met applicability limits between 100 and 450 met",
    );
  if (kwargs.clo > 1 || kwargs.clo < 0.1)
    warnings.push(
      "ISO 7933:2023 clo applicability limits between 0.1 and 1 clo",
    );
  return warnings;
}

/** Formulae available to {@link body_surface_area}. */
export type BodySurfaceAreaFormula =
  "dubois" | "takahira" | "fujimoto" | "kurazumi";

/**
 * Returns the body surface area in square meters
 *
 * @public
 * @category Utilities
 *
 * @param weight - body weight, [kg]
 * @param height - height, [m]
 * @param [formula="dubois"] - formula used to calculate the body surface area. default="dubois"
 * @returns body surface area, [m2]
 *
 * @category Utilities
 */
export function body_surface_area(
  weight: number,
  height: number,
  formula: BodySurfaceAreaFormula = "dubois",
): number {
  if (formula === "dubois")
    return 0.202 * Math.pow(weight, 0.425) * Math.pow(height, 0.725);
  if (formula === "takahira")
    return 0.2042 * Math.pow(weight, 0.425) * Math.pow(height, 0.725);
  if (formula === "fujimoto")
    return 0.1882 * Math.pow(weight, 0.444) * Math.pow(height, 0.663);
  if (formula === "kurazumi")
    return 0.244 * Math.pow(weight, 0.383) * Math.pow(height, 0.693);

  throw new Error(
    `This ${formula} to calculate the body_surface_area does not exists.`,
  );
}

/**
 * Estimates the relative air speed which combines the average air speed of the
 * space plus the relative air speed caused by the body movement. Vag is assumed
 * to be 0 for metabolic rates equal and lower than 1 met and otherwise equal to
 * Vag = 0.3 (M - 1) (m/s)
 *
 * @public
 * @category Utilities
 *
 * @param v - air spped measured by the sensor, [m/s]
 * @param met - metabolic rate, [met]
 * @returns relative air speed, [m/s]
 */
export function v_relative(v: number, met: number): number {
  if (met <= 1) return v;
  return _v_relative_single(v, met);
}

/**
 * Not `round(x, 3)` from `./round.js`: this adds `Number.EPSILON` before
 * scaling, which nudges a value sitting exactly on a .0005 boundary up rather
 * than letting the binary representation decide. The two disagree on those
 * boundaries and `tests/baseline.test.ts` pins this one, so it stays.
 */
function _v_relative_single(v: number, met: number): number {
  return Math.round((v + 0.3 * (met - 1) + Number.EPSILON) * 1000) / 1000;
}

/** Standards for which a dynamic clothing correction is defined. */
export type ClothingStandard = "ASHRAE" | "ISO";

/**
 * Estimates the dynamic clothing insulation of a moving occupant. The activity as
 * well as the air speed modify the insulation characteristics of the clothing and the
 * adjacent air layer. Consequently, the ISO 7730 states that the clothing insulation
 * shall be corrected [2]. The ASHRAE 55 Standard corrects for the effect
 * of the body movement for met equal or higher than 1.2 met using the equation
 * clo = Icl × (0.6 + 0.4/met)
 *
 * @public
 * @category Utilities
 *
 * @param clo - clothing insulation, [clo]
 * @param met - metabolic rate, [met]
 * @param [standard="ASHRAE"] - If "ASHRAE", uses Equation provided in Section 5.2.2.2 of ASHRAE 55 2020
 * @returns dunamic clothing insulation, [clo]
 */
export function clo_dynamic(
  clo: number,
  met: number,
  standard: ClothingStandard = "ASHRAE",
): number {
  if (standard !== "ASHRAE" && standard !== "ISO")
    throw new Error(
      "only the ISO 7730 and ASHRAE 55 2020 models have been implemented",
    );
  if ((standard === "ASHRAE" && met <= 1.2) || (standard === "ISO" && met <= 1))
    return clo;
  return _clo_dynamic_single(clo, met);
}

/** Same `Number.EPSILON` rounding as `_v_relative_single`, and same reason. */
function _clo_dynamic_single(clo: number, met: number): number {
  return Math.round((clo * (0.6 + 0.4 / met) + Number.EPSILON) * 1000) / 1000;
}

/**
 * The unit systems the library accepts.
 *
 * One definition with two readers: {@link UnitSystem} is derived from it, and
 * every model's `units: { enum: … }` validation rule points at it rather than
 * repeating the pair. Widening the union and forgetting a schema is therefore
 * not a thing that can happen.
 *
 * @public
 */
export const UNIT_SYSTEMS = ["SI", "IP"] as const;

/** Unit system selector used across the library. */
export type UnitSystem = (typeof UNIT_SYSTEMS)[number];

/** One quantity's two-way conversion between the unit systems. */
interface Conversion {
  readonly ipToSi: (value: number) => number;
  readonly siToIp: (value: number) => number;
}

/**
 * The formulae are written character for character as they were before:
 * `tests/baseline.test.ts` pins `units_converter`'s output byte for byte, so
 * the evaluation order inside each expression is part of the contract, not a
 * style choice.
 */
const TEMPERATURE: Conversion = {
  ipToSi: (temp) => ((temp - 32) * 5) / 9,
  siToIp: (temp) => (temp * 9) / 5 + 32,
};
const AIR_SPEED: Conversion = {
  ipToSi: (vel) => vel / 3.281,
  siToIp: (vel) => vel * 3.281,
};
const AREA: Conversion = {
  ipToSi: (area) => area / 10.764,
  siToIp: (area) => area * 10.764,
};
const PRESSURE: Conversion = {
  ipToSi: (pressure) => pressure * 101325,
  siToIp: (pressure) => pressure / 101325,
};

/**
 * How each kind of quantity converts. A kind absent from here reads the same in
 * both systems — `percentage`, `metabolicRate`, `clothingInsulation` and
 * `thermalSensation` are all dimensionless or already system-independent, which
 * is exactly what their equal `siUnit`/`ipUnit` in `quantities` says.
 */
const BY_KIND: Partial<Record<QuantityKind, Conversion>> = {
  temperature: TEMPERATURE,
  airSpeed: AIR_SPEED,
};

/**
 * Fields that are not quantities in their own right: `set_tmp`'s two optional
 * kwargs and its result temperature, plus `vel` as a spelling of air speed that
 * predates the quantity table.
 */
const BY_FIELD: Readonly<Record<string, Conversion>> = {
  area: AREA,
  pressure: PRESSURE,
  tmp: TEMPERATURE,
  vel: AIR_SPEED,
};

/**
 * The conversion a field name calls for, or `undefined` when the value reads
 * the same in both systems.
 *
 * Model parameter and result names resolve through `quantities`, so there is
 * one definition of what each field measures and no second spelling to keep in
 * step — passing `t_running_mean` under its own name converts it, where the
 * previous substring test only recognised it if the caller respelled it
 * `tmp_running_mean` first.
 */
function conversionFor(field: string): Conversion | undefined {
  const quantity = quantityFor(field);
  if (quantity !== undefined) return BY_KIND[quantity.kind];
  // The comfort-temperature bounds (`tmp_cmf_80_low`, `tmp_cmf_cat_i_up`, …)
  // are `tmp_cmf` carrying a band qualifier, so they convert with it.
  if (field.startsWith("tmp_cmf")) return BY_KIND[quantities.tmp_cmf.kind];
  return BY_FIELD[field];
}

/**
 * Converts IP values to SI units
 *
 * @param kwargs - [t, v] units to convert
 * @param from_units - specify system to convert from
 * @returns converted values in SI units
 *
 * @category Utilities
 * @public
 */
export function units_converter<T extends Record<string, number>>(
  kwargs: T,
  from_units: UnitSystem = "IP",
): T {
  // Unreachable from TypeScript, but `units_converter` is called from untyped
  // JavaScript too, so the runtime guard stays.
  if (from_units !== "IP" && from_units !== "SI")
    throw new Error(`Unknown system ${from_units}`);

  const direction = from_units === "IP" ? "ipToSi" : "siToIp";
  const result: Record<string, number> = { ...kwargs };
  for (const [field, value] of Object.entries(result)) {
    const conversion = conversionFor(field);
    if (conversion !== undefined) result[field] = conversion[direction](value);
  }
  return result as T;
}

// FIXME: find how to write math notation inside JSDocs

/**
 * Estimates the running mean temperature also known as prevailing mean outdoor temperature
 *
 * @public
 * @category Utilities
 *
 * @param temp_array - array containing the mean daily temperature in descending order (i.e. from
 * newest/yestedayr to oldest) :math:`[t_{day-1}, t_{day-2}, ... , t_{day-n}]`,
 * Where :math:`t_{day-1}` is yesterday's daily mean temperature. The EN
 * 16798-1 2019 [3] states that n should be equal to 7
 *
 * @param [alpha=0.8] - constant between 0 and 1. The EN 16798-1 2019 [3] recommends a value of 0.8,
 * while the ASHRAE 55 2020 recommends to choose values between 0.9 and 0.6,
 * corresponding to a slow- and fast- response running mean, respectively.
 * Adaptive comfort theory suggest that a slow-response running mean (alpha = 0.9)
 * could be more appropriate for climates in which synoptic-scale (day-to-day)
 * temperature dynamics are relatively minor, sich as the humid tropics.
 *
 * @param [units="SI"] - select the SI (International System of Units) or the IP (Imperial Units) system.
 *
 * @returns running mean outdoor temperature
 */
export function running_mean_outdoor_temperature(
  temp_array: number[],
  alpha = 0.8,
  units: UnitSystem = "SI",
): number {
  if (units === "IP")
    temp_array = temp_array.map((tdb) => units_converter({ tdb }).tdb);

  const coeff = temp_array.map((_tdb, index) => Math.pow(alpha, index));
  const summ_t_rm = temp_array.reduce(
    (acum, curr, index) => acum + curr * coeff[index]!,
  );
  const summ_coeff = coeff.reduce((acum, curr) => acum + curr);
  let t_rm = summ_t_rm / summ_coeff;
  if (units === "IP") t_rm = units_converter({ tmp: t_rm }, "SI").tmp;

  return Math.round(t_rm * 10 + Number.EPSILON) / 10;
}

/**
 * Calculates the sky-vault view fraction
 *
 * @public
 * @category Utilities
 *
 * @param w - width of the window, [m]
 * @param h - height of the window, [m]
 * @param d - distance between the occupant and the window, [m]
 *
 * @returns sky-vault view faction ranges between 0 and 1
 */
export function f_svv(w: number, h: number, d: number): number {
  const h_degrees = Math.atan(h / (2 * d)) * (180 / Math.PI);
  const w_degrees = Math.atan(w / (2 * d)) * (180 / Math.PI);
  return (h_degrees * w_degrees) / 16200;
}

/**
 * Filter values based on a valid range (It turns the filtered values to NaNs)
 *
 * @param [range] - the range to limit
 * @param valid - the [min, max] to constrian the range to
 * @returns the constrained range with NaNs for values that are outside the min, max range
 */
export function valid_range(
  range: number[] | undefined,
  [min, max]: [number, number],
): number[] {
  if (range === undefined) return [];
  return range.map((n) => (n >= min && n <= max ? n : NaN));
}

/**
 * Met values of typical tasks.
 *
 * @public
 * @category Reference values
 *
 * @example
 * import { met_typical_tasks } from "jsthermalcomfort/utilities"; //The path to utilities
 * console.log(met_typical_tasks['Seated_Cquiet']);
 * // output 1.0
 */
export const met_typical_tasks = {
  Sleeping: 0.7,
  Reclining: 0.8,
  Seated_Cquiet: 1.0,
  Reading_seated: 1.0,
  Writing: 1.0,
  Typing: 1.1,
  Standing_relaxed: 1.2,
  Filing_seated: 1.2,
  Flying_aircraft_routine: 1.2,
  Filing_standing: 1.4,
  Driving_a_car: 1.5,
  Walking_about: 1.7,
  Cooking: 1.8,
  Table_sawing: 1.8,
  Walking_2mph_3_2kmh: 2.0,
  Lifting_packing: 2.1,
  Seated_heavy_limb_movement: 2.2,
  Light_machine_work: 2.2,
  Flying_aircraft_combat: 2.4,
  Walking_3mph_4_8kmh: 2.6,
  House_cleaning: 2.7,
  Driving_heavy_vehicle: 3.2,
  Dancing: 3.4,
  Calisthenics: 3.5,
  Walking_4mph_6_4kmh: 3.8,
  Tennis: 3.8,
  Heavy_machine_work: 4.0,
  Handling_100lb_45_kg_bags: 4.0,
  Pick_and_shovel_work: 4.4,
  Basketball: 6.3,
  Wrestling: 7.8,
};

/** Ensembles recognised by {@link clo_typical_ensembles}. */
export type ClothingEnsemble =
  | "Walking shorts, short-sleeve shirt"
  | "Typical summer indoor clothing"
  | "Knee-length skirt, short-sleeve shirt, sandals, underwear"
  | "Trousers, short-sleeve shirt, socks, shoes, underwear"
  | "Trousers, long-sleeve shirt"
  | "Knee-length skirt, long-sleeve shirt, full slip"
  | "Sweat pants, long-sleeve sweatshirt"
  | "Jacket, Trousers, long-sleeve shirt"
  | "Typical winter indoor clothing";

/**
 * Total Clothing insulation of typical ensembles
 *
 * @param ensembles - Typical ensembles. One of:
 *   - "Walking shorts, short-sleeve shirt"
 *   - "Typical summer indoor clothing"
 *   - "Knee-length skirt, short-sleeve shirt, sandals, underwear"
 *   - "Trousers, short-sleeve shirt, socks, shoes, underwear"
 *   - "Trousers, long-sleeve shirt"
 *   - "Knee-length skirt, long-sleeve shirt, full slip"
 *   - "Sweat pants, long-sleeve sweatshirt"
 *   - "Jacket, Trousers, long-sleeve shirt"
 *   - "Typical winter indoor clothing"
 * @returns Clothing insulation of the given ensembles
 *
 * @public
 * @category Reference values
 *
 * @example
 * const result = clo_typical_ensembles("Trousers, long-sleeve shirt"); // returns 0.61
 */
export function clo_typical_ensembles(ensembles: ClothingEnsemble): number {
  switch (ensembles) {
    case "Walking shorts, short-sleeve shirt":
      return 0.36;
    case "Typical summer indoor clothing":
      return 0.5;
    case "Knee-length skirt, short-sleeve shirt, sandals, underwear":
      return 0.54;
    case "Trousers, short-sleeve shirt, socks, shoes, underwear":
      return 0.57;
    case "Trousers, long-sleeve shirt":
      return 0.61;
    case "Knee-length skirt, long-sleeve shirt, full slip":
      return 0.67;
    case "Sweat pants, long-sleeve sweatshirt":
      return 0.74;
    case "Jacket, Trousers, long-sleeve shirt":
      return 0.96;
    case "Typical winter indoor clothing":
      return 1.0;
    default:
      throw new Error("No such ensemble");
  }
}

/**
 * Clo values of individual clothing elements. To calculate the total clothing insulation you need to add these values together.
 *
 * @public
 * @category Reference values
 *
 * @example
 * import { clo_individual_garments } from "jsthermalcomfort/utilities"; //The path to utilities
 * console.log(clo_individual_garments['Metal_chair']);
 * // output 0.0
 */
export const clo_individual_garments = {
  Metal_chair: 0.0,
  Bra: 0.01,
  Wooden_stool: 0.01,
  Ankle_socks: 0.02,
  Shoes_or_sandals: 0.02,
  Slippers: 0.03,
  Panty_hose: 0.02,
  Calf_length_socks: 0.03,
  Women_underwear: 0.03,
  Men_underwear: 0.04,
  Knee_socks_thick: 0.06,
  Short_shorts: 0.06,
  Walking_shorts: 0.08,
  T_shirt: 0.08,
  Standard_office_chair: 0.1,
  Executive_chair: 0.15,
  Boots: 0.1,
  Sleeveless_scoop_neck_blouse: 0.12,
  Half_slip: 0.14,
  Long_underwear_bottoms: 0.15,
  Full_slip: 0.16,
  Short_sleeve_knit_shirt: 0.17,
  Sleeveless_vest_thin: 0.1,
  Sleeveless_vest_thick: 0.17,
  Sleeveless_short_gown_thin: 0.18,
  Short_sleeve_dress_shirt: 0.19,
  Sleeveless_long_gown_thin: 0.2,
  Long_underwear_top: 0.2,
  Thick_skirt: 0.23,
  Long_sleeve_dress_shirt: 0.25,
  Long_sleeve_flannel_shirt: 0.34,
  Long_sleeve_sweat_shirt: 0.34,
  Short_sleeve_hospital_gown: 0.31,
  Short_sleeve_short_robe_thin: 0.34,
  Short_sleeve_pajamas: 0.42,
  Long_sleeve_long_gown: 0.46,
  Long_sleeve_short_wrap_robe_thick: 0.48,
  Long_sleeve_pajamas_thick: 0.57,
  Long_sleeve_long_wrap_robe_thick: 0.69,
  Thin_trousers: 0.15,
  Thick_trousers: 0.24,
  Sweatpants: 0.28,
  Overalls: 0.3,
  Coveralls: 0.49,
  Thin_skirt: 0.14,
  Long_sleeve_shirt_dress_thin: 0.33,
  Long_sleeve_shirt_dress_thick: 0.47,
  Short_sleeve_shirt_dress: 0.29,
  Sleeveless_scoop_neck_shirt_thin: 0.23,
  Sleeveless_scoop_neck_shirt_thick: 0.27,
  Long_sleeve_shirt_thin: 0.25,
  Long_sleeve_shirt_thick: 0.36,
  Single_breasted_coat_thin: 0.36,
  Single_breasted_coat_thick: 0.44,
  Double_breasted_coat_thin: 0.42,
  Double_breasted_coat_thick: 0.48,
};

/**
 * A validation rule for a single parameter in `validateInputs`.
 */
export interface ValidationRule {
  type?: "number" | "boolean";
  enum?: readonly unknown[];
  required?: boolean;
}

/** Schema mapping parameter names to their {@link ValidationRule}. */
export type ValidationSchema = Record<string, ValidationRule>;

/**
 * Asserts that a value is a valid number (not NaN).
 * Throws a TypeError if the value is not a number or is NaN.
 *
 * @param value - the value to check
 * @param name - the parameter name, used in the error message
 * @throws {TypeError} if value is not a number or is NaN
 */
export const assertNumber = (value: unknown, name: string): void => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`Parameter "${name}" must be a valid finite number`);
  }
};

/**
 * Validates model input parameters against a schema.
 *
 * @param params - The input parameters as key-value pairs
 * @param schema - Validation rules per parameter:
 *   - `type: "number"`  — calls assertNumber (throws TypeError if invalid)
 *   - `type: "boolean"` — throws TypeError if value is not a boolean
 *   - `enum: [...]`     — throws Error if value not in the list
 *   - `required: false` — skips validation when value is undefined
 * @throws {TypeError} if a numeric or boolean parameter has an invalid type
 * @throws {Error} if an enum parameter has an invalid value
 *
 * @example
 * validateInputs(
 *   { tdb, tr, units },
 *   {
 *     tdb:   { type: "number" },
 *     tr:    { type: "number" },
 *     units: { enum: UNIT_SYSTEMS },
 *   }
 * );
 */
export const validateInputs = <
  T extends Record<string, unknown>,
  S extends Record<keyof T, ValidationRule>,
>(
  params: T,
  // Keyed to what was actually passed, in both directions: a parameter with no
  // rule is a compile error, and so is a rule for a parameter that is not there
  // — the `never` makes the extra key unsatisfiable. Before this, the first
  // silently skipped validation and the second threw "must be a valid finite
  // number" against `undefined` at run time.
  schema: S & Record<Exclude<keyof S, keyof T>, never>,
): void => {
  for (const [key, rules] of Object.entries(schema) as [
    string,
    ValidationRule | undefined,
  ][]) {
    if (rules === undefined) continue;
    const value = params[key];
    if (rules.required === false && value === undefined) continue;
    if (rules.type === "number") {
      assertNumber(value, key);
    }
    if (rules.type === "boolean") {
      if (typeof value !== "boolean") {
        throw new TypeError(`Parameter "${key}" must be a boolean`);
      }
    }
    if (rules.enum !== undefined) {
      if (!rules.enum.includes(value)) {
        throw new Error(
          `"${key}" must be one of: ${rules.enum.map((v) => `'${v}'`).join(", ")}`,
        );
      }
    }
  }
};
