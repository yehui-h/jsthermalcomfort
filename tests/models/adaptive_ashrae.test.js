import { describe, expect, test } from "vitest";
import { adaptive_ashrae } from "../../src/models/adaptive_ashrae";
import { testDataUrls } from "./comftest";
import { loadTestData, validateResult } from "./testUtils";

let returnArray = false;

let { testData, tolerances } = await loadTestData(
  testDataUrls.adaptiveAshrae,
  returnArray,
);

describe("adaptive_ashrae", () => {
  test.each(testData.data)("Test case #%#", (testCase) => {
    const { inputs, outputs: expectedOutput } = testCase;
    const { tdb, tr, t_running_mean, v, units } = inputs;
    const modelResult = adaptive_ashrae(tdb, tr, t_running_mean, v, units);

    validateResult(modelResult, expectedOutput, tolerances, inputs);
  });
});

// ---------------------------------------------------------------------------
// Scalar hardcoded tests
// Expected values obtained from pythermalcomfort reference implementation.
//
// Scenarios covered:
//   SC-1  Neutral comfort, t_running_mean within range → comfort predicted
//   SC-2  Warm indoor exceeds comfort zone → not acceptable
//   SC-3  Cool indoor below comfort zone → not acceptable
//   SC-4  Out-of-range t_running_mean → tmp_cmf is NaN
//   SC-5  IP units conversion
// ---------------------------------------------------------------------------
describe("adaptive_ashrae scalar tests (hardcoded)", () => {
  test("SC-1 Neutral comfort, t_running_mean within range → comfort predicted", () => {
    const result = adaptive_ashrae(25, 25, 20, 0.1);
    validateResult(result, { tmp_cmf: 24.0 }, tolerances, {});
    expect(result.acceptability_80).toBe(true);
    expect(result.acceptability_90).toBe(true);
  });

  test("SC-2 Warm indoor exceeds comfort zone → not acceptable", () => {
    const result = adaptive_ashrae(32, 32, 20, 0.1);
    validateResult(result, { tmp_cmf: 24.0 }, tolerances, {});
    expect(result.acceptability_80).toBe(false);
    expect(result.acceptability_90).toBe(false);
  });

  test("SC-3 Cool indoor below comfort zone → not acceptable", () => {
    const result = adaptive_ashrae(15, 15, 12, 0.1);
    validateResult(result, { tmp_cmf: 21.5 }, tolerances, {});
    expect(result.acceptability_80).toBe(false);
    expect(result.acceptability_90).toBe(false);
  });

  test("SC-4 Out-of-range t_running_mean → tmp_cmf is NaN", () => {
    const result = adaptive_ashrae(25, 25, 5, 0.1, "SI", true);
    expect(result.tmp_cmf).toBeNaN();
    expect(result.acceptability_80).toBe(false);
    expect(result.acceptability_90).toBe(false);
  });

  test("SC-5 IP units conversion", () => {
    const result = adaptive_ashrae(77, 77, 68, 0.3, "IP");
    validateResult(result, { tmp_cmf: 75.2 }, tolerances, {});
    expect(result.acceptability_80).toBe(true);
    expect(result.acceptability_90).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// round_output unrounded path
// Reference value is derived analytically from the model equation
// t_cmf = 0.31 * t_running_mean + 17.8, giving 24.62 at t_running_mean = 22.
// Default round_output = true yields 24.6.
// ---------------------------------------------------------------------------
describe("adaptive_ashrae unrounded path", () => {
  test("round_output:false returns the unrounded comfort temperature and bounds", () => {
    const rounded = adaptive_ashrae(25, 25, 22, 0.1);
    const unrounded = adaptive_ashrae(25, 25, 22, 0.1, "SI", true, false);
    expect(rounded.tmp_cmf).toBe(24.6);
    expect(Math.abs(unrounded.tmp_cmf - 24.62)).toBeLessThan(1e-10);
    expect(unrounded.tmp_cmf).not.toBe(rounded.tmp_cmf);
    // tmp_cmf_80_low = t_cmf - 3.5: 24.62 - 3.5 = 21.12 unrounded; 21.1 rounded.
    expect(rounded.tmp_cmf_80_low).toBe(21.1);
    expect(Math.abs(unrounded.tmp_cmf_80_low - 21.12)).toBeLessThan(1e-10);
    expect(unrounded.tmp_cmf_80_low).not.toBe(rounded.tmp_cmf_80_low);
  });
});

describe("adaptive_ashrae round_output default", () => {
  test("omitting round_output keeps the default true", () => {
    expect(adaptive_ashrae(25, 25, 22, 0.1).tmp_cmf).toBe(24.6);
  });
});

// ---------------------------------------------------------------------------
// Cooling-effect acceptability boundary
// Locks the cooling-effect gate (get_ce) inside adaptive_ashrae. At
// v >= 0.6 and to >= 25, ce = 1.2 widens the 90% upper bound from
// t_cmf + 2.5 to t_cmf + 2.5 + 1.2, which flips acceptability_90 from
// false (no cooling effect, v = 0.1) to true (cooling effect, v = 0.6)
// at (tdb=tr=28, t_running_mean=22). Any future change that drops the
// gate fails this test.
// ---------------------------------------------------------------------------
describe("adaptive_ashrae cooling-effect boundary", () => {
  test("v=0.6 widens 90% acceptability at to=28; v=0.1 does not", () => {
    const wide = adaptive_ashrae(28, 28, 22, 0.6);
    const narrow = adaptive_ashrae(28, 28, 22, 0.1);
    expect(wide.acceptability_90).toBe(true);
    expect(narrow.acceptability_90).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Rounding order — upstream c3c110e (PR #188, issue #179)
// round_output rounds the returned temperatures, bounds included, in the
// output unit, after any IP conversion; the acceptability flags are judged on
// the unrounded band. Before the fix t_cmf was rounded first and the bounds
// derived from it, so a flag could flip with round_output at a rounded edge.
// The grid mixes upstream's regression cases with this package's own edges.
// ---------------------------------------------------------------------------
describe("adaptive_ashrae rounds the output, not the band (upstream #188)", () => {
  test.each([
    // upstream's regression grid
    [20, 20, 15, 0.1, "SI", true],
    [24, 24, 20, 0.2, "SI", true],
    [26, 26, 22, 0.3, "SI", true],
    [28, 28, 24, 0.4, "SI", true],
    // upstream's boundary case: t_cmf 21.644 → 21.6, 80% upper 25.144 vs 25.1
    [25.12, 25.12, 12.4, 0.1, "SI", true],
    [77.216, 77.216, 54.32, 0.328, "IP", true],
    // this package's own edges: cooling effect on, and the 1.4.0 fixture rows
    [28, 28, 22, 0.6, "SI", true],
    [25, 25, 15, 0, "SI", true],
    [25, 25, 8, 0.7, "SI", false],
  ])(
    "acceptability is independent of round_output at (%s, %s, %s, %s, %s, limit %s)",
    (tdb, tr, trm, v, units, limit_inputs) => {
      const rounded = adaptive_ashrae(
        tdb,
        tr,
        trm,
        v,
        units,
        limit_inputs,
        true,
      );
      const unrounded = adaptive_ashrae(
        tdb,
        tr,
        trm,
        v,
        units,
        limit_inputs,
        false,
      );
      expect(rounded.acceptability_80).toBe(unrounded.acceptability_80);
      expect(rounded.acceptability_90).toBe(unrounded.acceptability_90);
    },
  );

  test("the bounds come back at one decimal, not derived from a rounded t_cmf", () => {
    // 1.4.0: t_cmf 21.644 → 21.6, then 80% upper = 21.6 + 3.5 = 25.1 < 25.12,
    // so acceptability_80 was false. The unrounded band reaches 25.144.
    expect(adaptive_ashrae(25.12, 25.12, 12.4, 0.1)).toMatchObject({
      tmp_cmf: 21.6,
      tmp_cmf_80_low: 18.1,
      tmp_cmf_80_up: 25.1,
      tmp_cmf_90_low: 19.1,
      tmp_cmf_90_up: 24.1,
      acceptability_80: true,
      acceptability_90: false,
    });
    // 1.4.0 returned 25.599999999999998 here: round(t_cmf) + 3.5 + ce.
    const noisy = adaptive_ashrae(25, 25, 10, 0.6);
    expect(noisy.tmp_cmf_80_up).toBe(25.6);
    expect(noisy.tmp_cmf_90_up).toBe(24.6);
    expect(adaptive_ashrae(25, 25, 35, 0.7, "SI", false).tmp_cmf_80_up).toBe(
      33.4,
    );
  });

  test("IP results are rounded in °F, not the °C rounding converted", () => {
    // 1.4.0 returned 60.26, 53.96, … — the one-decimal °C values converted.
    const ip = adaptive_ashrae(25, 25, 20, 0.7, "IP", false);
    expect(ip).toMatchObject({
      tmp_cmf: 60.3,
      tmp_cmf_80_low: 54,
      tmp_cmf_80_up: 66.6,
      tmp_cmf_90_low: 55.8,
      tmp_cmf_90_up: 64.8,
    });
    const boundary = adaptive_ashrae(77.216, 77.216, 54.32, 0.328, "IP");
    expect(boundary).toMatchObject({
      tmp_cmf: 71,
      tmp_cmf_80_low: 64.7,
      tmp_cmf_80_up: 77.3,
      tmp_cmf_90_low: 66.5,
      tmp_cmf_90_up: 75.5,
      acceptability_80: true,
      acceptability_90: false,
    });
    for (const key of [
      "tmp_cmf",
      "tmp_cmf_80_low",
      "tmp_cmf_80_up",
      "tmp_cmf_90_low",
      "tmp_cmf_90_up",
    ]) {
      expect(Math.round(boundary[key] * 10) / 10).toBe(boundary[key]);
    }
  });

  test("a flag can be false while the rounded bound reads equal to `to`", () => {
    // t_cmf = 22.45 unrounded, 90% upper = 24.95 < to = 25, so the flag is
    // false; the displayed bound rounds to 25. 1.4.0 rounded t_cmf to 22.5
    // first and said true. This is what pythermalcomfort reports too.
    const edge = adaptive_ashrae(25, 25, 15, 0);
    expect(edge.tmp_cmf_90_up).toBe(25);
    expect(edge.acceptability_90).toBe(false);
    // The 1.4.0 fixture row that upstream issue #179 describes.
    const trm8 = adaptive_ashrae(25, 25, 8, 0.7, "SI", false);
    expect(trm8.tmp_cmf_80_up).toBe(25);
    expect(trm8.acceptability_80).toBe(false);
  });

  test("non-boundary results did not move", () => {
    expect(adaptive_ashrae(25, 25, 20, 0.7, "SI", false)).toMatchObject({
      tmp_cmf: 24,
      tmp_cmf_80_low: 20.5,
      tmp_cmf_80_up: 28.7,
      tmp_cmf_90_low: 21.5,
      tmp_cmf_90_up: 27.7,
      acceptability_80: true,
      acceptability_90: true,
    });
  });
});

// ---------------------------------------------------------------------------
// Input validation tests
// ---------------------------------------------------------------------------
describe("adaptive_ashrae input validation", () => {
  test.each([
    ["tdb", "25", 25, 20, 0.1],
    ["tr", 25, "25", 20, 0.1],
    ["t_running_mean", 25, 25, "20", 0.1],
    ["v", 25, 25, 20, "0.1"],
  ])("throws TypeError if %s is not a number", (_, ...args) => {
    expect(() => adaptive_ashrae(...args)).toThrow(TypeError);
  });

  test("throws Error if units is invalid", () => {
    expect(() => adaptive_ashrae(25, 25, 20, 0.1, "INVALID")).toThrow(Error);
  });

  test("throws TypeError if limit_inputs is not a boolean", () => {
    expect(() => adaptive_ashrae(25, 25, 20, 0.1, "SI", "true")).toThrow(
      TypeError,
    );
  });

  test("throws TypeError if round_output is not a boolean", () => {
    expect(() => adaptive_ashrae(25, 25, 20, 0.1, "SI", true, "true")).toThrow(
      TypeError,
    );
  });
});
