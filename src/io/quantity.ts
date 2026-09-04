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
  | "thermalSensation"
  | "pressure"
  | "humidityRatio";

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
 * Pins each entry's {@link Quantity.key} to the name it is filed under.
 *
 * `key` is the only link between this table and the model field it describes:
 * {@link quantityFor} and the applicability tables in `src/reference/limits.ts`
 * match on it, and a wrong one unhooks a quantity silently — no warning fires
 * and no unit converts. The self-referential constraint turns that into a
 * compile error. (It also widens `siUnit` and friends from their literals back
 * to `string`; nothing reads those as types, and a legible error is worth
 * more.)
 */
const table = <
  const T extends { readonly [K in keyof T]: Quantity & { readonly key: K } },
>(
  entries: T,
): T => entries;

/**
 * Every quantity the models in this package take or return.
 *
 * Keys match the model parameter and result names exactly, so a consumer can
 * look one up from a field name it already has with {@link quantityFor}.
 *
 * @public
 */
export const quantities = table({
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
  operative_tmp: {
    key: "operative_tmp",
    kind: "temperature",
    label: "Operative temperature",
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
  hr: {
    key: "hr",
    kind: "humidityRatio",
    label: "Humidity ratio",
    siUnit: "kg/kg",
    ipUnit: "kg/kg",
  },
  dew_point_tmp: {
    key: "dew_point_tmp",
    kind: "temperature",
    label: "Dew-point temperature",
    siUnit: "°C",
    ipUnit: "°F",
  },
  wet_bulb_tmp: {
    key: "wet_bulb_tmp",
    kind: "temperature",
    label: "Wet-bulb temperature",
    siUnit: "°C",
    ipUnit: "°F",
  },
  p_vap: {
    key: "p_vap",
    kind: "pressure",
    label: "Water vapour partial pressure",
    siUnit: "Pa",
    ipUnit: "Pa",
  },
  p_atm: {
    key: "p_atm",
    kind: "pressure",
    label: "Atmospheric pressure",
    // Pascals, because that is what `psy_ta_rh`, `set_tmp` and
    // `psychrometricZone` take. `units_converter`'s only pressure branch
    // converts atm to Pa, which is not an IP/SI pair at all, so there is no IP
    // spelling to align with. Equal units mean the quantity does not convert,
    // exactly as for met and clo.
    siUnit: "Pa",
    ipUnit: "Pa",
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
});

/** Widened view of {@link quantities}, so a runtime field name can index it. */
const byName: Readonly<Record<string, Quantity>> = quantities;

/**
 * The quantity a model parameter or result field names, or `undefined` when the
 * name belongs to none.
 *
 * The lookup {@link quantities}' own documentation promises: consumers, and the
 * unit conversion in `units_converter`, resolve a field name here rather than
 * keeping a second list of which names mean what.
 *
 * @public
 */
export function quantityFor(name: string): Quantity | undefined {
  return byName[name];
}

/**
 * The unit a quantity is expressed in under a given unit system.
 *
 * @public
 */
export function unitFor(quantity: Quantity, units: UnitSystem): string {
  return units === "IP" ? quantity.ipUnit : quantity.siUnit;
}
