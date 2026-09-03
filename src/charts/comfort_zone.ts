import { pmv_ppd } from "../models/pmv_ppd.js";
import { psy_ta_rh } from "../psychrometrics/psy_ta_rh.js";
import { NO_ROOT_FOUND, bisect, secant } from "./root_finding.js";
import type { PmvPpdStandard } from "../models/pmv_ppd.js";

/** A point on a psychrometric chart, in SI units. */
export interface PsychrometricPoint {
  /** Dry-bulb air temperature, [°C]. */
  readonly db: number;
  /** Humidity ratio, [kg water / kg dry air]. */
  readonly hr: number;
  /** The relative humidity this point was solved at, [%]. */
  readonly rh: number;
}

/** A row of the zone where the solver did not find a root. */
export interface UnsolvedRow {
  /** Relative humidity, [%]. */
  readonly rh: number;
  /** The PMV the solver was looking for. */
  readonly target: number;
  /**
   * What the solver returned: NaN from the secant method, or
   * {@link NO_ROOT_FOUND} from the bisection fallback.
   */
  readonly db: number;
}

/** A comfort zone traced on a psychrometric chart. */
export interface PsychrometricZone {
  /** The |PMV| the edges were solved at. */
  readonly pmvLimit: number;
  readonly standard: PmvPpdStandard;
  /** The `PMV = -pmvLimit` edge, in ascending relative humidity. */
  readonly coolEdge: readonly PsychrometricPoint[];
  /** The saturation line between the two edges, in ascending temperature. */
  readonly saturationEdge: readonly PsychrometricPoint[];
  /**
   * The `PMV = +pmvLimit` edge, also in ascending relative humidity — so that
   * two zones solved at different limits can be compared row by row, and so
   * adjacent bands share vertices along the same isopleth.
   */
  readonly warmEdge: readonly PsychrometricPoint[];
  /**
   * The closed polygon, in the order the CBE tool draws it: cool edge upward,
   * along the saturation line, warm edge back down.
   */
  readonly polygon: readonly PsychrometricPoint[];
  /**
   * Rows where no root was found. Reported rather than clamped or dropped: the
   * points are still in the edges, carrying whatever the solver returned, so a
   * caller decides what to do about them.
   */
  readonly unsolved: readonly UnsolvedRow[];
}

/** Arguments to {@link psychrometricZone}. */
export interface PsychrometricZoneOptions {
  /** Mean radiant temperature, [°C]. */
  readonly tr: number;
  /**
   * Relative air speed, [m/s] — `v_relative` already applied, as everywhere
   * else in this package. The CBE tool applies it inside its PMV wrapper
   * instead, so a caller reproducing its chart must apply it first.
   */
  readonly vr: number;
  /** Metabolic rate, [met]. */
  readonly met: number;
  /** Dynamic clothing insulation, [clo] — `clo_dynamic` already applied. */
  readonly clo: number;
  /** External work, [met]. Default `0`. */
  readonly wme?: number;
  /** The |PMV| to trace. Default `0.5`. */
  readonly pmvLimit?: number;
  /**
   * `'ASHRAE'` applies the elevated-air-speed cooling effect, `'ISO'` uses
   * Fanger's equation unmodified. Default `'ASHRAE'`, matching the tool's main
   * psychrometric chart; its EN chart is the `'ISO'` case.
   */
  readonly standard?: PmvPpdStandard;
  /** Relative humidity step between rows, [%]. Default `10`. */
  readonly rhStep?: number;
  /** Temperature step along the saturation line, [°C]. Default `0.5`. */
  readonly saturationStep?: number;
  /**
   * The residual the root finder accepts. Default `0.001`.
   *
   * This is a **PMV** residual, not a temperature tolerance — the upstream
   * comment calls it "ta precision", which it is not.
   */
  readonly epsilon?: number;
  /** Atmospheric pressure, [Pa]. Default `101325`. */
  readonly p_atm?: number;
  /**
   * Repair the two defects this algorithm inherits from the deployed CBE tool.
   * Default `false`, so that the output reproduces the published chart.
   *
   * 1. The secant method clamps every candidate temperature to `[0, 100]`
   *    even though the bracket is `[-50, 50]`, so roots below 0 °C cannot be
   *    reached.
   * 2. The saturation line runs between the roots of `PMV = ±0.5`, hard-coded,
   *    instead of `PMV = ±pmvLimit`. Every EN category therefore gets the same
   *    top segment as the ±0.5 zone.
   *
   * Turning this on gives the geometry the algorithm was evidently meant to
   * produce; leave it off to match what the website draws.
   */
  readonly correctKnownDefects?: boolean;
  /**
   * Swallow the warnings the models log while the zone is being traced.
   * Default `true`.
   *
   * The search probes far outside every applicability range on purpose — the
   * bracket is -50 to 50 °C — and `cooling_effect` logs a line every time it
   * fails to find a root out there. Left alone, one ASHRAE zone writes
   * hundreds of lines that say nothing about the zone. Set `false` to see
   * them.
   */
  readonly suppressModelWarnings?: boolean;
}

/**
 * Traces a PMV comfort zone across a psychrometric chart.
 *
 * The zone is not something a model returns: for each relative humidity, the
 * dry-bulb temperature at which PMV reaches ±`pmvLimit` has to be solved for.
 * This is a port of `findComfortBoundary` in `static/js/psychchart.js` of the
 * CBE Thermal Comfort Tool — secant method with a bisection fallback, both
 * bracketed on `[-50, 50]`, at a PMV residual of 0.001.
 *
 * The models are called with `limit_inputs: false`, without which the search
 * would walk into NaN as soon as it left the standard's applicability range
 * and never bracket a root, and with `round_output: false`, so the edges are
 * smooth.
 *
 * Output is SI and ungarnished: no unit conversion, no clipping to a viewport,
 * no styling. Those are the caller's business.
 *
 * @public
 *
 * @example
 * import { charts, clo_dynamic, v_relative } from "jsthermalcomfort";
 *
 * const zone = charts.psychrometricZone({
 *   tr: 25,
 *   vr: v_relative(0.1, 1.1),
 *   met: 1.1,
 *   clo: clo_dynamic(0.5, 1.1),
 * });
 * zone.polygon.map((p) => [p.db, p.hr]);
 */
export function psychrometricZone(
  options: PsychrometricZoneOptions,
): PsychrometricZone {
  if (options.suppressModelWarnings === false) return trace(options);
  // Restored in `finally`, and the trace is synchronous, so nothing else can
  // log in between.
  const warn = console.warn;
  console.warn = () => {};
  try {
    return trace(options);
  } finally {
    console.warn = warn;
  }
}

function trace(options: PsychrometricZoneOptions): PsychrometricZone {
  const {
    tr,
    vr,
    met,
    clo,
    wme = 0,
    pmvLimit = 0.5,
    standard = "ASHRAE",
    rhStep = 10,
    saturationStep = 0.5,
    epsilon = 0.001,
    p_atm = 101325,
    correctKnownDefects = false,
  } = options;

  const unsolved: UnsolvedRow[] = [];

  const point = (db: number, rh: number): PsychrometricPoint => ({
    db,
    hr: psy_ta_rh(db, rh, p_atm).hr,
    rh,
  });

  const solve = (rh: number, target: number): PsychrometricPoint => {
    const fn = (db: number): number => {
      // The secant method can hand back a non-finite candidate: its clamp lets
      // NaN through, because every comparison with NaN is false. The CBE
      // tool's PMV quietly returns NaN for such an input and the row ends up
      // unsolved; this package validates its arguments and would throw, so an
      // unreachable target would surface as an exception instead of a report.
      if (!Number.isFinite(db)) return NaN;
      return (
        pmv_ppd(db, tr, vr, rh, met, clo, wme, standard, {
          limit_inputs: false,
          round_output: false,
        }).pmv - target
      );
    };
    let db = secant(-50, 50, fn, epsilon, {
      clampCandidates: !correctKnownDefects,
    });
    if (Number.isNaN(db)) db = bisect(-50, 50, fn, epsilon, 0);
    if (Number.isNaN(db) || db === NO_ROOT_FOUND) {
      unsolved.push({ rh, target, db });
    }
    return point(db, rh);
  };

  const coolEdge: PsychrometricPoint[] = [];
  const warmEdge: PsychrometricPoint[] = [];
  for (let rh = 0; rh <= 100; rh += rhStep) {
    coolEdge.push(solve(rh, -pmvLimit));
  }
  for (let rh = 0; rh <= 100; rh += rhStep) {
    warmEdge.push(solve(rh, pmvLimit));
  }

  // Defect 2: the deployed tool solves the ends of the saturation line at
  // ±0.5 whatever pmvLimit is.
  const saturationLimit = correctKnownDefects ? pmvLimit : 0.5;
  const tMin = solve(100, -saturationLimit).db;
  const tMax = solve(100, saturationLimit).db;
  const saturationEdge: PsychrometricPoint[] = [];
  for (let t = tMin; t <= tMax; t += saturationStep) {
    saturationEdge.push(point(t, 100));
  }

  return {
    pmvLimit,
    standard,
    coolEdge,
    saturationEdge,
    warmEdge,
    polygon: [...coolEdge, ...saturationEdge, ...[...warmEdge].reverse()],
    unsolved,
  };
}
