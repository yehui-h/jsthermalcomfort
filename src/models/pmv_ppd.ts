import {
  UNIT_SYSTEMS,
  check_standard_compliance,
  round,
  units_converter,
  validateInputs,
} from "../utilities/utilities.js";
import type { UnitSystem, ValidationSchema } from "../utilities/utilities.js";
import { antoine } from "../psychrometrics/antoine.js";
import {
  iso7730PmvRangeLimit,
  iso7730VapourPressureLimit,
} from "../reference/limits.js";
import { cooling_effect } from "./cooling_effect.js";

/** Comfort standard selecting the PMV formulation. */
export type PmvPpdStandard = "ISO" | "ASHRAE";

/**
 * Optional overrides accepted by `pmv_ppd` and by the two models that
 * delegate to it, {@link pmv_ppd_iso} and {@link pmv_ppd_ashrae}.
 *
 * @public
 */
export interface PmvPpdKwargs {
  /** Select the SI (International System of Units) or the IP (Imperial Units) system. Default `'SI'`. */
  units?: UnitSystem;
  /**
   * Default is true. By default, if the inputs are outside the standard
   * applicability limits the function returns NaN. If false, returns pmv and
   * ppd values even if input values are outside the applicability limits of
   * the model.
   *
   * The ASHRAE 55 2020 limits are 10 < tdb [°C] < 40, 10 < tr [°C] < 40,
   * 0 < vr [m/s] < 2, 1 < met [met] < 4, and 0 < clo [clo] < 1.5.
   * The ISO 7730 2005 limits are 10 < tdb [°C] < 30, 10 < tr [°C] < 40,
   * 0 < vr [m/s] < 1, 0.8 < met [met] < 4, 0 < clo [clo] < 2,
   * 0 < pa [Pa] < 2700, and -2 < PMV < 2.
   *
   * Every one of these is published as data in `jsthermalcomfort/reference`
   * (`iso7730PmvLimits`, `ashrae55PmvLimits`), which is what a consumer
   * passing `false` here should gate its own inputs against.
   */
  limit_inputs?: boolean;
  /**
   * This only applies if `standard` = "ASHRAE".
   *
   * Default is true. By default, it is assumed that the occupant has control
   * over the airspeed. In this case, the ASHRAE 55 Standard does not impose
   * any airspeed limits. On the other hand, if the occupant has no control
   * over the airspeed, ASHRAE 55 imposes an upper limit for v which varies as
   * a function of the operative temperature; for more information please
   * consult the Standard.
   */
  airspeed_control?: boolean;
  /** If true, rounds pmv to 2 decimal places and ppd to 1. Default `true`. */
  round_output?: boolean;
}

/**
 * PMV and PPD as returned by {@link pmv_ppd_iso} and {@link pmv_ppd_ashrae}.
 *
 * @public
 */
export interface PmvPpdResult {
  /** Predicted Mean Vote */
  pmv: number;
  /** Predicted Percentage of Dissatisfied occupants, [%] */
  ppd: number;
}

/**
 * The call signature `pmv_ppd_iso` and `pmv_ppd_ashrae` share.
 *
 * Exists so a caller can hold either model in a typed variable and pass the
 * function itself where a standard used to be named by a string —
 * `charts.psychrometricZone` takes one of these. A model function already
 * knows which standard it applies, so nothing can disagree with it.
 *
 * `kwargs` is typed as the widest of the two: each model ignores what does not
 * apply to it (the ISO model has no `airspeed_control`), and neither takes an
 * `edition` through this type — a caller wanting a specific edition calls the
 * model directly.
 *
 * @public
 */
export type PmvPpdModel = (
  tdb: number,
  tr: number,
  vr: number,
  rh: number,
  met: number,
  clo: number,
  wme?: number,
  kwargs?: PmvPpdKwargs,
) => PmvPpdResult;

const PMV_PPD_SCHEMA = {
  tdb: { type: "number" },
  tr: { type: "number" },
  vr: { type: "number" },
  rh: { type: "number" },
  met: { type: "number" },
  clo: { type: "number" },
  wme: { type: "number" },
  standard: { enum: ["ISO", "ASHRAE"] },
  units: { enum: UNIT_SYSTEMS, required: false },
  limit_inputs: { type: "boolean", required: false },
  airspeed_control: { type: "boolean", required: false },
  round_output: { type: "boolean", required: false },
} satisfies ValidationSchema;

/**
 * Returns Predicted Mean Vote
 * ({@link https://en.wikipedia.org/wiki/Thermal_comfort#PMV/PPD_method | PMV}) and
 * Predicted Percentage of Dissatisfied
 * ({@link https://en.wikipedia.org/wiki/Thermal_comfort#PMV/PPD_method | PPD})
 * calculated in accordance with main thermal comfort Standards. The PMV is an
 * index that predicts the mean value of the thermal sensation votes
 * (self-reported perceptions) of a large group of people on a sensation scale
 * expressed from –3 to +3 corresponding to the categories: cold, cool,
 * slightly cool, neutral, slightly warm, warm, and hot [1].
 *
 * While the PMV equation is the same for both the ISO and ASHRAE standards, in
 * the ASHRAE 55 PMV equation the SET is used to calculate the cooling effect
 * first; this is then subtracted from both the air and mean radiant
 * temperatures, and the differences are used as input to the PMV model, while
 * the airspeed is set to 0.1 m/s.
 *
 * Use this function to calculate PMV and PPD in accordance with either the
 * ASHRAE 55 2020 Standard [1] or the ISO 7730 Standard [2]. This is a version
 * that supports scalar arguments.
 *
 * Two of the inputs are pre-corrected quantities, not raw sensor readings:
 *
 * - `vr` is the relative air speed caused by body movement, not the air speed
 *   measured by the sensor. It is the average air speed measured by the sensor
 *   plus the activity-generated air speed (Vag) caused by motion of individual
 *   body parts. Calculate it with `v_relative` from
 *   `jsthermalcomfort/utilities`.
 * - `clo` should be the dynamic clothing insulation. Activity and air speed
 *   both modify the insulation of the clothing and the adjacent air layer, so
 *   ISO 7730 states that the clothing insulation shall be corrected [2]. The
 *   ASHRAE 55 Standard corrects for body movement at met ≥ 1.2 using
 *   `clo = Icl × (0.6 + 0.4/met)`; ISO 7730 Annex C uses the ISO 9920:2007
 *   correction, which also needs the air speed. Calculate it with
 *   `clo_dynamic_ashrae` or `clo_dynamic_iso` from
 *   `jsthermalcomfort/utilities`.
 *
 * @param tdb - dry bulb air temperature, default in [°C] in [°F] if `units` = 'IP'
 * @param tr - mean radiant temperature, default in [°C] in [°F] if `units` = 'IP'
 * @param vr - relative air speed, default in [m/s] in [fps] if `units` = 'IP'
 * @param rh - relative humidity, [%]
 * @param met - metabolic rate
 * @param clo - clothing insulation
 * @param wme - external work
 * @param standard - comfort standard used for the calculation. If "ISO", the
 * ISO equation is used; if "ASHRAE", the ASHRAE equation is used. While the PMV
 * equation is the same for both, ASHRAE's use of the PMV model is limited to
 * air speeds below 0.10 m/s (20 fpm). When air speeds exceed 0.10 m/s (20 fpm)
 * the comfort zone boundaries are adjusted based on the SET model. This change
 * was introduced by
 * {@link https://www.ashrae.org/file%20library/technical%20resources/standards%20and%20guidelines/standards%20addenda/55_2020_c_20210430.pdf | Addendum C to Standard 55-2020}.
 * @param kwargs - additional arguments; see {@link PmvPpdKwargs}
 *
 * @returns Result of pmv and ppd
 *
 * @public
 * @category Models
 *
 * @example
 * const tdb = 25;
 * const tr = 25;
 * const rh = 50;
 * const v = 0.1;
 * const met = 1.4;
 * const clo = 0.5;
 * // Calculate relative air speed
 * const v_r = v_relative(v, met);
 * // Calculate dynamic clothing
 * const clo_d = clo_dynamic_ashrae(clo, met);
 * const results = pmv_ppd(tdb, tr, v_r, rh, met, clo_d);
 * console.log(results); // Output: { pmv: 0.06, ppd: 5.1 }
 * console.log(results.pmv); // Output: -0.06
 */
export function pmv_ppd(
  tdb: number,
  tr: number,
  vr: number,
  rh: number,
  met: number,
  clo: number,
  wme = 0,
  standard: PmvPpdStandard = "ISO",
  kwargs: PmvPpdKwargs = {},
): PmvPpdResult {
  const { pmv, ppd } = pmv_ppd_with_warnings(
    tdb,
    tr,
    vr,
    rh,
    met,
    clo,
    wme,
    standard,
    kwargs,
  );
  return { pmv, ppd };
}

/**
 * Identical to `pmv_ppd`, but also returns the applicability warnings
 * that `pmv_ppd` computes and discards.
 *
 * Also returns `pmv_unrounded`: ASHRAE 55 compliance is evaluated on the raw
 * PMV, before `round_output` rounds it (pythermalcomfort computes
 * `compliance` above its `np.round` call), so the I/O layer needs the value
 * the public return has already rounded away.
 *
 * Internal: not re-exported from `models/index.ts`. It exists so the I/O layer
 * can explain *why* a result is NaN without changing the public function's
 * return shape.
 *
 * @internal
 */
export function pmv_ppd_with_warnings(
  tdb: number,
  tr: number,
  vr: number,
  rh: number,
  met: number,
  clo: number,
  wme = 0,
  standard: PmvPpdStandard = "ISO",
  kwargs: PmvPpdKwargs = {},
): PmvPpdResult & {
  pmv_unrounded: number;
  warnings: readonly string[];
} {
  const default_kwargs: Required<PmvPpdKwargs> = {
    units: "SI",
    limit_inputs: true,
    airspeed_control: true,
    round_output: true,
  };
  const resolved: Required<PmvPpdKwargs> = Object.assign(
    default_kwargs,
    kwargs,
  );
  validateInputs(
    {
      tdb,
      tr,
      vr,
      rh,
      met,
      clo,
      wme,
      standard,
      units: resolved.units.toUpperCase(),
      limit_inputs: resolved.limit_inputs,
      airspeed_control: resolved.airspeed_control,
      round_output: resolved.round_output,
    },
    PMV_PPD_SCHEMA,
  );

  if (resolved.units.toUpperCase() === "IP") {
    // Conversion from IP to SI units
    ({ tdb, tr, vr } = units_converter({ tdb, tr, vr }, "IP"));
  }

  const compliance_warnings = check_standard_compliance(standard, {
    tdb,
    tr,
    v: vr,
    met,
    clo,
    airspeed_control: resolved.airspeed_control,
  });
  let ce = 0;
  if (standard === "ASHRAE") {
    //if v_r is higher than 0.1 follow methodology ASHRAE Appendix H, H3
    ce = vr > 0.1 ? cooling_effect(tdb, tr, vr, rh, met, clo, wme).ce : 0;
  }

  tdb = tdb - ce;
  tr = tr - ce;
  vr = ce > 0 ? 0.1 : vr;

  let pmv = pmv_calculation(tdb, tr, vr, rh, met, clo, wme);
  let ppd =
    100.0 -
    95.0 *
      Math.exp(-0.03353 * Math.pow(pmv, 4.0) - 0.2179 * Math.pow(pmv, 2.0));

  // Checks that inputs are within the bounds accepted by the model if not return NaN
  if (resolved.limit_inputs) {
    // ISO 7730 Clause 4 bounds two more quantities that `check_standard_compliance`
    // cannot see, because neither is an argument: the vapour pressure the model
    // derives, and the PMV it returns. Upstream checks both inline in
    // `pythermalcomfort/models/pmv_ppd_iso.py`; here the bounds are read from
    // the published table so there is still one copy of each number. ASHRAE 55
    // has neither bound, so both apply to ISO only.
    const iso_only_warnings: string[] = [];
    if (standard === "ISO") {
      const pa = rh * 10 * antoine(tdb);
      if (
        pa < iso7730VapourPressureLimit.min ||
        pa > iso7730VapourPressureLimit.max
      )
        iso_only_warnings.push(iso7730VapourPressureLimit.warning);
      if (!(pmv >= iso7730PmvRangeLimit.min && pmv <= iso7730PmvRangeLimit.max))
        iso_only_warnings.push(iso7730PmvRangeLimit.warning);
    }

    if (
      isNaN(pmv) ||
      compliance_warnings.length > 0 ||
      iso_only_warnings.length > 0
    ) {
      pmv = NaN;
      ppd = NaN;
    }
    compliance_warnings.push(...iso_only_warnings);
  }

  if (resolved.round_output) {
    return {
      pmv: round(pmv, 2),
      ppd: round(ppd, 1),
      pmv_unrounded: pmv,
      warnings: compliance_warnings,
    };
  }
  return { pmv, ppd, pmv_unrounded: pmv, warnings: compliance_warnings };
}

/**
 * Fanger's PMV equation itself, on SI inputs that have already been unit
 * converted and (for ASHRAE) cooling-effect adjusted by the caller.
 *
 * @returns the unrounded PMV
 *
 * @internal
 */
export function pmv_calculation(
  tdb: number,
  tr: number,
  vr: number,
  rh: number,
  met: number,
  clo: number,
  wme: number,
): number {
  // `antoine` returns kPa, so × 10 turns an rh in [%] into a partial pressure
  // in [Pa]. Upstream spells the same product the same way.
  const pa = rh * 10 * antoine(tdb);

  const icl = 0.155 * clo; //thermal insulation of the clothing in M2K/W
  const m = met * 58.15; //metabolic rate in W/M2
  const w = wme * 58.15; //external work in W/M2
  const mw = m - w; //internal heat production in the human body

  //calculation of the clothing area factor
  let f_cl;
  if (icl <= 0.078) {
    f_cl = 1 + 1.29 * icl; // ratio of surface clothed body over nude body
  } else {
    f_cl = 1.05 + 0.645 * icl;
  }

  //heat transfer coefficient by forced convection
  const hcf = 12.1 * Math.sqrt(vr);
  let hc = hcf;

  const taa = tdb + 273;
  const tra = tr + 273;
  // Initial guess for the clothing surface temperature. Upstream writes it
  // `3.5 * (6.45 * icl + 0.1)` — the ISO 7730:2025 Annex D form it adopted in
  // commit 4051929, which calls the change "output-neutral". It is not: with
  // `eps` below, the two spellings give a different unrounded PMV on 86% of a
  // 33 750-point grid, by up to 5.1e-3. That is mostly absorbed by the
  // two-decimal rounding this function applies — the published `pmv_ppd_iso`
  // result differs on 1.0% of the same grid — but not always, and it flips
  // results either side of the ±2 applicability bound.
  //
  // Neither is more accurate. Converged tightly (eps 1e-12) both reach the
  // same fixed point to 3.4e-11, and against that fixed point the loose-eps
  // error is 7.189e-3 for this spelling and 7.210e-3 for upstream's. What the
  // difference actually measures is `eps`, not the guess — see below.
  //
  // This spelling is kept because it is the one the deployed CBE Thermal
  // Comfort Tool uses: `tests/charts.test.ts` reproduces that tool's ISO
  // comfort-zone geometry exactly (1e-9 °C), and upstream's spelling moves the
  // boundary by 1.0e-2 °C. Adopting it would forfeit that parity and buy no
  // accuracy.
  const t_cla = taa + (35.5 - tdb) / (3.5 * icl + 0.1);

  const p1 = icl * f_cl;
  const p2 = p1 * 3.96;
  const p3 = p1 * 100;
  const p4 = p1 * taa;
  const p5 = 308.7 - 0.028 * mw + p2 * Math.pow(tra / 100.0, 4);
  let xn = t_cla / 100;
  let xf = t_cla / 50;
  // ponytail: ISO 7730 Annex D's own tolerance, shared with pythermalcomfort.
  // It is loose enough to leave up to 7.2e-3 of error in the returned PMV —
  // larger than the 5e-3 half-width of the two-decimal rounding applied to the
  // result, so it can move the last reported digit. Tightening it is the only
  // change that would buy real accuracy here, and the reason not to is that it
  // would diverge from pythermalcomfort, from jsthermalcomfort 1.4.0 and from
  // the deployed CBE tool at once, all three of which use this value.
  const eps = 0.00015;

  let n = 0;

  while (Math.abs(xn - xf) > eps) {
    xf = (xf + xn) / 2;
    const hcn = 2.38 * Math.pow(Math.abs(100.0 * xf - taa), 0.25);
    if (hcf > hcn) {
      hc = hcf;
    } else {
      hc = hcn;
    }
    xn = (p5 + p4 * hc - p2 * Math.pow(xf, 4)) / (100 + p3 * hc);
    n += 1;
    if (n > 150) {
      throw new Error("Max iterations exceeded");
    }
  }

  const tcl = 100 * xn - 273;
  //heat loss diff. through skin
  const hl1 = 3.05 * 0.001 * (5733 - 6.99 * mw - pa);
  //heat loss by sweating
  let hl2;
  if (mw > 58.15) {
    hl2 = 0.42 * (mw - 58.15);
  } else {
    hl2 = 0;
  }
  //latent respiration heat loss
  const hl3 = 1.7 * 0.00001 * m * (5867 - pa);
  //dry respiration heat loss
  const hl4 = 0.0014 * m * (34 - tdb);
  //heat loss by radiation
  const hl5 = 3.96 * f_cl * (Math.pow(xn, 4) - Math.pow(tra / 100.0, 4));
  //heat loss by convection
  const hl6 = f_cl * hc * (tcl - tdb);

  const ts = 0.303 * Math.exp(-0.036 * m) + 0.028;

  return ts * (mw - hl1 - hl2 - hl3 - hl4 - hl5 - hl6);
}
