import { PMV_PPD_ISO_DEFAULT_EDITION } from "../models/pmv_ppd_iso.js";
import type { PmvPpdIsoEdition } from "../models/pmv_ppd_iso.js";
import type { UnitSystem } from "../utilities/utilities.js";

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

/**
 * The options shared by every model: unit system and the two output switches.
 *
 * Mirrors `BaseInputs` in pythermalcomfort's `classes_input.py` — it resolves
 * the defaults and normalises `units` to upper case, so a subclass and the
 * model behind it always see the same values. The upper-casing matters beyond
 * the model call: `toMeasures()` resolves the unit of each value from
 * `inputs.units`, and a lowercase `"ip"` would label °F values as °C.
 *
 * These classes do not validate. Every model validates its own arguments —
 * type, unit system, the switches — and every `io` factory runs a model
 * immediately, so a bad value throws the model's error from the same call.
 * Validating here as well was a second copy of each model's schema.
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
    this.units = (init.units ?? "SI").toUpperCase() as UnitSystem;
    this.limit_inputs = init.limit_inputs ?? true;
    this.round_output = init.round_output ?? true;
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

/** What {@link PmvPpdIsoInputs} accepts. */
export interface PmvPpdIsoInit extends PmvPpdInit {
  /**
   * ISO 7730 edition the result is reported under. Default
   * {@link PMV_PPD_ISO_DEFAULT_EDITION}. Changes no numbers today; see
   * `PmvPpdIsoKwargs.edition`.
   */
  edition?: PmvPpdIsoEdition | undefined;
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

/**
 * Inputs for a PMV/PPD model, defaults resolved. ISO 7730 extends it with
 * `edition`, ASHRAE 55 with `airspeed_control`.
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
    this.tdb = init.tdb;
    this.tr = init.tr;
    this.vr = init.vr;
    this.rh = init.rh;
    this.met = init.met;
    this.clo = init.clo;
    this.wme = init.wme ?? 0;
  }
}

/**
 * Inputs for the ISO 7730 PMV/PPD model. Adds `edition`, which only that
 * standard has; the value is defaulted here and validated when the model runs
 * (`PmvPpdIsoOutputs`), as every other argument is.
 *
 * @public
 */
export class PmvPpdIsoInputs extends PmvPpdInputs {
  readonly edition: PmvPpdIsoEdition;

  constructor(init: PmvPpdIsoInit) {
    super(init);
    this.edition = init.edition ?? PMV_PPD_ISO_DEFAULT_EDITION;
  }
}

/**
 * Inputs for the ASHRAE 55 PMV/PPD model. Adds `airspeed_control`, which only
 * that standard consults.
 *
 * @public
 */
export class PmvPpdAshraeInputs extends PmvPpdInputs {
  readonly airspeed_control: boolean;

  constructor(init: PmvPpdAshraeInit) {
    super(init);
    this.airspeed_control = init.airspeed_control ?? true;
  }
}

/**
 * Inputs for the adaptive models, defaults resolved.
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
    this.tdb = init.tdb;
    this.tr = init.tr;
    this.t_running_mean = init.t_running_mean;
    this.v = init.v;
  }
}
