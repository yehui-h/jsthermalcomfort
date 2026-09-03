import type { UnitSystem } from "../utilities/utilities.js";

/**
 * What a quantity measures.
 *
 * Consumers switch on this to choose a formatter, an axis or a colour ramp
 * without hard-coding the individual keys.
 *
 * @public
 */
export type QuantityKind =
  | "temperature"
  | "airSpeed"
  | "percentage"
  | "metabolicRate"
  | "clothingInsulation"
  | "thermalSensation";

/**
 * A physical quantity: what a number *is*, independent of any one result.
 *
 * Both unit spellings are carried because the model functions accept and
 * return either system; which one applies to a given number is decided at
 * evaluation time and pinned on the {@link Measure}.
 *
 * @public
 */
export interface Quantity {
  /** The name this quantity has in the model signatures, e.g. `"tdb"`. */
  readonly key: string;
  readonly kind: QuantityKind;
  /** Human-readable name, e.g. `"Dry-bulb air temperature"`. */
  readonly label: string;
  /** Unit under `units: 'SI'`. Empty for a dimensionless quantity. */
  readonly siUnit: string;
  /** Unit under `units: 'IP'`. Equal to {@link Quantity.siUnit} when the quantity does not convert. */
  readonly ipUnit: string;
}

/**
 * Every quantity the models in this package take or return.
 *
 * Keys match the model parameter and result names exactly, so a consumer can
 * look one up from a field name it already has.
 *
 * @public
 */
export const quantities = {
  tdb: {
    key: "tdb",
    kind: "temperature",
    label: "Dry-bulb air temperature",
    siUnit: "°C",
    ipUnit: "°F",
  },
  tr: {
    key: "tr",
    kind: "temperature",
    label: "Mean radiant temperature",
    siUnit: "°C",
    ipUnit: "°F",
  },
  v: {
    key: "v",
    kind: "airSpeed",
    label: "Air speed",
    siUnit: "m/s",
    ipUnit: "fps",
  },
  vr: {
    key: "vr",
    kind: "airSpeed",
    label: "Relative air speed",
    siUnit: "m/s",
    ipUnit: "fps",
  },
  rh: {
    key: "rh",
    kind: "percentage",
    label: "Relative humidity",
    siUnit: "%",
    ipUnit: "%",
  },
  met: {
    key: "met",
    kind: "metabolicRate",
    label: "Metabolic rate",
    siUnit: "met",
    ipUnit: "met",
  },
  clo: {
    key: "clo",
    kind: "clothingInsulation",
    label: "Clothing insulation",
    siUnit: "clo",
    ipUnit: "clo",
  },
  wme: {
    key: "wme",
    kind: "metabolicRate",
    label: "External work",
    siUnit: "met",
    ipUnit: "met",
  },
  t_running_mean: {
    key: "t_running_mean",
    kind: "temperature",
    label: "Running mean outdoor temperature",
    siUnit: "°C",
    ipUnit: "°F",
  },
  pmv: {
    key: "pmv",
    kind: "thermalSensation",
    label: "Predicted Mean Vote",
    siUnit: "",
    ipUnit: "",
  },
  ppd: {
    key: "ppd",
    kind: "percentage",
    label: "Predicted Percentage of Dissatisfied",
    siUnit: "%",
    ipUnit: "%",
  },
  tmp_cmf: {
    key: "tmp_cmf",
    kind: "temperature",
    label: "Comfort temperature",
    siUnit: "°C",
    ipUnit: "°F",
  },
} as const satisfies Record<string, Quantity>;

/**
 * The unit a quantity is expressed in under a given unit system.
 *
 * @public
 */
export function unitFor(quantity: Quantity, units: UnitSystem): string {
  return units === "IP" ? quantity.ipUnit : quantity.siUnit;
}
