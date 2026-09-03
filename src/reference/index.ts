/**
 * Applicability limits, comfort bands and acceptability offsets, exported as
 * plain data.
 *
 * These are the numbers a consuming tool needs in order to draw a legend, label
 * a result, or shade a chart — the CBE Comfort Tool being the motivating case.
 * Exposing them here means every consumer reads one definition instead of
 * transcribing thresholds into its own source.
 *
 * Nothing here participates in a calculation: the model functions are untouched
 * and their return values are unchanged.
 *
 * @module
 */
export { LabeledInterval, IntervalScale, scaleFromEdges } from "./interval.js";
export type { Bound, ScaleClosure } from "./interval.js";
export { isoThermalSensation, ashraeThermalSensation } from "./bands.js";
export {
  adaptiveAshraeOffsets,
  adaptiveEnOffsets,
  adaptiveCoolingEffectSteps,
  adaptiveCoolingEffectMinOperative,
} from "./offsets.js";
export type { AdaptiveOffset } from "./offsets.js";
export { enCategoryPmvLimits } from "./limits.js";
