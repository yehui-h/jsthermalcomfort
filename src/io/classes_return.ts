import { adaptive_ashrae_with_warnings } from "../models/adaptive_ashrae.js";
import { adaptive_en } from "../models/adaptive_en.js";
import { pmv_ppd_with_warnings } from "../models/pmv_ppd.js";
import { pmv_ppd_ashrae } from "../models/pmv_ppd_ashrae.js";
import { pmv_ppd_iso } from "../models/pmv_ppd_iso.js";
import {
  adaptiveAshraeOffsets,
  adaptiveEnOffsets,
} from "../reference/offsets.js";
import { units_converter } from "../utilities/utilities.js";
import {
  AdaptiveInputs,
  PmvPpdAshraeInputs,
  PmvPpdInputs,
} from "./classes_input.js";
import { quantities, unitFor } from "./quantity.js";
import type { ComfortInterval, Measure } from "./measure.js";
// Implemented, not re-declared: an Outputs class that drops or renames a field
// the model returns stops compiling here.
import type { AdaptiveAshraeResult } from "../models/adaptive_ashrae.js";
import type { AdaptiveEnResult } from "../models/adaptive_en.js";
import type { PmvPpdResult } from "../models/pmv_ppd.js";
import type {
  AdaptiveInit,
  PmvPpdAshraeInit,
  PmvPpdInit,
} from "./classes_input.js";
import type { AdaptiveOffset } from "../reference/offsets.js";

// Named once, from the same tables the models compute their bounds with, so a
// label and the numbers it goes on cannot come from different rows.
const [band80, band90] = adaptiveAshraeOffsets;
const [catI, catII, catIII] = adaptiveEnOffsets;

/**
 * Results of one model run, in the shape every model reduces to.
 *
 * `toMeasures()` re-packages what the model already returned; it never
 * recomputes, so its numbers are bit-identical to a direct call.
 *
 * `TInputs` is the validated input class the run came from, so a caller holding
 * a concrete outcome reads `inputs.tdb` without casting; `Outcome` on its own
 * still describes any of them.
 *
 * @public
 */
export interface Outcome<TInputs = unknown> {
  /** The validated inputs this result came from. */
  readonly inputs: TInputs;
  /** Why the result is NaN, when it is. Empty when every input was in range. */
  readonly warnings: readonly string[];
  toMeasures(): readonly Measure[];
}

/** One evaluated comfort range paired with the reference offset that names it. */
interface EvaluatedBand {
  readonly low: number;
  readonly high: number;
  readonly satisfied: boolean;
}

/**
 * Names one evaluated band from the reference offset it came from, so the label
 * has a single definition.
 *
 * Offset and numbers are passed together rather than as two arrays lined up by
 * index: a band can only be mislabelled by writing the wrong pair, not by one
 * of the two lists being reordered somewhere else.
 */
function bandFrom(
  offset: AdaptiveOffset,
  evaluated: EvaluatedBand,
): ComfortInterval {
  return { label: offset.label, ...evaluated };
}

/**
 * PMV and PPD per ISO 7730, plus the thermal sensation band the PMV falls in.
 *
 * @public
 */
export class PmvPpdIsoOutputs implements Outcome<PmvPpdInputs>, PmvPpdResult {
  readonly inputs: PmvPpdInputs;
  /** Predicted Mean Vote. */
  readonly pmv: number;
  /** Predicted Percentage of Dissatisfied, [%]. */
  readonly ppd: number;
  /**
   * Thermal sensation band, e.g. `"Slightly Cool"`. `undefined` when the PMV
   * falls outside the scale — NaN included.
   */
  readonly tsv: string | undefined;
  readonly warnings: readonly string[];

  constructor(inputs: PmvPpdInputs) {
    // The kernel rather than pmv_ppd_iso(): same arithmetic, same rounding,
    // but it also hands back the applicability warnings the public function
    // discards. Inputs were validated by PmvPpdInputs.
    const result = pmv_ppd_with_warnings(
      inputs.tdb,
      inputs.tr,
      inputs.vr,
      inputs.rh,
      inputs.met,
      inputs.clo,
      inputs.wme,
      "ISO",
      {
        units: inputs.units,
        limit_inputs: inputs.limit_inputs,
        round_output: inputs.round_output,
      },
    );
    this.inputs = inputs;
    this.pmv = result.pmv;
    this.ppd = result.ppd;
    // Classified from the returned PMV, so rounding is applied first — the
    // order pythermalcomfort uses (`mapping()` runs after `np.round`).
    this.tsv = pmv_ppd_iso.tsv.labelFor(result.pmv);
    this.warnings = result.warnings;
  }

  toMeasures(): readonly Measure[] {
    const { units } = this.inputs;
    return [
      {
        quantity: quantities.pmv,
        value: this.pmv,
        unit: unitFor(quantities.pmv, units),
        category: this.tsv,
        intervals: [],
      },
      {
        quantity: quantities.ppd,
        value: this.ppd,
        unit: unitFor(quantities.ppd, units),
        intervals: [],
      },
    ];
  }
}

/**
 * PMV and PPD per ASHRAE 55, plus the thermal sensation band and whether the
 * conditions comply with the standard.
 *
 * @public
 */
export class PmvPpdAshraeOutputs
  implements Outcome<PmvPpdAshraeInputs>, PmvPpdResult
{
  readonly inputs: PmvPpdAshraeInputs;
  /** Predicted Mean Vote. */
  readonly pmv: number;
  /** Predicted Percentage of Dissatisfied, [%]. */
  readonly ppd: number;
  /**
   * Thermal sensation band. ASHRAE closes the scale from the opposite side to
   * ISO, so at exactly -0.5 this reads `"Slightly Cool"` where ISO reads
   * `"Neutral"`.
   */
  readonly tsv: string | undefined;
  /**
   * Whether -0.5 < PMV < 0.5. `undefined` when the inputs fell outside the
   * applicability limits, matching pythermalcomfort, which returns NaN there
   * rather than a verdict.
   */
  readonly compliance: boolean | undefined;
  readonly warnings: readonly string[];

  constructor(inputs: PmvPpdAshraeInputs) {
    const result = pmv_ppd_with_warnings(
      inputs.tdb,
      inputs.tr,
      inputs.vr,
      inputs.rh,
      inputs.met,
      inputs.clo,
      inputs.wme,
      "ASHRAE",
      {
        units: inputs.units,
        limit_inputs: inputs.limit_inputs,
        airspeed_control: inputs.airspeed_control,
        round_output: inputs.round_output,
      },
    );
    this.inputs = inputs;
    this.pmv = result.pmv;
    this.ppd = result.ppd;
    this.tsv = pmv_ppd_ashrae.tsv.labelFor(result.pmv);
    // Compliance is judged on the unrounded PMV: pythermalcomfort evaluates it
    // before rounding, so a PMV of 0.4996 complies even though it is reported
    // as 0.5.
    this.compliance = Number.isNaN(result.pmv_unrounded)
      ? undefined
      : pmv_ppd_ashrae.compliance.contains(result.pmv_unrounded);
    this.warnings = result.warnings;
  }

  toMeasures(): readonly Measure[] {
    const { units } = this.inputs;
    const { compliance } = pmv_ppd_ashrae;
    return [
      {
        quantity: quantities.pmv,
        value: this.pmv,
        unit: unitFor(quantities.pmv, units),
        category: this.tsv,
        // No verdict, no interval: an out-of-applicability run has nothing to
        // report here. The band itself is always available, undecided, as
        // `pmv_ppd_ashrae.compliance`.
        intervals:
          this.compliance === undefined
            ? []
            : [
                {
                  label: compliance.label,
                  low: compliance.lower.value,
                  high: compliance.upper.value,
                  satisfied: this.compliance,
                },
              ],
      },
      {
        quantity: quantities.ppd,
        value: this.ppd,
        unit: unitFor(quantities.ppd, units),
        intervals: [],
      },
    ];
  }
}

/**
 * Adaptive comfort temperature per ASHRAE 55, with the 80% and 90%
 * acceptability ranges.
 *
 * @public
 */
export class AdaptiveAshraeOutputs
  implements Outcome<AdaptiveInputs>, AdaptiveAshraeResult
{
  readonly inputs: AdaptiveInputs;
  /** Comfort temperature at that running mean temperature. */
  readonly tmp_cmf: number;
  readonly tmp_cmf_80_low: number;
  readonly tmp_cmf_80_up: number;
  readonly tmp_cmf_90_low: number;
  readonly tmp_cmf_90_up: number;
  readonly acceptability_80: boolean;
  readonly acceptability_90: boolean;
  readonly warnings: readonly string[];

  constructor(inputs: AdaptiveInputs) {
    const result = adaptive_ashrae_with_warnings(
      inputs.tdb,
      inputs.tr,
      inputs.t_running_mean,
      inputs.v,
      inputs.units,
      inputs.limit_inputs,
      inputs.round_output,
    );
    this.inputs = inputs;
    this.tmp_cmf = result.tmp_cmf;
    this.tmp_cmf_80_low = result.tmp_cmf_80_low;
    this.tmp_cmf_80_up = result.tmp_cmf_80_up;
    this.tmp_cmf_90_low = result.tmp_cmf_90_low;
    this.tmp_cmf_90_up = result.tmp_cmf_90_up;
    this.acceptability_80 = result.acceptability_80;
    this.acceptability_90 = result.acceptability_90;
    this.warnings = result.warnings;
  }

  /**
   * One measure — the comfort temperature — carrying both acceptability
   * ranges. `satisfied` compares the *operative* temperature, which is not in
   * the result, so it is reported rather than left to the caller to derive.
   */
  toMeasures(): readonly Measure[] {
    return [
      {
        quantity: quantities.tmp_cmf,
        value: this.tmp_cmf,
        unit: unitFor(quantities.tmp_cmf, this.inputs.units),
        intervals: [
          bandFrom(band80, {
            low: this.tmp_cmf_80_low,
            high: this.tmp_cmf_80_up,
            satisfied: this.acceptability_80,
          }),
          bandFrom(band90, {
            low: this.tmp_cmf_90_low,
            high: this.tmp_cmf_90_up,
            satisfied: this.acceptability_90,
          }),
        ],
      },
    ];
  }
}

/**
 * Adaptive comfort temperature per EN 16798-1, with the three category ranges.
 *
 * @public
 */
export class AdaptiveEnOutputs
  implements Outcome<AdaptiveInputs>, AdaptiveEnResult
{
  readonly inputs: AdaptiveInputs;
  /** Comfort temperature at that running mean temperature. */
  readonly tmp_cmf: number;
  readonly tmp_cmf_cat_i_low: number;
  readonly tmp_cmf_cat_i_up: number;
  readonly tmp_cmf_cat_ii_low: number;
  readonly tmp_cmf_cat_ii_up: number;
  readonly tmp_cmf_cat_iii_low: number;
  readonly tmp_cmf_cat_iii_up: number;
  readonly acceptability_cat_i: boolean;
  readonly acceptability_cat_ii: boolean;
  readonly acceptability_cat_iii: boolean;
  readonly warnings: readonly string[];

  constructor(inputs: AdaptiveInputs) {
    const result = adaptive_en(
      inputs.tdb,
      inputs.tr,
      inputs.t_running_mean,
      inputs.v,
      inputs.units,
      inputs.limit_inputs,
      inputs.round_output,
    );
    this.inputs = inputs;
    this.tmp_cmf = result.tmp_cmf;
    this.tmp_cmf_cat_i_low = result.tmp_cmf_cat_i_low;
    this.tmp_cmf_cat_i_up = result.tmp_cmf_cat_i_up;
    this.tmp_cmf_cat_ii_low = result.tmp_cmf_cat_ii_low;
    this.tmp_cmf_cat_ii_up = result.tmp_cmf_cat_ii_up;
    this.tmp_cmf_cat_iii_low = result.tmp_cmf_cat_iii_low;
    this.tmp_cmf_cat_iii_up = result.tmp_cmf_cat_iii_up;
    this.acceptability_cat_i = result.acceptability_cat_i;
    this.acceptability_cat_ii = result.acceptability_cat_ii;
    this.acceptability_cat_iii = result.acceptability_cat_iii;
    this.warnings = adaptiveEnWarnings(inputs);
  }

  /** One measure — the comfort temperature — carrying all three categories. */
  toMeasures(): readonly Measure[] {
    return [
      {
        quantity: quantities.tmp_cmf,
        value: this.tmp_cmf,
        unit: unitFor(quantities.tmp_cmf, this.inputs.units),
        intervals: [
          bandFrom(catI, {
            low: this.tmp_cmf_cat_i_low,
            high: this.tmp_cmf_cat_i_up,
            satisfied: this.acceptability_cat_i,
          }),
          bandFrom(catII, {
            low: this.tmp_cmf_cat_ii_low,
            high: this.tmp_cmf_cat_ii_up,
            satisfied: this.acceptability_cat_ii,
          }),
          bandFrom(catIII, {
            low: this.tmp_cmf_cat_iii_low,
            high: this.tmp_cmf_cat_iii_up,
            satisfied: this.acceptability_cat_iii,
          }),
        ],
      },
    ];
  }
}

/**
 * The one applicability check `adaptive_en` performs, restated as a message.
 *
 * Computed here rather than inside the model: unlike `adaptive_ashrae` and
 * `pmv_ppd`, `adaptive_en` is a verbatim port kept auditable against
 * jsthermalcomfort 1.4.0, so it grows no kernel of its own.
 *
 * The bound is 33.5 °C, not the 30 °C the model's documentation quotes.
 * pythermalcomfort has the same split — `adaptive_en.py` documents 30 and
 * tests `valid_range(t_running_mean, (10.0, 33.5))` — and the code is what
 * decides the result.
 */
function adaptiveEnWarnings(inputs: AdaptiveInputs): readonly string[] {
  const trm =
    inputs.units === "IP"
      ? units_converter({ t_running_mean: inputs.t_running_mean })
          .t_running_mean
      : inputs.t_running_mean;
  if (trm >= 10.0 && trm <= 33.5) return [];
  return [
    "EN running mean outdoor temperature applicability limits between 10.0 and 33.5 °C",
  ];
}

/**
 * Runs the ISO 7730 PMV/PPD model and returns the unified result.
 *
 * @public
 */
export function pmvPpdIso(inputs: PmvPpdInit): PmvPpdIsoOutputs {
  return new PmvPpdIsoOutputs(new PmvPpdInputs(inputs));
}

/**
 * Runs the ASHRAE 55 PMV/PPD model and returns the unified result.
 *
 * @public
 */
export function pmvPpdAshrae(inputs: PmvPpdAshraeInit): PmvPpdAshraeOutputs {
  return new PmvPpdAshraeOutputs(new PmvPpdAshraeInputs(inputs));
}

/**
 * Runs the ASHRAE 55 adaptive model and returns the unified result.
 *
 * @public
 */
export function adaptiveAshrae(inputs: AdaptiveInit): AdaptiveAshraeOutputs {
  return new AdaptiveAshraeOutputs(new AdaptiveInputs(inputs));
}

/**
 * Runs the EN 16798-1 adaptive model and returns the unified result.
 *
 * @public
 */
export function adaptiveEn(inputs: AdaptiveInit): AdaptiveEnOutputs {
  return new AdaptiveEnOutputs(new AdaptiveInputs(inputs));
}
