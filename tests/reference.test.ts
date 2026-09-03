import { describe, expect, it } from "vitest";

import {
  adaptive_ashrae,
  adaptive_en,
  check_standard_compliance,
  pmv_ppd_ashrae,
  pmv_ppd_iso,
} from "../src/index.js";
import {
  LabeledInterval,
  adaptiveAshraeOffsets,
  adaptiveCoolingEffectMinOperative,
  adaptiveCoolingEffectSteps,
  adaptiveEnOffsets,
  ashrae55AdaptiveLimits,
  ashrae55PmvLimits,
  ashraeThermalSensation,
  iso7730PmvLimits,
  isoThermalSensation,
  scaleFromEdges,
  standards,
} from "../src/reference/index.js";
import type { ApplicabilityLimit } from "../src/reference/index.js";
import { quantities } from "../src/io/quantity.js";
// `@internal`, reached directly: it is the one reader of the cooling-effect
// table and the only way to check the table describes what the model does.
import { get_ce } from "../src/models/adaptive_en.js";

// The reference tables are the package's answer to "where do the thresholds
// live". These tests pin them against pythermalcomfort 4.4.2 so a future edit
// has to be deliberate.

describe("thermal sensation scale", () => {
  const EDGES = [-2.5, -1.5, -0.5, 0.5, 1.5, 2.5, 10];
  const LABELS = [
    "Cold",
    "Cool",
    "Slightly Cool",
    "Neutral",
    "Slightly Warm",
    "Warm",
    "Hot",
  ];

  it.each([
    ["ISO", isoThermalSensation],
    ["ASHRAE", ashraeThermalSensation],
  ])("%s carries the upstream labels and cut points", (_name, scale) => {
    expect(scale.intervals.map((i) => i.label)).toEqual(LABELS);
    expect(scale.intervals.map((i) => i.upper.value)).toEqual(EDGES);
    // The first band is unbounded below; every later one starts at the previous cut.
    expect(scale.intervals[0]!.lower.value).toBe(-Infinity);
    expect(scale.intervals.slice(1).map((i) => i.lower.value)).toEqual(
      EDGES.slice(0, -1),
    );
  });

  it("closes from opposite sides in the two standards", () => {
    // One table, two closures. At exactly -0.5 the standards disagree — this is
    // real upstream behaviour (right=False vs the default right=True), not a
    // transcription slip, so it must survive refactors.
    expect(isoThermalSensation.labelFor(-0.5)).toBe("Neutral");
    expect(ashraeThermalSensation.labelFor(-0.5)).toBe("Slightly Cool");

    const iso = isoThermalSensation.intervals.find(
      (i) => i.label === "Slightly Cool",
    )!;
    const ashrae = ashraeThermalSensation.intervals.find(
      (i) => i.label === "Slightly Cool",
    )!;
    expect(iso.notation).toBe("[-1.5, -0.5)");
    expect(ashrae.notation).toBe("(-1.5, -0.5]");
  });

  it("leaves NaN and values past the top edge unclassified", () => {
    // pythermalcomfort's np.digitize puts NaN in the last bin, so mapping(NaN)
    // returns "Hot" there. NaN is the normal result for an out-of-applicability
    // input, so labelling it as the hottest band would be actively misleading.
    for (const scale of [isoThermalSensation, ashraeThermalSensation]) {
      expect(scale.classify(Number.NaN)).toBeUndefined();
      expect(scale.classify(10.5)).toBeUndefined();
    }
    // The sentinel edge itself: left-closed excludes it, right-closed includes it.
    expect(isoThermalSensation.labelFor(10)).toBeUndefined();
    expect(ashraeThermalSensation.labelFor(10)).toBe("Hot");
  });

  it("covers the scale without gaps or overlaps", () => {
    for (const scale of [isoThermalSensation, ashraeThermalSensation]) {
      for (const value of [-9, -2.6, -2, -1, 0, 1, 2, 3, 9.9]) {
        const hits = scale.intervals.filter((i) => i.contains(value));
        expect(
          hits,
          `value ${value} matched ${hits.length} intervals`,
        ).toHaveLength(1);
      }
    }
  });
});

describe("LabeledInterval", () => {
  it("expresses all four closures", () => {
    const closed = new LabeledInterval(
      "closed",
      { value: 0, inclusive: true },
      { value: 1, inclusive: true },
    );
    const open = new LabeledInterval(
      "open",
      { value: 0, inclusive: false },
      { value: 1, inclusive: false },
    );
    const leftClosed = new LabeledInterval(
      "leftClosed",
      { value: 0, inclusive: true },
      { value: 1, inclusive: false },
    );
    const rightClosed = new LabeledInterval(
      "rightClosed",
      { value: 0, inclusive: false },
      { value: 1, inclusive: true },
    );

    expect(
      [closed, open, leftClosed, rightClosed].map((i) => i.notation),
    ).toEqual(["[0, 1]", "(0, 1)", "[0, 1)", "(0, 1]"]);
    expect(
      [closed, open, leftClosed, rightClosed].map((i) => i.contains(0)),
    ).toEqual([true, false, true, false]);
    expect(
      [closed, open, leftClosed, rightClosed].map((i) => i.contains(1)),
    ).toEqual([true, false, false, true]);
  });

  it("never contains NaN, whatever the closure", () => {
    const everything = new LabeledInterval(
      "everything",
      { value: -Infinity, inclusive: false },
      { value: Infinity, inclusive: false },
    );
    expect(everything.contains(Number.NaN)).toBe(false);
    expect(everything.contains(0)).toBe(true);
  });

  it("rejects a mismatched edge/label count", () => {
    expect(() => scaleFromEdges([0, 1], ["only one"], "leftClosed")).toThrow();
  });
});

describe("adaptive offsets", () => {
  it("ASHRAE bands are symmetric before the cooling effect", () => {
    expect(adaptiveAshraeOffsets).toEqual([
      { label: "80%", low: -3.5, up: 3.5 },
      { label: "90%", low: -2.5, up: 2.5 },
    ]);
  });

  it("EN categories are asymmetric and nested", () => {
    expect(adaptiveEnOffsets).toEqual([
      { label: "Category I", low: -3.0, up: 2.0 },
      { label: "Category II", low: -4.0, up: 3.0 },
      { label: "Category III", low: -5.0, up: 4.0 },
    ]);
    // Every EN category reaches further below neutral than above it, and each
    // one contains the previous. A "centre ± half-width" model cannot say this.
    for (const offset of adaptiveEnOffsets) {
      expect(Math.abs(offset.low)).toBeGreaterThan(offset.up);
    }
    for (let i = 1; i < adaptiveEnOffsets.length; i += 1) {
      expect(adaptiveEnOffsets[i]!.low).toBeLessThan(
        adaptiveEnOffsets[i - 1]!.low,
      );
      expect(adaptiveEnOffsets[i]!.up).toBeGreaterThan(
        adaptiveEnOffsets[i - 1]!.up,
      );
    }
  });

  it("steps the cooling effect exactly where the table says", () => {
    // `get_ce` reads this table, so the two cannot disagree; what still needs
    // pinning is the table itself against pythermalcomfort 4.4.2, and that the
    // steps are read as "the last one the air speed reaches".
    expect(adaptiveCoolingEffectSteps).toEqual([
      { minAirSpeed: 0.6, coolingEffect: 1.2 },
      { minAirSpeed: 0.9, coolingEffect: 1.8 },
      { minAirSpeed: 1.2, coolingEffect: 2.2 },
    ]);
    expect(adaptiveCoolingEffectMinOperative).toBe(25.0);

    const hot = adaptiveCoolingEffectMinOperative;
    expect(get_ce(0.59, hot)).toBe(0);
    for (const { minAirSpeed, coolingEffect } of adaptiveCoolingEffectSteps) {
      // The edge is inclusive, and the step holds right up to the next one.
      expect(get_ce(minAirSpeed, hot)).toBe(coolingEffect);
      expect(get_ce(minAirSpeed + 0.29, hot)).toBe(coolingEffect);
      // Below the operative threshold nothing applies, however fast the air.
      expect(get_ce(minAirSpeed, hot - 0.01)).toBe(0);
    }
  });

  it("reproduces the model's own bounds", () => {
    // The offsets are only useful if they actually describe what the model
    // returns; derive the bounds from tmp_cmf and check against the real call.
    const result = adaptive_ashrae(25, 25, 20, 0.1);
    for (const { label, low, up } of adaptiveAshraeOffsets) {
      const key = label === "80%" ? "80" : "90";
      expect(result[`tmp_cmf_${key}_low` as "tmp_cmf_80_low"]).toBeCloseTo(
        result.tmp_cmf + low,
        10,
      );
      // Air speed is below the cooling-effect threshold here, so up is exact.
      expect(result[`tmp_cmf_${key}_up` as "tmp_cmf_80_up"]).toBeCloseTo(
        result.tmp_cmf + up,
        10,
      );
    }
  });
});

describe("metadata attached to the model functions", () => {
  it("does not disturb the functions themselves", () => {
    // Attaching properties must leave the call signature and result untouched.
    expect(pmv_ppd_iso(25, 25, 0.1, 50, 1.2, 0.5)).toEqual({
      pmv: 0.08,
      ppd: 5.1,
    });
    expect(Object.keys(adaptive_ashrae(25, 25, 20, 0.1)).sort()).toEqual([
      "acceptability_80",
      "acceptability_90",
      "tmp_cmf",
      "tmp_cmf_80_low",
      "tmp_cmf_80_up",
      "tmp_cmf_90_low",
      "tmp_cmf_90_up",
    ]);
  });

  it("exposes label, description and the right band data per model", () => {
    for (const model of [
      pmv_ppd_iso,
      pmv_ppd_ashrae,
      adaptive_ashrae,
      adaptive_en,
    ]) {
      expect(typeof model.label).toBe("string");
      expect(typeof model.description).toBe("string");
    }
    // PMV models classify; adaptive models bound. Neither carries the other's shape.
    expect(pmv_ppd_iso.tsv).toBe(isoThermalSensation);
    expect(pmv_ppd_ashrae.tsv).toBe(ashraeThermalSensation);
    expect(adaptive_ashrae.offsets).toBe(adaptiveAshraeOffsets);
    expect(adaptive_en.offsets).toBe(adaptiveEnOffsets);
  });

  it("states the ASHRAE compliance range as an open interval", () => {
    // pythermalcomfort computes it as (pmv > -0.5) & (pmv < 0.5), so exactly
    // ±0.5 is *not* compliant. A closed interval would silently widen it.
    expect(pmv_ppd_ashrae.COMPLIANCE_LIMIT).toBe(0.5);
    expect(pmv_ppd_ashrae.compliance.notation).toBe("(-0.5, 0.5)");
    expect(pmv_ppd_ashrae.compliance.contains(0.5)).toBe(false);
    expect(pmv_ppd_ashrae.compliance.contains(-0.5)).toBe(false);
    expect(pmv_ppd_ashrae.compliance.contains(0.49)).toBe(true);
  });
});

describe("applicability limits", () => {
  // The tables are only "the single source" if the check functions actually
  // read them. Probing each edge proves it: nudge a value 0.01 outside its row
  // and a warning must appear; the edge itself must stay silent.
  const PROBE = 0.01;

  const probe = (limit: ApplicabilityLimit, value: number): string[] =>
    limit.quantity === quantities.t_running_mean
      ? // The running-mean row is checked inside adaptive_ashrae, not by
        // check_standard_compliance, so it is probed through the model.
        [...adaptive_ashrae_warnings(value)]
      : check_standard_compliance(standardFor(limit), {
          [limit.quantity.key]: value,
        });

  const adaptive_ashrae_warnings = (t_running_mean: number): string[] => {
    // tmp_cmf is NaN exactly when a warning fired, and every other input here
    // is mid-range, so NaN isolates the running-mean check.
    const { tmp_cmf } = adaptive_ashrae(25, 25, t_running_mean, 0.1);
    return Number.isNaN(tmp_cmf)
      ? ["ASHRAE running mean outdoor temperature applicability limits"]
      : [];
  };

  const standardFor = (limit: ApplicabilityLimit): "ISO" | "ASHRAE" =>
    iso7730PmvLimits.includes(limit) ? "ISO" : "ASHRAE";

  const TABLES: readonly [string, readonly ApplicabilityLimit[]][] = [
    ["iso7730PmvLimits", iso7730PmvLimits],
    ["ashrae55PmvLimits", ashrae55PmvLimits],
    ["ashrae55AdaptiveLimits", ashrae55AdaptiveLimits],
  ];

  for (const [name, table] of TABLES) {
    describe(name, () => {
      it.each(table.map((limit) => [limit.quantity.key, limit] as const))(
        "%s warns just outside its range and not at the edges",
        (_key, limit) => {
          expect(probe(limit, limit.min - PROBE).length).toBeGreaterThan(0);
          expect(probe(limit, limit.max + PROBE).length).toBeGreaterThan(0);
          expect(probe(limit, limit.min)).toEqual([]);
          expect(probe(limit, limit.max)).toEqual([]);
        },
      );
    });
  }

  it("records the ISO met discrepancy rather than silently picking a side", () => {
    // The code checks < 0; the message says 0.8. Both are in the table, which
    // is the only place a consumer can see the two disagree.
    const met = iso7730PmvLimits.find((l) => l.quantity === quantities.met)!;
    expect(met.min).toBe(0);
    expect(met.warning).toContain("between 0.8 and 4.0 met");
    expect(check_standard_compliance("ISO", { met: 0.5 })).toEqual([]);
  });

  it("shares the ASHRAE rows between the PMV and adaptive tables", () => {
    // Identity, not equality: "v same as ASHRAE" means the same object.
    for (const q of [quantities.tdb, quantities.tr, quantities.v]) {
      expect(ashrae55AdaptiveLimits.find((l) => l.quantity === q)).toBe(
        ashrae55PmvLimits.find((l) => l.quantity === q),
      );
    }
  });
});

describe("standards attached to the model functions", () => {
  it.each([
    ["pmv_ppd_iso", pmv_ppd_iso, standards.iso7730],
    ["pmv_ppd_ashrae", pmv_ppd_ashrae, standards.ashrae55],
    ["adaptive_ashrae", adaptive_ashrae, standards.ashrae55],
    ["adaptive_en", adaptive_en, standards.en16798],
  ])("%s carries the standards member itself", (_name, model, expected) => {
    expect(model.standard).toBe(expected);
  });

  it("attaches the matching limits table where one exists", () => {
    expect(pmv_ppd_iso.limits).toBe(iso7730PmvLimits);
    expect(pmv_ppd_ashrae.limits).toBe(ashrae55PmvLimits);
    expect(adaptive_ashrae.limits).toBe(ashrae55AdaptiveLimits);
  });
});
