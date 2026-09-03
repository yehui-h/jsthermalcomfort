import { validateInputs } from "../utilities/utilities.js";
import type { UnitSystem, ValidationSchema } from "../utilities/utilities.js";

/**
 * Options every model in this package accepts.
 *
 * @public
 */
export interface BaseInputsInit {
  /** Unit system. Case-insensitive; normalised to upper case. Default `'SI'`. */
  units?: UnitSystem | Lowercase<UnitSystem> | undefined;
  /** Return NaN outside the standard's applicability limits. Default `true`. */
  limit_inputs?: boolean | undefined;
  /** Round the returned values. Default `true`. */
  round_output?: boolean | undefined;
}

const BASE_SCHEMA = {
  units: { enum: ["SI", "IP"] },
  limit_inputs: { type: "boolean" },
  round_output: { type: "boolean" },
} satisfies ValidationSchema;

/**
 * The options shared by every model: unit system and the two output switches.
 *
 * Mirrors `BaseInputs` in pythermalcomfort's `classes_input.py` — it resolves
 * the defaults and normalises `units` to upper case, so a subclass and the
 * model behind it always see the same validated values.
 *
 * Only the genuinely shared fields live here. Each subclass declares its own
 * measured inputs, which keeps it exactly as wide as the model it feeds.
 * (pythermalcomfort's base carries every field of every model because its
 * dataclass machinery requires it; nothing here does.)
 *
 * @public
 */
export class BaseInputs {
  readonly units: UnitSystem;
  readonly limit_inputs: boolean;
  readonly round_output: boolean;

  constructor(init: BaseInputsInit = {}) {
    const units = (init.units ?? "SI").toUpperCase();
    const limit_inputs = init.limit_inputs ?? true;
    const round_output = init.round_output ?? true;
    validateInputs({ units, limit_inputs, round_output }, BASE_SCHEMA);
    this.units = units as UnitSystem;
    this.limit_inputs = limit_inputs;
    this.round_output = round_output;
  }
}

/** What {@link PmvPpdInputs} accepts. */
export interface PmvPpdInit extends BaseInputsInit {
  /** Dry-bulb air temperature, [°C] or [°F]. */
  tdb: number;
  /** Mean radiant temperature, [°C] or [°F]. */
  tr: number;
  /** Relative air speed, [m/s] or [fps]. */
  vr: number;
  /** Relative humidity, [%]. */
  rh: number;
  /** Metabolic rate, [met]. */
  met: number;
  /** Clothing insulation, [clo]. */
  clo: number;
  /** External work, [met]. Default `0`. */
  wme?: number | undefined;
}

/** What {@link PmvPpdAshraeInputs} accepts. */
export interface PmvPpdAshraeInit extends PmvPpdInit {
  /** Whether occupants control the air speed. Default `true`. */
  airspeed_control?: boolean | undefined;
}

/** What {@link AdaptiveInputs} accepts. */
export interface AdaptiveInit extends BaseInputsInit {
  /** Dry-bulb air temperature, [°C] or [°F]. */
  tdb: number;
  /** Mean radiant temperature, [°C] or [°F]. */
  tr: number;
  /** Running mean outdoor temperature, [°C] or [°F]. */
  t_running_mean: number;
  /** Air speed, [m/s] or [fps]. */
  v: number;
}

const PMV_SCHEMA = {
  tdb: { type: "number" },
  tr: { type: "number" },
  vr: { type: "number" },
  rh: { type: "number" },
  met: { type: "number" },
  clo: { type: "number" },
  wme: { type: "number" },
} satisfies ValidationSchema;

const ADAPTIVE_SCHEMA = {
  tdb: { type: "number" },
  tr: { type: "number" },
  t_running_mean: { type: "number" },
  v: { type: "number" },
} satisfies ValidationSchema;

/**
 * Validated inputs for a PMV/PPD model. Used as-is for ISO 7730; ASHRAE 55
 * extends it with `airspeed_control`.
 *
 * @public
 */
export class PmvPpdInputs extends BaseInputs {
  readonly tdb: number;
  readonly tr: number;
  readonly vr: number;
  readonly rh: number;
  readonly met: number;
  readonly clo: number;
  readonly wme: number;

  constructor(init: PmvPpdInit) {
    super(init);
    const wme = init.wme ?? 0;
    validateInputs({ ...init, wme }, PMV_SCHEMA);
    this.tdb = init.tdb;
    this.tr = init.tr;
    this.vr = init.vr;
    this.rh = init.rh;
    this.met = init.met;
    this.clo = init.clo;
    this.wme = wme;
  }
}

/**
 * Validated inputs for the ASHRAE 55 PMV/PPD model. Adds `airspeed_control`,
 * which only that standard consults.
 *
 * @public
 */
export class PmvPpdAshraeInputs extends PmvPpdInputs {
  readonly airspeed_control: boolean;

  constructor(init: PmvPpdAshraeInit) {
    super(init);
    const airspeed_control = init.airspeed_control ?? true;
    validateInputs(
      { airspeed_control },
      { airspeed_control: { type: "boolean" } },
    );
    this.airspeed_control = airspeed_control;
  }
}

/**
 * Validated inputs for the adaptive models.
 *
 * ASHRAE 55 and EN 16798-1 take the same four measurements and the same
 * options, so one class serves both — pythermalcomfort splits them into
 * `ASHRAEInputs` and `ENInputs`, but those are field-for-field identical and
 * the split buys no safety in a structurally typed language.
 *
 * @public
 */
export class AdaptiveInputs extends BaseInputs {
  readonly tdb: number;
  readonly tr: number;
  readonly t_running_mean: number;
  readonly v: number;

  constructor(init: AdaptiveInit) {
    super(init);
    validateInputs({ ...init }, ADAPTIVE_SCHEMA);
    this.tdb = init.tdb;
    this.tr = init.tr;
    this.t_running_mean = init.t_running_mean;
    this.v = init.v;
  }
}
