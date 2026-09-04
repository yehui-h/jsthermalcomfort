import { scaleFromEdges } from "./interval.js";
import type { IntervalScale } from "./interval.js";

/**
 * The seven-point thermal sensation scale.
 *
 * Transcribed from pythermalcomfort — the `thermal_sensation` dictionary is
 * byte-identical in `models/pmv_ppd_iso.py` and `models/pmv_ppd_ashrae.py`:
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
 * ASHRAE 55 thermal sensation, **left-closed** — the same closure as
 * {@link isoThermalSensation}, so `pmv = -0.5` is "Neutral" under both
 * standards.
 *
 * **Deliberate divergence from upstream's current behaviour**, and the one
 * place in this package where following pythermalcomfort literally would
 * reproduce a bug rather than a decision. pythermalcomfort today calls
 * `mapping(pmv_array, thermal_sensation)` (`models/pmv_ppd_ashrae.py:243`),
 * leaving `right` at its default `True`, which reads the bands right-closed.
 * Its history shows that is an accident, not a reading of ASHRAE 55:
 *
 * - `cfebb56` ("feat: pmv_ppd functions now return thermal sensation")
 *   introduced `tsv` on **both** models with `right=False`.
 * - `ac50f1c` ("refactor(pmv_ppd): Enhance compliance calculation and input
 *   handling") hoisted the ASHRAE call into a local variable and dropped
 *   `right=False` on the way. The commit is about compliance handling and says
 *   nothing about thermal sensation.
 * - `4ef336c` (14:28 the same day) inlined that local back, carrying the loss
 *   into the current source. ISO's `right=False` was never touched.
 * - `07b0746` (15:00, "test(tests): Update expected value in ASHRAE tests")
 *   then edited the one assertion that crosses a band edge —
 *   `test_thermal_sensation` probes `tdb = 33.47` / `33.46`, which straddle
 *   `pmv = 2.5` — flipping its expected label from "Hot" to "Warm".
 *
 * So the flag was dropped in a refactor that mentions nothing about thermal
 * sensation, the only test that could see it went red within the hour, and the
 * expectation was rewritten rather than the flag restored. That is the shape of
 * an unintended change, not a decision about the standard.
 *
 * **The consequence to be aware of:** this scale therefore disagrees with that
 * upstream test. At `pmv = 2.5` it says "Hot" where pythermalcomfort now says
 * "Warm" — which is what pythermalcomfort itself expected before `07b0746`.
 * ASHRAE 55 publishes no rule that its seven-point scale closes from the right,
 * and the band table is byte identical to ISO's, so there is nothing in either
 * standard for the asymmetry to express; reproducing it would make the two
 * standards' pages disagree at six shared boundaries for no citable reason.
 *
 * @public
 */
export const ashraeThermalSensation: IntervalScale = scaleFromEdges(
  THERMAL_SENSATION_EDGES,
  THERMAL_SENSATION_LABELS,
  "leftClosed",
);
