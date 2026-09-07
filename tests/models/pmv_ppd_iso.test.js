// Validation data loaded from the shared validation-data-comfort-models
// repository via the same URL-based mechanism as the original pmv_ppd.test.js.
import { describe, expect, test } from "vitest";
import {
  PMV_PPD_ISO_DEFAULT_EDITION,
  pmv_ppd_iso,
} from "../../src/models/pmv_ppd_iso.js";
import { pmv_ppd_with_warnings } from "../../src/models/pmv_ppd.js";
import {
  iso7730PmvLimits,
  iso7730PmvRangeLimit,
  iso7730VapourPressureLimit,
} from "../../src/reference/limits.js";
import { testDataUrls } from "./comftest";
import {
  assertNonEmptyRows,
  loadTestData,
  validateResult,
} from "./testUtils.js";

// Load test data from the shared repository (filters out array-input rows).
let { testData, tolerances } = await loadTestData(testDataUrls.pmvPpd, false);

// Keep only scalar SI ISO rows.
const isoData = assertNonEmptyRows(
  testData.data.filter((testCase) => {
    const { standard, units } = testCase.inputs;
    const isISO = standard === "ISO";
    const isSI = !units || units.toLowerCase() === "si";
    return isISO && isSI;
  }),
  "pmv_ppd_iso scalar SI ISO rows",
);

describe("pmv_ppd_iso", () => {
  test.each(isoData)("ISO test case #%#", (testCase) => {
    const { inputs, outputs: expectedOutput } = testCase;
    const { tdb, tr, vr, rh, met, clo, wme, limit_inputs } = inputs;

    // Pass limit_inputs through kwargs so rows with limit_inputs=false
    // are handled correctly.
    const kwargs = { limit_inputs };

    const modelResult = pmv_ppd_iso(tdb, tr, vr, rh, met, clo, wme, kwargs);

    validateResult(modelResult, expectedOutput, tolerances, inputs);
  });

  // Supplementary boundary test — not present in the shared validation data.
  // tdb=35°C exceeds the ISO 7730 valid range (10–30°C), so NaN is expected.
  test("out-of-range inputs should return NaN under ISO standard", () => {
    const result = pmv_ppd_iso(35, 35, 0.5, 80, 2.0, 0.3);
    expect(result.pmv).toBeNaN();
    expect(result.ppd).toBeNaN();
  });
});

// ---------------------------------------------------------------------------
// Input validation tests
// ---------------------------------------------------------------------------
describe("pmv_ppd_iso input validation", () => {
  test.each([
    ["tdb", "25", 25, 0.1, 50, 1.2, 0.5],
    ["tr", 25, "25", 0.1, 50, 1.2, 0.5],
    ["vr", 25, 25, "0.1", 50, 1.2, 0.5],
    ["rh", 25, 25, 0.1, "50", 1.2, 0.5],
    ["met", 25, 25, 0.1, 50, "1.2", 0.5],
    ["clo", 25, 25, 0.1, 50, 1.2, "0.5"],
    ["wme", 25, 25, 0.1, 50, 1.2, 0.5, "0"],
  ])("throws TypeError if %s is not a number", (_, ...args) => {
    expect(() => pmv_ppd_iso(...args)).toThrow(TypeError);
  });

  test("throws Error if kwargs.units is not a valid enum", () => {
    expect(() =>
      pmv_ppd_iso(25, 25, 0.1, 50, 1.2, 0.5, 0, { units: "INVALID" }),
    ).toThrow(Error);
  });

  test("throws TypeError if kwargs.limit_inputs is not a boolean", () => {
    expect(() =>
      pmv_ppd_iso(25, 25, 0.1, 50, 1.2, 0.5, 0, { limit_inputs: "true" }),
    ).toThrow(TypeError);
  });

  test("throws TypeError if kwargs.round_output is not a boolean", () => {
    expect(() =>
      pmv_ppd_iso(25, 25, 0.1, 50, 1.2, 0.5, 0, { round_output: "true" }),
    ).toThrow(TypeError);
  });
});

// ---------------------------------------------------------------------------
// Edition
//
// Upstream calls this parameter `model` and defaults it to "7730-2025"
// (pythermalcomfort/models/pmv_ppd_iso.py). Both editions run the same kernel
// over the same limits today, so the point of the parameter is that a result
// can say which edition it was computed under — these tests pin that it stays
// free of numerical effect, and that an unimplemented edition is rejected
// rather than silently accepted.
// ---------------------------------------------------------------------------
describe("pmv_ppd_iso edition", () => {
  const args = [25, 25, 0.1, 50, 1.2, 0.5];

  test.each(["7730-2005", "7730-2025"])(
    "%s returns the same numbers as the default",
    (edition) => {
      expect(pmv_ppd_iso(...args, 0, { edition })).toEqual(
        pmv_ppd_iso(...args),
      );
    },
  );

  test("rejects an edition it does not implement", () => {
    expect(() => pmv_ppd_iso(...args, 0, { edition: "7730-1994" })).toThrow(
      /7730-2005, 7730-2025/,
    );
  });

  test("publishes the editions it accepts, newest last", () => {
    expect([...pmv_ppd_iso.editions]).toEqual(["7730-2005", "7730-2025"]);
  });

  test("publishes its default edition as the newest one", () => {
    expect(pmv_ppd_iso.editions.at(-1)).toBe(PMV_PPD_ISO_DEFAULT_EDITION);
  });
});

// ---------------------------------------------------------------------------
// Applicability violations reported as rows
// ---------------------------------------------------------------------------
describe("pmv_ppd_with_warnings violations", () => {
  const inRange = [25, 25, 0.1, 50, 1.2, 0.5];

  test("is empty when every row holds", () => {
    const out = pmv_ppd_with_warnings(...inRange, 0, "ISO");
    expect(out.violations).toEqual([]);
    expect(out.warnings).toEqual([]);
  });

  test("returns the input row object the argument broke", () => {
    const out = pmv_ppd_with_warnings(45, 25, 0.1, 50, 1.2, 0.5, 0, "ISO");
    const tdbRow = iso7730PmvLimits.find((row) => row.quantity.key === "tdb");
    expect(out.violations[0]).toBe(tdbRow);
    expect(out.warnings).toEqual(out.violations.map((row) => row.warning));
  });

  test("reports the derived vapour-pressure row even with limit_inputs false", () => {
    // tdb 30 is the ISO upper bound, inclusive, so no input row fires; at
    // rh 95 the derived pa is about 4030 Pa, beyond the 2700 Pa bound. clo is
    // 0.3 rather than 0.5 to keep the derived row the only one that fires:
    // 30 °C at 0.5 clo produces a PMV of 2.03, which would break the output
    // row too and stop this test isolating the derived one.
    const out = pmv_ppd_with_warnings(30, 30, 0.1, 95, 1.2, 0.3, 0, "ISO", {
      limit_inputs: false,
    });
    expect(out.violations).toHaveLength(1);
    expect(out.violations[0]).toBe(iso7730VapourPressureLimit);
    expect(out.warnings).toEqual([iso7730VapourPressureLimit.warning]);
    expect(Number.isFinite(out.pmv)).toBe(true);
  });

  test("reports the output PMV row and still returns the number", () => {
    // Every argument is inside its row; the PMV they produce is not.
    const out = pmv_ppd_with_warnings(30, 40, 0.1, 50, 4, 2, 0, "ISO", {
      limit_inputs: false,
    });
    expect(out.violations).toEqual([iso7730PmvRangeLimit]);
    expect(out.pmv).toBeGreaterThan(2);
  });

  test("keeps NaN-ing gated by limit_inputs", () => {
    const out = pmv_ppd_with_warnings(30, 40, 0.1, 50, 4, 2, 0, "ISO");
    expect(out.violations).toEqual([iso7730PmvRangeLimit]);
    expect(out.pmv).toBeNaN();
  });

  test("orders input rows before the ISO-only rows", () => {
    const out = pmv_ppd_with_warnings(45, 45, 0.1, 95, 1.2, 0.5, 0, "ISO", {
      limit_inputs: false,
    });
    expect(out.violations.map((row) => row.role)).toEqual([
      "input",
      "input",
      "derived",
      "output",
    ]);
  });

  test("ASHRAE has no derived or output rows", () => {
    const out = pmv_ppd_with_warnings(30, 40, 0.1, 95, 4, 1.6, 0, "ASHRAE", {
      limit_inputs: false,
    });
    expect(out.violations.length).toBeGreaterThan(0);
    expect(out.violations.every((row) => row.role === "input")).toBe(true);
  });
});
