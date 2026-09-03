import type { Quantity } from "./quantity.js";

/**
 * A comfort range as it came out of one evaluation, together with whether the
 * conditions met it.
 *
 * `satisfied` is carried rather than derived on purpose: the adaptive models
 * compare the *operative* temperature against these bounds, and the operative
 * temperature is not part of their return value. A consumer holding only the
 * result cannot recompute it.
 *
 * The bounds are plain numbers because they are evaluated, not declarative:
 * they move with the running mean temperature and with the elevated-air-speed
 * cooling effect. Where the closure of an interval matters — ASHRAE 55 PMV
 * compliance is open at both ends — the declarative form lives on the model
 * function, as `pmv_ppd_ashrae.compliance`.
 *
 * @public
 */
export interface ComfortInterval {
  /** e.g. `"80%"`, `"Category I"`, `"Compliant"`. */
  readonly label: string;
  /** Lower bound, in the unit of the {@link Measure} that carries it. */
  readonly low: number;
  /** Upper bound, in the unit of the {@link Measure} that carries it. */
  readonly high: number;
  /** Whether the evaluated conditions fell inside this range. */
  readonly satisfied: boolean;
}

/**
 * One number from a model result, carrying everything needed to display it:
 * what it is, what unit it is in, which band it falls in, and which comfort
 * ranges applied.
 *
 * This is the single shape the I/O layer reduces every model to. The values
 * are bit-identical to those returned by calling the model function directly —
 * `toMeasures()` re-packages, it never recomputes.
 *
 * @public
 */
export interface Measure {
  readonly quantity: Quantity;
  readonly value: number;
  /**
   * The unit this particular value is in, resolved from the quantity and the
   * unit system the model ran under.
   */
  readonly unit: string;
  /**
   * The band label, e.g. `"Slightly Cool"`. Absent when the model has no
   * classification (both adaptive models) or when the value falls outside
   * every band — including when it is NaN, which is the normal result for an
   * input outside the standard's applicability limits.
   */
  readonly category?: string | undefined;
  /**
   * Comfort ranges evaluated for this value. Always present; empty when the
   * model has none, so a consumer can iterate it without a guard.
   */
  readonly intervals: readonly ComfortInterval[];
}
