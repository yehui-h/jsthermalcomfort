/**
 * How far an adaptive comfort band sits from the neutral comfort temperature.
 *
 * The upper bound additionally gains the elevated-air-speed cooling effect at
 * evaluation time, so a band is only symmetric when that effect is zero.
 *
 * @public
 */
export interface AdaptiveOffset {
  readonly label: string;
  /** Added to `tmp_cmf` for the lower bound. Negative. */
  readonly low: number;
  /** Added to `tmp_cmf` for the upper bound, before the cooling effect. */
  readonly up: number;
}

/**
 * ASHRAE 55 adaptive acceptability bands.
 *
 * From `src/models/adaptive_ashrae.ts`:
 * ```
 * tmp_cmf_80_low = t_cmf - 3.5;   tmp_cmf_80_up = t_cmf + 3.5 + ce;
 * tmp_cmf_90_low = t_cmf - 2.5;   tmp_cmf_90_up = t_cmf + 2.5 + ce;
 * ```
 * Both are symmetric before `ce` is applied.
 *
 * @public
 */
export const adaptiveAshraeOffsets: readonly AdaptiveOffset[] = [
  { label: "80%", low: -3.5, up: 3.5 },
  { label: "90%", low: -2.5, up: 2.5 },
];

/**
 * EN 16798-1 adaptive comfort categories.
 *
 * From `src/models/adaptive_en.ts`. Unlike ASHRAE these are **inherently
 * asymmetric** — every category reaches 1 K further below the neutral
 * temperature than above it, before the cooling effect is even applied — and
 * the three categories are nested: I ⊂ II ⊂ III.
 *
 * @public
 */
export const adaptiveEnOffsets: readonly AdaptiveOffset[] = [
  { label: "Category I", low: -3.0, up: 2.0 },
  { label: "Category II", low: -4.0, up: 3.0 },
  { label: "Category III", low: -5.0, up: 4.0 },
];

/**
 * Steps of the adaptive cooling effect of elevated air speed, as implemented by
 * `get_ce` in `src/models/adaptive_en.ts`.
 *
 * Only applied when the operative temperature is at or above
 * {@link adaptiveCoolingEffectMinOperative}; below the first air-speed step the
 * effect is zero.
 *
 * @public
 */
export const adaptiveCoolingEffectSteps: readonly {
  readonly minAirSpeed: number;
  readonly coolingEffect: number;
}[] = [
  { minAirSpeed: 0.6, coolingEffect: 1.2 },
  { minAirSpeed: 0.9, coolingEffect: 1.8 },
  { minAirSpeed: 1.2, coolingEffect: 2.2 },
];

/** Operative temperature at or above which the cooling effect applies, [°C]. */
export const adaptiveCoolingEffectMinOperative = 25.0;
