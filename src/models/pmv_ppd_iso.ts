import { isoThermalSensation } from "../reference/bands.js";
import { iso7730PmvLimits } from "../reference/limits.js";
import { standards } from "../reference/standards.js";
import { pmv_ppd } from "./pmv_ppd.js";
import type { PmvPpdKwargs, PmvPpdResult } from "./pmv_ppd.js";

/**
 * The ISO 7730 editions {@link pmv_ppd_iso} implements, newest last.
 *
 * Published as data so a consumer offering an edition picker reads the list
 * rather than transcribing it.
 *
 * @public
 */
export const PMV_PPD_ISO_EDITIONS = ["7730-2005", "7730-2025"] as const;

/**
 * An ISO 7730 edition.
 *
 * **Naming deviation from upstream**, deliberate: pythermalcomfort spells this
 * parameter `model` (`pythermalcomfort/models/pmv_ppd_iso.py`). In this
 * package and in its consumers `model` already means "a model function", so
 * `model: "7730-2005"` reads as a category error.
 *
 * @public
 */
export type PmvPpdIsoEdition = (typeof PMV_PPD_ISO_EDITIONS)[number];

/**
 * The edition {@link pmv_ppd_iso} applies when none is asked for: the newest,
 * as upstream. Spelled once, here; the `io` layer reads it rather than
 * repeating it. Consumers read `pmv_ppd_iso.editions` — the last entry is the
 * default.
 *
 * @internal
 */
export const PMV_PPD_ISO_DEFAULT_EDITION: PmvPpdIsoEdition = "7730-2025";

/**
 * Rejects an edition this package does not implement.
 *
 * Shared by {@link pmv_ppd_iso} and the `io` layer, which runs the kernel
 * directly for its warnings and would otherwise bypass this check.
 *
 * @internal
 */
export function assert_pmv_ppd_iso_edition(
  edition: string,
): asserts edition is PmvPpdIsoEdition {
  if (!(PMV_PPD_ISO_EDITIONS as readonly string[]).includes(edition))
    throw new Error(
      `Edition '${edition}' is not supported. Supported editions are: ${PMV_PPD_ISO_EDITIONS.join(", ")}.`,
    );
}

/**
 * Optional overrides accepted by {@link pmv_ppd_iso}: everything
 * `pmv_ppd` takes except the ASHRAE-only `airspeed_control`, plus the
 * edition of the standard being applied.
 */
export type PmvPpdIsoKwargs = Omit<PmvPpdKwargs, "airspeed_control"> & {
  /**
   * ISO 7730 edition. Default {@link PMV_PPD_ISO_DEFAULT_EDITION}, as upstream.
   *
   * The two editions currently run the same kernel over the same limits, so
   * this changes no numbers — it exists so a result can say which edition it
   * was computed under.
   */
  edition?: PmvPpdIsoEdition;
};

/**
 * Calculate PMV and PPD in accordance with ISO 7730.
 *
 * Delegates to the shared `pmv_ppd` kernel with the standard fixed to
 * `'ISO'`, which also
 * validates every argument. The ISO equation uses Fanger's original PMV
 * formulation without the ASHRAE cooling-effect adjustment.
 *
 * ISO 7730 applies stricter input limits than ASHRAE 55. When
 * `limit_inputs` is true (the default), inputs outside the following
 * ranges cause the function to return NaN:
 * - 10 < tdb [°C] < 30
 * - 10 < tr  [°C] < 40
 * -  0 < vr  [m/s] < 1
 * - 0.8 < met [met] < 4
 * -  0 < clo [clo] < 2
 * -  0 < pa  [Pa] < 2700 (the vapour pressure derived from tdb and rh)
 * - -2 < PMV < 2 (result is clamped to NaN outside this range)
 *
 * All seven are published as data in `reference.iso7730PmvLimits`.
 *
 * @param tdb - Dry-bulb air temperature [°C] (or [°F] if units = 'IP')
 * @param tr - Mean radiant temperature [°C] (or [°F] if units = 'IP')
 * @param vr - Relative air speed [m/s] (or [fps] if units = 'IP')
 * @param rh - Relative humidity [%]
 * @param met - Metabolic rate [met]
 * @param clo - Clothing insulation [clo]
 * @param wme - External work [met]
 * @param kwargs - Optional overrides; see {@link PmvPpdIsoKwargs}
 * @returns PMV and PPD values
 *
 * @public
 * @category Models
 *
 * @example
 * const r = pmv_ppd_iso(25, 25, 0.1, 50, 1.2, 0.5);
 * console.log(r.pmv); // 0.08
 * console.log(r.ppd); // 5.1
 */
export function pmv_ppd_iso(
  tdb: number,
  tr: number,
  vr: number,
  rh: number,
  met: number,
  clo: number,
  wme = 0,
  kwargs: PmvPpdIsoKwargs = {},
): PmvPpdResult {
  // `edition` is checked here and not forwarded: it selects which edition the
  // result is reported under, and both run the same kernel over the same
  // limits, so nothing downstream needs to see it.
  const { edition = PMV_PPD_ISO_DEFAULT_EDITION, ...rest } = kwargs;
  assert_pmv_ppd_iso_edition(edition);
  return pmv_ppd(tdb, tr, vr, rh, met, clo, wme, "ISO", rest);
}

// Metadata, not behaviour: attaching these leaves the function's arguments and
// return value untouched (pinned by tests/baseline.test.ts). They exist so a
// consuming tool can label and shade a result without transcribing the bands.
pmv_ppd_iso.label = "PMV / PPD (ISO 7730)";
pmv_ppd_iso.description =
  "Predicted Mean Vote and Predicted Percentage of Dissatisfied per ISO 7730.";
/** Thermal sensation scale, left-closed: `[-1.5, -0.5)` is "Slightly Cool". */
pmv_ppd_iso.tsv = isoThermalSensation;
pmv_ppd_iso.standard = standards.iso7730;
/** The ranges outside which this model warns and, by default, returns NaN. */
pmv_ppd_iso.limits = iso7730PmvLimits;
/** The editions `kwargs.edition` accepts; the last is the default. */
pmv_ppd_iso.editions = PMV_PPD_ISO_EDITIONS;
