import { describe, expect, it } from "vitest";

import {
  adaptive_ashrae,
  adaptive_en,
  pmv_ppd_ashrae,
  pmv_ppd_iso,
} from "../src/index.js";
import {
  LabeledInterval,
  adaptiveAshraeOffsets,
  adaptiveEnOffsets,
  ashraeThermalSensation,
  isoThermalSensation,
  scaleFromEdges,
} from "../src/reference/index.js";

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
