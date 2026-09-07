import { adaptive_ashrae_with_warnings } from "../models/adaptive_ashrae.js";
import { adaptive_en } from "../models/adaptive_en.js";
import { pmv_ppd_with_warnings } from "../models/pmv_ppd.js";
import { pmv_ppd_ashrae } from "../models/pmv_ppd_ashrae.js";
import {
  assert_pmv_ppd_iso_edition,
  pmv_ppd_iso,
} from "../models/pmv_ppd_iso.js";
import {
  adaptiveAshraeOffsets,
  adaptiveEnOffsets,
} from "../reference/offsets.js";
import { en16798AdaptiveLimits } from "../reference/limits.js";
import { range_violations, units_converter } from "../utilities/utilities.js";
import {
  AdaptiveInputs,
  PmvPpdAshraeInputs,
  PmvPpdIsoInputs,
} from "./classes_input.js";
import { quantities, unitFor } from "./quantity.js";
import type { ComfortInterval, Measure } from "./measure.js";
import type { AdaptiveAshraeResult } from "../models/adaptive_ashrae.js";
import type { AdaptiveEnResult } from "../models/adaptive_en.js";
import type { PmvPpdResult } from "../models/pmv_ppd.js";
import type { PmvPpdIsoEdition } from "../models/pmv_ppd_iso.js";
import type {
  AdaptiveInit,
  PmvPpdAshraeInit,
  PmvPpdIsoInit,
} from "./classes_input.js";
import type { ApplicabilityLimit } from "../reference/limits.js";
import type { AdaptiveOffset } from "../reference/offsets.js";

// Named once, from the same tables the models compute their bounds with, so a
// label and the numbers it goes on cannot come from different rows.
const [band80, band90] = adaptiveAshraeOffsets;
const [catI, catII, catIII] = adaptiveEnOffsets;

/**
 * Results of one model run, in the shape every model reduces to.
 *
 * `result` is the model function's own return object, not a copy: the I/O
 * layer never re-declares a model field, so it cannot drop or rename one, and
 * `toMeasures()` re-packages those numbers without recomputing them — they are
 * bit-identical to a direct call.
 *
 * `TInputs` is the input class the run came from, so a caller holding a
 * concrete outcome reads `inputs.tdb` without casting; `TResult` is the model's
 * return type. `Outcome` on its own still describes any of them.
 *
 * @public
 */
export interface Outcome<TInputs = unknown, TResult = unknown> {
  /** The inputs this result came from, defaults resolved. */
  readonly inputs: TInputs;
  /** Exactly what the model function returns for these inputs. */
  readonly result: TResult;
  /**
   * The applicability rows this run broke, as the published table's own
   * objects — so a consumer can dispatch on `role` and never compares a
   * sentence. Evaluated whether or not `limit_inputs` is set; that switch only
   * decides whether `result` is NaN. Input rows first, then any derived or
   * output rows. Empty when every row held.
   *
   * Not in upstream, which has no `io` layer and returns NaN without saying
   * which bound was crossed (2026-09-07).
   */
  readonly violations: readonly ApplicabilityLimit[];
  /**
   * `violations` as sentences, in the same order, plus the one ASHRAE
   * cross-field air-speed rule that has no row. Empty when every row held.
   */
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
export class PmvPpdIsoOutputs implements Outcome<
  PmvPpdIsoInputs,
  PmvPpdResult
> {
  readonly inputs: PmvPpdIsoInputs;
  /** `{ pmv, ppd }`, as `pmv_ppd_iso` returns it. */
  readonly result: PmvPpdResult;
  /**
   * Thermal sensation band, e.g. `"Slightly Cool"`. `undefined` when the PMV
   * falls outside the scale — NaN included.
   */
  readonly tsv: string | undefined;
  /** The edition this result is reported under; `inputs.edition`, echoed. */
  readonly edition: PmvPpdIsoEdition;
  readonly violations: readonly ApplicabilityLimit[];
  readonly warnings: readonly string[];

  constructor(inputs: PmvPpdIsoInputs) {
    // The kernel rather than pmv_ppd_iso(): same arithmetic, same rounding,
    // but it also hands back the applicability rows the public function
    // discards. That bypasses the edition check, so it is applied here.
    assert_pmv_ppd_iso_edition(inputs.edition);
    const { warnings, violations, pmv_unrounded, ...result } =
      pmv_ppd_with_warnings(
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
    this.result = result;
    // Classified from the returned PMV, so rounding is applied first — the
    // order pythermalcomfort uses (`mapping()` runs after `np.round`).
    this.tsv = pmv_ppd_iso.tsv.labelFor(result.pmv);
    this.edition = inputs.edition;
    this.violations = violations;
    this.warnings = warnings;
  }

  toMeasures(): readonly Measure[] {
    const { units } = this.inputs;
    const { pmv, ppd } = this.result;
    return [
      {
        quantity: quantities.pmv,
        value: pmv,
        unit: unitFor(quantities.pmv, units),
        category: this.tsv,
        intervals: [],
      },
      {
        quantity: quantities.ppd,
        value: ppd,
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
export class PmvPpdAshraeOutputs implements Outcome<
  PmvPpdAshraeInputs,
  PmvPpdResult
> {
  readonly inputs: PmvPpdAshraeInputs;
  /** `{ pmv, ppd }`, as `pmv_ppd_ashrae` returns it. */
  readonly result: PmvPpdResult;
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
  readonly violations: readonly ApplicabilityLimit[];
  readonly warnings: readonly string[];

  constructor(inputs: PmvPpdAshraeInputs) {
    const { warnings, violations, pmv_unrounded, ...result } =
      pmv_ppd_with_warnings(
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
    this.result = result;
    this.tsv = pmv_ppd_ashrae.tsv.labelFor(result.pmv);
    // Compliance is judged on the unrounded PMV: pythermalcomfort evaluates it
    // before rounding, so a PMV of 0.4996 complies even though it is reported
    // as 0.5.
    this.compliance = Number.isNaN(pmv_unrounded)
      ? undefined
      : pmv_ppd_ashrae.compliance.contains(pmv_unrounded);
    this.violations = violations;
    this.warnings = warnings;
  }

  toMeasures(): readonly Measure[] {
    const { units } = this.inputs;
    const { pmv, ppd } = this.result;
    const { compliance } = pmv_ppd_ashrae;
    return [
      {
        quantity: quantities.pmv,
        value: pmv,
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
        value: ppd,
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
export class AdaptiveAshraeOutputs implements Outcome<
  AdaptiveInputs,
  AdaptiveAshraeResult
> {
  readonly inputs: AdaptiveInputs;
  /** The comfort temperature, bounds and flags, as `adaptive_ashrae` returns them. */
  readonly result: AdaptiveAshraeResult;
  readonly violations: readonly ApplicabilityLimit[];
  readonly warnings: readonly string[];

  constructor(inputs: AdaptiveInputs) {
    // The kernel rather than adaptive_ashrae(): same arithmetic, same
    // rounding, but it also hands back the applicability rows the public
    // function discards.
    const { violations, warnings, ...result } = adaptive_ashrae_with_warnings(
      inputs.tdb,
      inputs.tr,
      inputs.t_running_mean,
      inputs.v,
      inputs.units,
      inputs.limit_inputs,
      inputs.round_output,
    );
    this.inputs = inputs;
    this.result = result;
    this.violations = violations;
    this.warnings = warnings;
  }

  /**
   * One measure — the comfort temperature — carrying both acceptability
   * ranges. `satisfied` compares the *operative* temperature, which is not in
   * the result, so it is reported rather than left to the caller to derive.
   */
  toMeasures(): readonly Measure[] {
    const r = this.result;
    return [
      {
        quantity: quantities.tmp_cmf,
        value: r.tmp_cmf,
        unit: unitFor(quantities.tmp_cmf, this.inputs.units),
        intervals: [
          bandFrom(band80, {
            low: r.tmp_cmf_80_low,
            high: r.tmp_cmf_80_up,
            satisfied: r.acceptability_80,
          }),
          bandFrom(band90, {
            low: r.tmp_cmf_90_low,
            high: r.tmp_cmf_90_up,
            satisfied: r.acceptability_90,
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
export class AdaptiveEnOutputs implements Outcome<
  AdaptiveInputs,
  AdaptiveEnResult
> {
  readonly inputs: AdaptiveInputs;
  /** The comfort temperature, bounds and flags, as `adaptive_en` returns them. */
  readonly result: AdaptiveEnResult;
  readonly violations: readonly ApplicabilityLimit[];
  readonly warnings: readonly string[];

  constructor(inputs: AdaptiveInputs) {
    this.inputs = inputs;
    this.result = adaptive_en(
      inputs.tdb,
      inputs.tr,
      inputs.t_running_mean,
      inputs.v,
      inputs.units,
      inputs.limit_inputs,
      inputs.round_output,
    );
    this.violations = adaptiveEnViolations(inputs);
    this.warnings = this.violations.map((row) => row.warning);
  }

  /** One measure — the comfort temperature — carrying all three categories. */
  toMeasures(): readonly Measure[] {
    const r = this.result;
    return [
      {
        quantity: quantities.tmp_cmf,
        value: r.tmp_cmf,
        unit: unitFor(quantities.tmp_cmf, this.inputs.units),
        intervals: [
          bandFrom(catI, {
            low: r.tmp_cmf_cat_i_low,
            high: r.tmp_cmf_cat_i_up,
            satisfied: r.acceptability_cat_i,
          }),
          bandFrom(catII, {
            low: r.tmp_cmf_cat_ii_low,
            high: r.tmp_cmf_cat_ii_up,
            satisfied: r.acceptability_cat_ii,
          }),
          bandFrom(catIII, {
            low: r.tmp_cmf_cat_iii_low,
            high: r.tmp_cmf_cat_iii_up,
            satisfied: r.acceptability_cat_iii,
          }),
        ],
      },
    ];
  }
}

/**
 * ponytail: re-evaluates the row `adaptive_en` also checks, gated differently
 * (the model only under `limit_inputs`, this always); fold into an
 * `adaptive_en_with_warnings` the moment a second consumer needs the rows.
 */
function adaptiveEnViolations(
  inputs: AdaptiveInputs,
): readonly ApplicabilityLimit[] {
  // The rows are in SI, so IP inputs are converted first — the same first step
  // `adaptive_en` takes.
  const t_running_mean =
    inputs.units === "IP"
      ? units_converter({ t_running_mean: inputs.t_running_mean })
          .t_running_mean
      : inputs.t_running_mean;
  return range_violations({ t_running_mean }, en16798AdaptiveLimits);
}

/**
 * Runs the ISO 7730 PMV/PPD model and returns the unified result.
 *
 * @public
 */
export function pmvPpdIso(inputs: PmvPpdIsoInit): PmvPpdIsoOutputs {
  return new PmvPpdIsoOutputs(new PmvPpdIsoInputs(inputs));
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
