/**
 * One input shape and one output shape for every model in this package.
 *
 * The model functions keep the arguments and return values they have always
 * had — pinned byte-for-byte by `tests/baseline.test.ts`. This layer sits
 * beside them: it validates and defaults the inputs once (the `*Inputs`
 * classes), runs the model, and reduces whatever it returned to a list of
 * {@link Measure}s — a value, its unit, the band it falls in, and
 * the comfort ranges that were evaluated for it.
 *
 * ```ts
 * import { io } from "jsthermalcomfort";
 *
 * const result = io.adaptiveEn({ tdb: 25, tr: 25, t_running_mean: 20, v: 0.1 });
 * for (const measure of result.toMeasures()) {
 *   console.log(measure.quantity.label, measure.value, measure.unit);
 *   for (const band of measure.intervals) {
 *     console.log(band.label, band.low, band.high, band.satisfied);
 *   }
 * }
 * ```
 *
 * The numbers are the model's own: `toMeasures()` re-packages, it never
 * recomputes.
 *
 * @module
 */
export {
  BaseInputs,
  PmvPpdInputs,
  PmvPpdAshraeInputs,
  AdaptiveInputs,
} from "./classes_input.js";
export type {
  BaseInputsInit,
  PmvPpdInit,
  PmvPpdAshraeInit,
  AdaptiveInit,
} from "./classes_input.js";
export {
  PmvPpdIsoOutputs,
  PmvPpdAshraeOutputs,
  AdaptiveAshraeOutputs,
  AdaptiveEnOutputs,
  pmvPpdIso,
  pmvPpdAshrae,
  adaptiveAshrae,
  adaptiveEn,
} from "./classes_return.js";
export type { Outcome } from "./classes_return.js";
export { ComfortInterval, Measure } from "./measure.js";
export type { MeasureInit } from "./measure.js";
export { quantities, unitFor } from "./quantity.js";
export type { Quantity, QuantityKind } from "./quantity.js";
