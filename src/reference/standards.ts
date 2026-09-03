/**
 * A standard a model implements.
 *
 * Deliberately not named `Standard`: `check_standard_compliance` already has a
 * type by that name (`src/utilities/utilities.ts`) whose members are dispatch
 * keys for the applicability checks, not standards a model belongs to —
 * EN 16798-1 has no check at all. The two are different sets and must not be
 * merged.
 *
 * @public
 */
export interface StandardRef {
  /** Stable identifier, safe to put in a URL or a saved document. */
  readonly id: string;
  /** Human-readable name, e.g. `"ASHRAE 55"`. */
  readonly name: string;
}

/**
 * The standards the models in this package implement.
 *
 * Referenced by identity: a consumer grouping models by standard compares
 * `model.standard === standards.ashrae55`, never a string.
 *
 * @public
 */
export const standards = {
  iso7730: { id: "iso7730", name: "ISO 7730" },
  ashrae55: { id: "ashrae55", name: "ASHRAE 55" },
  en16798: { id: "en16798", name: "EN 16798-1" },
} as const satisfies Record<string, StandardRef>;
