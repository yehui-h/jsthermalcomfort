/**
 * The PMV magnitude each EN 16798-1 category allows.
 *
 * These are what the CBE Thermal Comfort Tool passes to its comfort-zone
 * solver, one call per category (`static/js/EN/psych-chart-en.js`,
 * `drawComfortRegions`), and they nest: Category I is the innermost zone.
 *
 * The labels match {@link adaptiveEnOffsets}, so the same category can be
 * named consistently whether it is drawn on a psychrometric chart or an
 * adaptive one.
 *
 * @public
 */
export const enCategoryPmvLimits: readonly {
  readonly label: string;
  /** Comfort holds while |PMV| stays below this. */
  readonly pmvLimit: number;
}[] = [
  { label: "Category I", pmvLimit: 0.2 },
  { label: "Category II", pmvLimit: 0.5 },
  { label: "Category III", pmvLimit: 0.7 },
];
