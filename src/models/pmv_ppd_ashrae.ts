import { ashraeThermalSensation } from "../reference/bands.js";
import { ashrae55PmvLimits } from "../reference/limits.js";
import { standards } from "../reference/standards.js";
import { LabeledInterval } from "../reference/interval.js";
import { pmv_ppd } from "./pmv_ppd.js";
import type { PmvPpdKwargs, PmvPpdResult } from "./pmv_ppd.js";

/**
 * The ASHRAE 55 editions {@link pmv_ppd_ashrae} implements.
 *
 * Published as data for the same reason as `PMV_PPD_ISO_EDITIONS`: a consumer
 * offering an edition picker reads the list rather than transcribing it. There
 * is only one today; upstream's `Models` enum lists the same single value.
 *
 * @public
 */
export const PMV_PPD_ASHRAE_EDITIONS = ["55-2023"] as const;

/**
 * An ASHRAE 55 edition.
 *
 * **Naming deviation from upstream**, deliberate: pythermalcomfort spells this
 * parameter `model` (`pythermalcomfort/models/pmv_ppd_ashrae.py`). In this
 * package and in its consumers `model` already means "a model function", so
 * `model: "55-2023"` reads as a category error.
 *
 * @public
 */
export type PmvPpdAshraeEdition = (typeof PMV_PPD_ASHRAE_EDITIONS)[number];

/**
 * Optional overrides accepted by {@link pmv_ppd_ashrae}: everything
 * `pmv_ppd` takes, plus the edition of the standard being applied.
 */
export type PmvPpdAshraeKwargs = PmvPpdKwargs & {
  /** ASHRAE 55 edition. Default `"55-2023"`, the only one implemented. */
  edition?: PmvPpdAshraeEdition;
};

/**
 * Calculate PMV and PPD in accordance with ASHRAE 55.
 *
 * Delegates to the shared `pmv_ppd` kernel with the standard fixed to
 * `'ASHRAE'`, which
 * also validates every argument. The ASHRAE equation applies a cooling effect
 * (via SET) before computing PMV — this lowers the result compared to the raw
 * ISO equation when elevated air speed is present.
 *
 * Valid ASHRAE 55 input ranges (when `limit_inputs` is true):
 * - 10 < tdb [°C] < 40
 * - 10 < tr  [°C] < 40
 * -  0 < vr  [m/s] < 2
 * -  1 < met [met] < 4
 * -  0 < clo [clo] < 1.5
 *
 * @param tdb - Dry-bulb air temperature [°C] (or [°F] if units = 'IP')
 * @param tr - Mean radiant temperature [°C] (or [°F] if units = 'IP')
 * @param vr - Relative air speed [m/s] (or [fps] if units = 'IP')
 * @param rh - Relative humidity [%]
 * @param met - Metabolic rate [met]
 * @param clo - Clothing insulation [clo]
 * @param wme - External work [met]
 * @param kwargs - Optional overrides; see {@link PmvPpdAshraeKwargs}
 * @returns PMV and PPD values
 *
 * @public
 * @category Models
 *
 * @example
 * const r = pmv_ppd_ashrae(25, 25, 0.1, 50, 1.2, 0.5);
 * console.log(r.pmv); // 0.08
 * console.log(r.ppd); // 5.1
 */
export function pmv_ppd_ashrae(
  tdb: number,
  tr: number,
  vr: number,
  rh: number,
  met: number,
  clo: number,
  wme = 0,
  kwargs: PmvPpdAshraeKwargs = {},
): PmvPpdResult {
  // Checked here, not forwarded — see the note in `pmv_ppd_iso`.
  const { edition = "55-2023", ...rest } = kwargs;
  if (!PMV_PPD_ASHRAE_EDITIONS.includes(edition))
    throw new Error(
      `Edition '${edition}' is not supported. Supported editions are: ${PMV_PPD_ASHRAE_EDITIONS.join(", ")}.`,
    );
  return pmv_ppd(tdb, tr, vr, rh, met, clo, wme, "ASHRAE", rest);
}

// Metadata, not behaviour — see the note on pmv_ppd_iso.
pmv_ppd_ashrae.label = "PMV / PPD (ASHRAE 55)";
pmv_ppd_ashrae.description =
  "Predicted Mean Vote and Predicted Percentage of Dissatisfied per ASHRAE 55.";
/**
 * Thermal sensation scale, left-closed: `[-1.5, -0.5)` is "Slightly Cool" —
 * the same closure as ISO's. See the provenance note on
 * `ashraeThermalSensation` (`src/reference/bands.ts`) for why this diverges
 * from upstream's current behaviour.
 */
pmv_ppd_ashrae.tsv = ashraeThermalSensation;
pmv_ppd_ashrae.standard = standards.ashrae55;
/** The ranges outside which this model warns and, by default, returns NaN. */
pmv_ppd_ashrae.limits = ashrae55PmvLimits;
/** The editions `kwargs.edition` accepts; the last is the default. */
pmv_ppd_ashrae.editions = PMV_PPD_ASHRAE_EDITIONS;
/**
 * The compliance range, **open at both ends** — pythermalcomfort computes it as
 * `(pmv > -0.5) & (pmv < 0.5)` (`models/pmv_ppd_ashrae.py:194`), so a PMV of
 * exactly ±0.5 is not compliant.
 */
pmv_ppd_ashrae.compliance = new LabeledInterval(
  "Compliant",
  { value: -0.5, inclusive: false },
  { value: 0.5, inclusive: false },
);
