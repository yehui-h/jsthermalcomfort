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
 * **Source, not mirror.** `adaptive_ashrae_with_warnings`
 * (`src/models/adaptive_ashrae.ts`) computes its four bounds as
 * `tmp_cmf + low` / `tmp_cmf + up + ce` straight off this table, so the numbers
 * exist once. Both bands are symmetric before `ce` is applied.
 *
 * Declared as a tuple so the model can name its two bands by position without
 * a possibly-undefined index.
 *
 * @public
 */
export const adaptiveAshraeOffsets = [
  { label: "80%", low: -3.5, up: 3.5 },
  { label: "90%", low: -2.5, up: 2.5 },
] as const satisfies readonly AdaptiveOffset[];

/**
 * EN 16798-1 adaptive comfort categories.
 *
 * **Source, not mirror** — same arrangement as {@link adaptiveAshraeOffsets}:
 * `adaptive_en` (`src/models/adaptive_en.ts`) reads its six bounds from here.
 *
 * Unlike ASHRAE these are **inherently asymmetric** — every category reaches
 * 1 K further below the neutral temperature than above it, before the cooling
 * effect is even applied — and the three categories are nested: I ⊂ II ⊂ III.
 *
 * @public
 */
export const adaptiveEnOffsets = [
  { label: "Category I", low: -3.0, up: 2.0 },
  { label: "Category II", low: -4.0, up: 3.0 },
  { label: "Category III", low: -5.0, up: 4.0 },
] as const satisfies readonly AdaptiveOffset[];

/**
 * Steps of the adaptive cooling effect of elevated air speed.
 *
 * **Source, not mirror**: `get_ce` (`src/models/adaptive_en.ts`) walks this
 * table rather than repeating the pairs as an if/else ladder. Ascending by
 * `minAirSpeed`, and read as "the last step the air speed reaches" — so below
 * the first step the effect is zero.
 *
 * Only applied when the operative temperature is at or above
 * {@link adaptiveCoolingEffectMinOperative}.
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

/**
 * Operative temperature at or above which the cooling effect applies, [°C].
 *
 * **Source, not mirror**: both the `get_ce` guard in
 * `src/models/adaptive_en.ts` and the kink in the adaptive chart geometry read
 * this constant.
 */
export const adaptiveCoolingEffectMinOperative = 25.0;
