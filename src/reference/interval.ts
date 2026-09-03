/**
 * One end of an interval. `Infinity` / `-Infinity` mark an unbounded side, in
 * which case `inclusive` is meaningless and should be `false`.
 *
 * @public
 */
export interface Bound {
  readonly value: number;
  readonly inclusive: boolean;
}

/**
 * A labelled interval. Both ends carry their own inclusivity, because all four
 * combinations occur in the models this package ships:
 *
 * | closure    | where |
 * |------------|-------|
 * | `[lo, hi]` | adaptive acceptability — `tmp_cmf_80_low <= to && to <= tmp_cmf_80_up` |
 * | `(lo, hi)` | ASHRAE PMV compliance — `-0.5 < pmv < 0.5` |
 * | `(lo, hi]` | ASHRAE thermal sensation, humidex, UTCI |
 * | `[lo, hi)` | ISO thermal sensation |
 *
 * A single "all left-closed / all right-closed" flag cannot express that.
 *
 * @public
 */
export class LabeledInterval {
  readonly label: string;
  readonly lower: Bound;
  readonly upper: Bound;

  constructor(label: string, lower: Bound, upper: Bound) {
    this.label = label;
    this.lower = lower;
    this.upper = upper;
  }

  /**
   * NaN is never inside an interval. That matters here more than it looks: NaN
   * is the *normal* result for an out-of-applicability input, so a classifier
   * that let NaN fall through would label every rejected input as whichever
   * band happens to sit at the end of the scale.
   */
  contains(value: number): boolean {
    if (Number.isNaN(value)) return false;
    const aboveLower = this.lower.inclusive
      ? value >= this.lower.value
      : value > this.lower.value;
    if (!aboveLower) return false;
    return this.upper.inclusive
      ? value <= this.upper.value
      : value < this.upper.value;
  }

  /** Mathematical notation, e.g. `"[-1.5, -0.5)"`. Handy in docs and snapshots. */
  get notation(): string {
    const open = this.lower.inclusive ? "[" : "(";
    const close = this.upper.inclusive ? "]" : ")";
    return `${open}${this.lower.value}, ${this.upper.value}${close}`;
  }
}

/**
 * An ordered, non-overlapping set of {@link LabeledInterval}s that maps a
 * number onto a label.
 *
 * @public
 */
export class IntervalScale {
  readonly intervals: readonly LabeledInterval[];

  constructor(intervals: readonly LabeledInterval[]) {
    this.intervals = intervals;
  }

  /**
   * The interval a value falls in, or `undefined` when it falls outside every
   * one — including for NaN. Deliberately does not clamp to the first or last
   * interval: "outside the scale" is a real answer and squashing it into an
   * end band would silently mislabel out-of-range results.
   */
  classify(value: number): LabeledInterval | undefined {
    return this.intervals.find((interval) => interval.contains(value));
  }

  /** Just the label, for callers that do not need the bounds. */
  labelFor(value: number): string | undefined {
    return this.classify(value)?.label;
  }
}

/** Which side of each cut point belongs to the interval below it. */
export type ScaleClosure = "leftClosed" | "rightClosed";

/**
 * Builds a scale from ascending upper edges plus labels, matching the semantics
 * of pythermalcomfort's `mapping()`:
 *
 * - `edges` are **upper** cut points; the first label covers everything below
 *   `edges[0]`, so there is one more label than there are interior cuts.
 * - `leftClosed` gives `[lo, hi)` (pythermalcomfort's `right=False`);
 *   `rightClosed` gives `(lo, hi]` (`right=True`).
 * - Values above the last edge belong to no interval, matching Python's
 *   "append NaN for out-of-range values".
 *
 * @param edges - ascending upper cut points; the last one is the top of the scale
 * @param labels - one per edge
 * @param closure - which side each cut point belongs to
 *
 * @public
 */
export function scaleFromEdges(
  edges: readonly number[],
  labels: readonly string[],
  closure: ScaleClosure,
): IntervalScale {
  if (edges.length !== labels.length) {
    throw new Error(
      `edges (${edges.length}) and labels (${labels.length}) must be the same length`,
    );
  }
  const leftClosed = closure === "leftClosed";
  const intervals = labels.map((label, index) => {
    const lowerValue = index === 0 ? -Infinity : edges[index - 1]!;
    return new LabeledInterval(
      label,
      {
        value: lowerValue,
        // The unbounded end is never "inclusive"; interior cuts belong to the
        // interval above them only when the scale is left-closed.
        inclusive: index !== 0 && leftClosed,
      },
      { value: edges[index]!, inclusive: !leftClosed },
    );
  });
  return new IntervalScale(intervals);
}
