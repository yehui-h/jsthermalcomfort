/**
 * Chart geometry: the comfort zones a tool draws, computed rather than
 * hard-coded.
 *
 * Two shapes, with very different costs. The adaptive bands are affine in the
 * running mean temperature, so two endpoints determine each boundary exactly
 * ({@link adaptiveAshraeZone}, {@link adaptiveEnZone}). A PMV comfort zone is
 * not a model output at all and has to be solved for, humidity row by humidity
 * row ({@link psychrometricZone}).
 *
 * The algorithms are ported from the CBE Thermal Comfort Tool as deployed at
 * comfort.cbe.berkeley.edu, so that a consumer can reproduce the published
 * charts; where that implementation is wrong, the defect is reproduced by
 * default and corrected on request
 * ({@link PsychrometricZoneOptions.correctKnownDefects}).
 *
 * Everything here is SI, unclipped and unstyled: unit conversion, viewport
 * clipping and colour are the caller's.
 *
 * @module
 */
export { psychrometricZone } from "./comfort_zone.js";
export type {
  PsychrometricPoint,
  PsychrometricZone,
  PsychrometricZoneOptions,
  UnsolvedRow,
} from "./comfort_zone.js";
export { adaptiveAshraeZone, adaptiveEnZone } from "./adaptive_zone.js";
export type {
  AdaptiveBand,
  AdaptivePoint,
  AdaptiveZoneOptions,
} from "./adaptive_zone.js";
export { NO_ROOT_FOUND, bisect, secant } from "./root_finding.js";
export type { SecantOptions } from "./root_finding.js";
