import { describe, expect, it, vi } from "vitest";

import online from "./fixtures/chart-online.json" with { type: "json" };
import {
  NO_ROOT_FOUND,
  adaptiveAshraeZone,
  adaptiveEnZone,
  psychrometricZone,
} from "../src/charts/index.js";
// `bisect` and `secant` are module-internal: they exist to serve
// `psychrometricZone`, so they are not on the package's public surface. These
// are white-box tests of the solvers themselves, hence the deep import.
import { bisect, secant } from "../src/utilities/root_finding.js";
import { pmv_ppd_ashrae, pmv_ppd_iso } from "../src/models/index.js";
import type { PmvPpdModel } from "../src/models/index.js";

// The chart module's claim is that it reproduces the geometry the CBE Thermal
// Comfort Tool draws at comfort.cbe.berkeley.edu. The fixture is that tool's
// own output, captured by scripts/generate-chart-baseline.mjs:
//
//   node scripts/generate-chart-baseline.mjs <comfort_tool-dir> tests/fixtures/chart-online.json

/**
 * How far the boundary is allowed to sit from the deployed tool's, in °C.
 *
 * ISO zones land on it exactly. ASHRAE zones do not, and the reason is not the
 * geometry: this package's `cooling_effect` rounds to two decimals (matching
 * pythermalcomfort), the CBE tool's does not, and a ~0.002 K difference in the
 * cooling effect shifts the boundary by about a hundredth of a degree.
 */
const DB_TOLERANCE = {
  ISO: 1e-9,
  ASHRAE: 0.02,
} as const;

/**
 * The fixture records which standard the deployed tool drew each zone under;
 * `psychrometricZone` now takes the model function itself, so the recorded
 * string is resolved here rather than passed through.
 */
const MODEL_FOR: Record<keyof typeof DB_TOLERANCE, PmvPpdModel> = {
  ISO: pmv_ppd_iso,
  ASHRAE: pmv_ppd_ashrae,
};

/**
 * Humidity ratio tolerance, [kg/kg]. Both packages use the same formula; this
 * package's `p_sat` rounds to 0.1 Pa, which moves the ratio in its seventh
 * decimal.
 */
const HR_TOLERANCE = 1e-5;

describe("psychrometric comfort zone", () => {
  it("reproduces the boundary the CBE tool draws", () => {
    for (const zone of online.zones) {
      const standard = zone.standard as keyof typeof DB_TOLERANCE;
      const label = `${standard} ±${zone.pmvLimit} met=${zone.met} clo=${zone.clo}`;
      const mine = psychrometricZone({
        model: MODEL_FOR[standard],
        tr: zone.tr,
        vr: zone.vr,
        met: zone.met,
        clo: zone.clo,
        pmvLimit: zone.pmvLimit,
      });
      expect(mine.model, `${label} echoes the model it used`).toBe(
        MODEL_FOR[standard],
      );

      expect(mine.polygon.length, `${label} vertex count`).toBe(
        zone.boundary.length,
      );
      expect(mine.unsolved, `${label} unsolved rows`).toEqual([]);
      for (const [index, expected] of zone.boundary.entries()) {
        const actual = mine.polygon[index]!;
        expect(
          Math.abs(actual.db - expected.db),
          `${label} point ${index} db`,
        ).toBeLessThan(DB_TOLERANCE[standard]);
        expect(
          Math.abs(actual.hr - expected.hr),
          `${label} point ${index} hr`,
        ).toBeLessThan(HR_TOLERANCE);
      }
    }
  });

  it("gives the same points as separate edges and as one polygon", () => {
    // Adjacent bands have to share the vertices of an isopleth, which only the
    // separated edges can express; the polygon is the drawing order.
    const zone = psychrometricZone({
      model: pmv_ppd_ashrae,
      tr: 25,
      vr: 0.13,
      met: 1.1,
      clo: 0.5,
    });
    expect(zone.polygon).toEqual([
      ...zone.coolEdge,
      ...zone.saturationEdge,
      ...[...zone.warmEdge].reverse(),
    ]);
    expect(zone.coolEdge.map((p) => p.rh)).toEqual(
      zone.warmEdge.map((p) => p.rh),
    );
    expect(zone.coolEdge.map((p) => p.rh)).toEqual([
      0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100,
    ]);
  });

  it("reports rows it could not solve instead of clamping them", () => {
    // No set of conditions in the bracket reaches PMV = ±20.
    const zone = psychrometricZone({
      model: pmv_ppd_iso,
      tr: 25,
      vr: 0.13,
      met: 1.1,
      clo: 0.5,
      pmvLimit: 20,
    });
    expect(zone.unsolved.length).toBeGreaterThan(0);
    // The value the CBE bisection returns is kept, so its chart can be
    // reproduced; the report is what tells a caller not to trust the point.
    expect(zone.unsolved[0]!.db).toBe(NO_ROOT_FOUND);
    expect(zone.coolEdge[0]!.db).toBe(NO_ROOT_FOUND);
  });

  it("solves against tr = db when trFollowsDb is set", () => {
    // The operative-temperature chart: every vertex must satisfy the PMV
    // equation with tr taken from the x axis, not from options.tr. The tr
    // passed in is deliberately far from the zone so a solve that still read
    // it could not land on the boundary.
    const epsilon = 0.001;
    const zone = psychrometricZone({
      model: pmv_ppd_iso,
      tr: 50,
      vr: 0.13,
      met: 1.1,
      clo: 0.5,
      trFollowsDb: true,
      epsilon,
    });
    expect(zone.unsolved).toEqual([]);
    for (const edge of [zone.coolEdge, zone.warmEdge]) {
      for (const { db, rh } of edge) {
        const { pmv } = pmv_ppd_iso(db, db, 0.13, rh, 1.1, 0.5, 0, {
          limit_inputs: false,
          round_output: false,
        });
        expect(Math.abs(Math.abs(pmv) - zone.pmvLimit)).toBeLessThan(epsilon);
      }
    }
  });

  it("leaves the default zone reading options.tr", () => {
    // Guards the switch itself: the same call without the flag must not
    // reproduce the operative geometry.
    const conditions = {
      model: pmv_ppd_iso,
      vr: 0.13,
      met: 1.1,
      clo: 0.5,
    } as const;
    const following = psychrometricZone({
      ...conditions,
      tr: 50,
      trFollowsDb: true,
    });
    const fixed = psychrometricZone({ ...conditions, tr: 50 });
    expect(fixed.coolEdge[0]!.db).not.toBeCloseTo(following.coolEdge[0]!.db, 3);
    // With tr already equal to the solved db there is nothing left to differ.
    const matched = psychrometricZone({
      ...conditions,
      tr: 25,
      trFollowsDb: true,
    });
    expect(matched.coolEdge[0]!.db).toBeCloseTo(following.coolEdge[0]!.db, 9);
  });

  it("stays quiet unless asked not to", () => {
    // The search probes -50 °C, where `cooling_effect` gives up and logs.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      psychrometricZone({
        model: pmv_ppd_ashrae,
        tr: 25,
        vr: 0.6,
        met: 1.2,
        clo: 0.5,
      });
      expect(warn).not.toHaveBeenCalled();
      psychrometricZone({
        model: pmv_ppd_ashrae,
        tr: 25,
        vr: 0.6,
        met: 1.2,
        clo: 0.5,
        suppressModelWarnings: false,
      });
      expect(warn).toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });
});

describe("the CBE tool's two defects", () => {
  const conditions = {
    model: pmv_ppd_ashrae,
    tr: 25,
    vr: 0.13,
    met: 1.1,
    clo: 0.5,
  } as const;

  it("clamps secant candidates to [0, 100], hiding roots below zero", () => {
    const root = (x: number): number => x + 20;
    expect(secant(-50, 50, root, 0.001)).toBeNaN();
    expect(
      secant(-50, 50, root, 0.001, { clampCandidates: false }),
    ).toBeCloseTo(-20, 9);
  });

  it("falls back to bisection, which is how sub-zero roots still get found", () => {
    // The clamp would strand the search; bisection has no clamp, so the zone
    // comes out right anyway. That is why defect 1 is invisible on the site.
    const zone = psychrometricZone({
      ...conditions,
      model: pmv_ppd_iso,
      pmvLimit: 8,
    });
    expect(zone.coolEdge[0]!.db).toBeLessThan(0);
    expect(zone.unsolved).toEqual([]);
  });

  it("returns a sentinel, not NaN, when the bracket holds no root", () => {
    expect(bisect(-50, 50, (x) => x * x + 1, 0.001, 0)).toBe(NO_ROOT_FOUND);
  });

  it("solves the saturation line at ±0.5 whatever the limit is", () => {
    const asDrawn = psychrometricZone({
      ...conditions,
      model: pmv_ppd_iso,
      pmvLimit: 0.2,
    });
    const corrected = psychrometricZone({
      ...conditions,
      model: pmv_ppd_iso,
      pmvLimit: 0.2,
      correctKnownDefects: true,
    });
    // The edges are the same — only the top segment moves.
    expect(corrected.coolEdge).toEqual(asDrawn.coolEdge);
    expect(corrected.saturationEdge.length).toBeLessThan(
      asDrawn.saturationEdge.length,
    );
    // A Category I zone should not reach as far along the saturation line as
    // the ±0.5 zone does, but as drawn it does.
    const wider = psychrometricZone({ ...conditions, model: pmv_ppd_iso });
    expect(asDrawn.saturationEdge).toEqual(wider.saturationEdge);
  });

  it("changes nothing at the limit the tool actually uses", () => {
    // pmvlimit is 0.5 on the ASHRAE chart, so defect 2 is latent there.
    expect(
      psychrometricZone({ ...conditions, correctKnownDefects: true })
        .saturationEdge,
    ).toEqual(psychrometricZone(conditions).saturationEdge);
  });
});

describe("adaptive comfort zones", () => {
  it("lands on the vertices the CBE tool hard-codes", () => {
    for (const [zone, bands] of [
      [online.adaptive.ashrae, adaptiveAshraeZone()],
      [online.adaptive.en, adaptiveEnZone()],
    ] as const) {
      for (const [index, expected] of zone.bands.entries()) {
        const actual = bands[index]!;
        expect(actual.label).toBe(expected.label);
        // The tool's kink vertex (its trm = 12) is a rounded approximation and
        // only appears under elevated air speed, so the endpoints are what can
        // be compared: first and last of each boundary.
        const ends = (points: readonly { trm: number; t: number }[]) => [
          points[0]!,
          points[points.length - 1]!,
        ];
        for (const [side, mine, theirs] of [
          ["upper", ends(actual.upper), ends(expected.upper)],
          // The tool lists its lower boundary from the right, this package
          // from the left.
          ["lower", ends(actual.lower), ends(expected.lower).reverse()],
        ] as const) {
          for (const [end, point] of theirs.entries()) {
            expect(mine[end]!.trm, `${expected.label} ${side} trm`).toBe(
              point.trm,
            );
            expect(mine[end]!.t, `${expected.label} ${side} t`).toBeCloseTo(
              point.t,
              9,
            );
          }
        }
      }
    }
  });

  it("nests the EN categories and keeps them asymmetric", () => {
    const [one, two, three] = adaptiveEnZone();
    for (const [inner, outer] of [
      [one!, two!],
      [two!, three!],
    ] as const) {
      expect(inner.upper[0]!.t).toBeLessThan(outer.upper[0]!.t);
      expect(inner.lower[0]!.t).toBeGreaterThan(outer.lower[0]!.t);
    }
    // Category I reaches 3 K below the comfort temperature and 2 K above it.
    const spread = one!.upper[0]!.t - one!.lower[0]!.t;
    expect(spread).toBeCloseTo(5, 9);
  });

  it("steps the ASHRAE upper boundary where the cooling effect starts", () => {
    const still = adaptiveAshraeZone()[0]!;
    expect(still.upper).toHaveLength(2);

    // 0.9 m/s buys 1.8 K, but only once the operative temperature reaches 25.
    const breezy = adaptiveAshraeZone({ v: 0.9 })[0]!;
    expect(breezy.upper).toHaveLength(4);
    const [start, kinkLow, kinkHigh, end] = breezy.upper;
    expect(start!.t).toBe(still.upper[0]!.t);
    expect(kinkLow!.t).toBe(25);
    expect(kinkHigh!.t).toBeCloseTo(26.8, 9);
    expect(kinkLow!.trm).toBe(kinkHigh!.trm);
    // The tool rounds this vertex to trm = 12.
    expect(kinkLow!.trm).toBeCloseTo(11.935, 3);
    expect(end!.t).toBeCloseTo(still.upper[1]!.t + 1.8, 9);
    // The lower boundary never gets the cooling effect.
    expect(breezy.lower).toEqual(still.lower);
  });

  it("closes each band upper-out, lower-back", () => {
    const band = adaptiveEnZone()[0]!;
    expect(band.polygon).toEqual([...band.upper, ...[...band.lower].reverse()]);
  });
});
