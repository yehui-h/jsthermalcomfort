import { adaptive_ashrae } from "../models/adaptive_ashrae.js";
import { adaptive_en } from "../models/adaptive_en.js";
import {
  adaptiveAshraeOffsets,
  adaptiveCoolingEffectMinOperative,
  adaptiveEnOffsets,
} from "../reference/offsets.js";
import type { AdaptiveOffset } from "../reference/offsets.js";

/** A point on an adaptive comfort chart, in SI units. */
export interface AdaptivePoint {
  /** Running mean outdoor temperature, [°C]. */
  readonly trm: number;
  /** Operative temperature, [°C]. */
  readonly t: number;
}

/** One acceptability band of an adaptive chart. */
export interface AdaptiveBand {
  /** From the reference offsets: `"80%"`, `"Category I"`, and so on. */
  readonly label: string;
  /** Lower boundary, in ascending running mean temperature. */
  readonly lower: readonly AdaptivePoint[];
  /** Upper boundary, in ascending running mean temperature. */
  readonly upper: readonly AdaptivePoint[];
  /** The closed polygon: upper boundary out, lower boundary back. */
  readonly polygon: readonly AdaptivePoint[];
}

/** Arguments to {@link adaptiveAshraeZone} and {@link adaptiveEnZone}. */
export interface AdaptiveZoneOptions {
  /**
   * Air speed, [m/s]. Default `0`.
   *
   * Only elevated air speeds matter here: below 0.6 m/s there is no cooling
   * effect and the upper boundary is a straight line. The CBE tool draws its
   * EN chart with no cooling effect at all.
   */
  readonly v?: number;
  /**
   * The running mean temperatures to draw between, [°C]. Defaults follow the
   * axes of the CBE tool's charts: `[10, 36]` for ASHRAE, `[10, 30]` for EN.
   *
   * ASHRAE's own applicability stops at 33.5 °C, so the default range runs
   * past it; the models are called with `limit_inputs: false` to allow that.
   */
  readonly trmRange?: readonly [number, number];
}

/** The comfort bounds of every band at one running mean temperature. */
interface Bounds {
  readonly low: number;
  readonly up: number;
}

/**
 * Evaluates a model's bands at `trm`, with the operative temperature forced to
 * `probe` so that the caller controls whether the cooling effect applies.
 */
type BoundsAt = (trm: number, probe: number) => readonly Bounds[];

/**
 * Both adaptive comfort temperatures are affine in the running mean
 * temperature, so each boundary is fully determined by its two endpoints —
 * no sampling, no root finding. The one exception is the upper boundary under
 * elevated air speed, which steps up by the cooling effect where it crosses
 * {@link adaptiveCoolingEffectMinOperative}.
 *
 * The endpoints come from the models rather than from the straight-line
 * equations, so a change to a model shows up in the chart instead of silently
 * disagreeing with it. (The CBE tool hard-codes its vertices; they match the
 * models today, and the rounded kink at trm = 12 is the only visible seam.)
 */
function bandsFrom(
  boundsAt: BoundsAt,
  offsets: readonly AdaptiveOffset[],
  trmRange: readonly [number, number],
): readonly AdaptiveBand[] {
  const [trmMin, trmMax] = trmRange;
  const kinkT = adaptiveCoolingEffectMinOperative;

  // to = 0 °C is below every cooling-effect threshold, so this is the geometry
  // with no cooling effect; probing at the threshold gives it with.
  const still = boundsAt(trmMin, 0);
  const stillMax = boundsAt(trmMax, 0);
  const cooled = boundsAt(trmMin, kinkT);

  return offsets.map((offset, index) => {
    const lowMin = still[index]!.low;
    const lowMax = stillMax[index]!.low;
    const upMin = still[index]!.up;
    const upMax = stillMax[index]!.up;
    // The cooling effect is a function of air speed alone once the operative
    // temperature reaches the threshold, so one probe answers for every trm.
    const ce = cooled[index]!.up - upMin;
    const slope = (upMax - upMin) / (trmMax - trmMin);
    const kinkTrm = trmMin + (kinkT - upMin) / slope;

    let upper: AdaptivePoint[];
    if (ce === 0 || kinkTrm >= trmMax) {
      // Never reaches the threshold inside this range.
      upper = [
        { trm: trmMin, t: upMin },
        { trm: trmMax, t: upMax },
      ];
    } else if (kinkTrm <= trmMin) {
      // Already above it at the left edge.
      upper = [
        { trm: trmMin, t: upMin + ce },
        { trm: trmMax, t: upMax + ce },
      ];
    } else {
      // Crosses inside the range: the boundary jumps by the cooling effect.
      upper = [
        { trm: trmMin, t: upMin },
        { trm: kinkTrm, t: kinkT },
        { trm: kinkTrm, t: kinkT + ce },
        { trm: trmMax, t: upMax + ce },
      ];
    }

    const lower: AdaptivePoint[] = [
      { trm: trmMin, t: lowMin },
      { trm: trmMax, t: lowMax },
    ];
    return {
      label: offset.label,
      lower,
      upper,
      polygon: [...upper, ...[...lower].reverse()],
    };
  });
}

/**
 * The ASHRAE 55 adaptive comfort bands, as chart geometry.
 *
 * Returns the 80% band first, then the 90% one, matching
 * {@link adaptiveAshraeOffsets}. Under elevated air speed the upper boundary
 * gains the vertical step the CBE tool draws at 25 °C operative.
 *
 * @example
 * import { charts } from "jsthermalcomfort";
 *
 * const [eighty] = charts.adaptiveAshraeZone();
 * eighty.upper; // two points: the boundary at trm = 10 and at trm = 36
 *
 * @public
 */
export function adaptiveAshraeZone(
  options: AdaptiveZoneOptions = {},
): readonly AdaptiveBand[] {
  const { v = 0, trmRange = [10, 36] } = options;
  const boundsAt: BoundsAt = (trm, probe) => {
    const r = adaptive_ashrae(probe, probe, trm, v, "SI", false, false);
    return [
      { low: r.tmp_cmf_80_low, up: r.tmp_cmf_80_up },
      { low: r.tmp_cmf_90_low, up: r.tmp_cmf_90_up },
    ];
  };
  return bandsFrom(boundsAt, adaptiveAshraeOffsets, trmRange);
}

/**
 * The EN 16798-1 adaptive comfort bands, as chart geometry.
 *
 * Returns categories I, II and III in that order, matching
 * {@link adaptiveEnOffsets}. They nest, and each is asymmetric about the
 * comfort temperature — 1 K further below it than above.
 *
 * @public
 */
export function adaptiveEnZone(
  options: AdaptiveZoneOptions = {},
): readonly AdaptiveBand[] {
  const { v = 0, trmRange = [10, 30] } = options;
  const boundsAt: BoundsAt = (trm, probe) => {
    const r = adaptive_en(probe, probe, trm, v, "SI", false, false);
    return [
      { low: r.tmp_cmf_cat_i_low, up: r.tmp_cmf_cat_i_up },
      { low: r.tmp_cmf_cat_ii_low, up: r.tmp_cmf_cat_ii_up },
      { low: r.tmp_cmf_cat_iii_low, up: r.tmp_cmf_cat_iii_up },
    ];
  };
  return bandsFrom(boundsAt, adaptiveEnOffsets, trmRange);
}
