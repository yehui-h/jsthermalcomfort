import { scaleFromEdges } from "./interval.js";
import type { IntervalScale } from "./interval.js";

/**
 * The seven-point thermal sensation scale.
 *
 * Transcribed from pythermalcomfort 4.4.2 — the dictionary is byte-identical in
 * `models/pmv_ppd_iso.py:205` and `models/pmv_ppd_ashrae.py:229`:
 *
 * ```python
 * thermal_sensation = {
 *     -2.5: "Cold", -1.5: "Cool", -0.5: "Slightly Cool", 0.5: "Neutral",
 *     1.5: "Slightly Warm", 2.5: "Warm", 10: "Hot",
 * }
 * ```
 *
 * `10` is a sentinel top edge, not a physical limit: a PMV at or beyond it
 * belongs to no band.
 */
const THERMAL_SENSATION_EDGES = [-2.5, -1.5, -0.5, 0.5, 1.5, 2.5, 10] as const;

/** Title case on both words, exactly as upstream spells them. */
const THERMAL_SENSATION_LABELS = [
  "Cold",
  "Cool",
  "Slightly Cool",
  "Neutral",
  "Slightly Warm",
  "Warm",
  "Hot",
] as const;

/**
 * ISO 7730 thermal sensation, **left-closed** — `[-1.5, -0.5)` is
 * "Slightly Cool".
 *
 * pythermalcomfort calls `mapping(pmv, thermal_sensation, right=False)`
 * (`models/pmv_ppd_iso.py:218`).
 *
 * @public
 */
export const isoThermalSensation: IntervalScale = scaleFromEdges(
  THERMAL_SENSATION_EDGES,
  THERMAL_SENSATION_LABELS,
  "leftClosed",
);

/**
 * ASHRAE 55 thermal sensation, **right-closed** — `(-1.5, -0.5]` is
 * "Slightly Cool".
 *
 * pythermalcomfort calls `mapping(pmv_array, thermal_sensation)`
 * (`models/pmv_ppd_ashrae.py:243`), leaving `right` at its default `True`.
 *
 * The two standards share one table but close it from opposite sides. At
 * exactly `pmv = -0.5` ISO says "Neutral" and ASHRAE says "Slightly Cool".
 * That difference is real and undocumented upstream; it is preserved here
 * rather than normalised away.
 *
 * @public
 */
export const ashraeThermalSensation: IntervalScale = scaleFromEdges(
  THERMAL_SENSATION_EDGES,
  THERMAL_SENSATION_LABELS,
  "rightClosed",
);
