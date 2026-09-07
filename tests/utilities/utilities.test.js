import { describe, expect, it, test } from "vitest";
import {
  body_surface_area,
  v_relative,
  clo_dynamic_ashrae,
  clo_dynamic_iso,
  units_converter,
  running_mean_outdoor_temperature,
  f_svv,
  valid_range,
  clo_typical_ensembles,
  assertNumber,
  validateInputs,
  check_standard_compliance,
  range_violations,
} from "../../src/utilities/utilities";
import { iso7730PmvLimits } from "../../src/reference/limits";

const DEFAULT_TOLERANCE = 0.01;

describe("body_surface_area", () => {
  it.each([
    { weight: 80, height: 1.8, formula: undefined, expected: 1.9917 },
    { weight: 70, height: 1.8, formula: "dubois", expected: 1.88 },
    { weight: 75, height: 1.75, formula: "takahira", expected: 1.919 },
    { weight: 80, height: 1.7, formula: "fujimoto", expected: 1.872 },
    { weight: 85, height: 1.65, formula: "kurazumi", expected: 1.89 },
  ])(
    "returns $expected when weight is $weight, height is $height and formula is $formula",
    ({ weight, height, formula, expected }) => {
      const result = body_surface_area(weight, height, formula);
      expect(Math.abs(result - expected)).toBeLessThanOrEqual(
        DEFAULT_TOLERANCE,
      );
    },
  );

  it("throws an error if the formula is not valid", () => {
    expect(() => body_surface_area(70, 1.8, "invalid_formula")).toThrow();
  });
});

describe("v_relative", () => {
  it.each([
    { v: 2.0, met: 1.0, expected: 2.0 },
    { v: -1.5, met: 1.5, expected: -1.5 + 0.3 * 0.5 },
  ])(
    "returns $expected when v is $v and met is $met",
    ({ v, met, expected }) => {
      const result = v_relative(v, met);
      // Tolerance is manually defined because v_relative is not in the shared reference data
      expect(Math.abs(result - expected)).toBeLessThanOrEqual(0.0001);
    },
  );
});

describe("clo_dynamic_ashrae", () => {
  // Expected values from pythermalcomfort `clo_dynamic_ashrae`
  // (pythermalcomfort/utilities.py): clo × (0.6 + 0.4/met) above 1.2 met,
  // rounded to three decimals; the clothing unchanged at or below it.
  it.each([
    { clo: 1, met: 0.5, expected: 1 },
    { clo: 2, met: 0.5, expected: 2 },
    { clo: 1, met: 1, expected: 1 },
    { clo: 1, met: 1.2, expected: 1 },
    { clo: 1, met: 2.0, expected: 0.8 },
    { clo: 0.5, met: 1.4, expected: 0.443 },
  ])("returns $expected for clo $clo at met $met", ({ clo, met, expected }) => {
    expect(
      Math.abs(clo_dynamic_ashrae(clo, met) - expected),
    ).toBeLessThanOrEqual(1e-4);
  });

  it("defaults to the only implemented edition and rejects any other", () => {
    expect(clo_dynamic_ashrae(1, 2)).toBe(clo_dynamic_ashrae(1, 2, "55-2023"));
    expect(() => clo_dynamic_ashrae(1.0, 2.0, "55-2017")).toThrow();
  });
});

describe("clo_dynamic_iso", () => {
  // Expected values from pythermalcomfort `clo_dynamic_iso`
  // (pythermalcomfort/utilities.py), which is the ISO 9920:2007 correction
  // ISO 7730 Annex C adopts. The rows cover all three insulation regimes the
  // standard distinguishes: nude, very light clothing (interpolated), and
  // normal clothing. Verified across a 210-point clo × met × v grid; these
  // are the anchors kept in the suite.
  it.each([
    { clo: 0.0, met: 1.2, v: 0.3, expected: 0.0 }, // nude
    { clo: 0.3, met: 1.2, v: 0.3, expected: 0.17563593731891736 }, // i_cl <= 0.6
    { clo: 0.5, met: 1.4, v: 0.2, expected: 0.4052655996721316 }, // i_cl <= 0.6
    { clo: 0.6, met: 1.2, v: 0.3, expected: 0.5770014237329537 }, // boundary
    { clo: 1.0, met: 1.2, v: 0.3, expected: 0.9414980689938275 }, // normal
    { clo: 1.0, met: 2.0, v: 1.0, expected: 0.7516227793147641 }, // normal, walking
    { clo: 0.5, met: 1.0, v: 0.1, expected: 0.430534917594257 }, // v_walk clipped to 0
  ])(
    "returns $expected for clo $clo at met $met and v $v",
    ({ clo, met, v, expected }) => {
      expect(
        Math.abs(clo_dynamic_iso(clo, met, v) - expected),
      ).toBeLessThanOrEqual(1e-12);
    },
  );

  it("returns unrounded values, as upstream does", () => {
    // The ASHRAE branch rounds to three decimals; the ISO one does not, and a
    // caller comparing the two would otherwise see spurious agreement.
    const value = clo_dynamic_iso(0.3, 1.2, 0.3);
    expect(value).not.toBe(Math.round(value * 1000) / 1000);
  });

  it("defaults i_a to 0.7 and rejects an unimplemented edition", () => {
    expect(clo_dynamic_iso(0.5, 1.4, 0.2)).toBe(
      clo_dynamic_iso(0.5, 1.4, 0.2, 0.7),
    );
    expect(() => clo_dynamic_iso(0.5, 1.4, 0.2, 0.7, "9920-2009")).toThrow();
  });
});

describe("units_converter", () => {
  it.each([
    {
      args: {
        tdb: 77,
        tr: 77,
        v: 3.2,
      },
      from_units: "IP",
      expected: {
        tdb: 25.0,
        tr: 25.0,
        v: 0.975312,
      },
    },
    {
      args: {
        pressure: 1,
        area: 1 / 0.09,
      },
      from_units: "IP",
      expected: {
        pressure: 101325,
        area: 1.03224,
      },
    },
    {
      args: {
        tdb: 77,
        v: 10,
      },
      from_units: "IP",
      expected: {
        tdb: 25.0,
        v: 3.047,
      },
    },
    {
      args: {
        tdb: 20,
        v: 2,
      },
      from_units: "SI",
      expected: {
        tdb: 68,
        v: 6.562,
      },
    },
    {
      args: {
        area: 100,
        pressure: 14.7,
      },
      from_units: "IP",
      expected: {
        area: 9.29,
        pressure: 1489477.5,
      },
    },
    {
      args: {
        area: 50,
        pressure: 101325,
      },
      from_units: "SI",
      expected: {
        area: 538.199,
        pressure: 1,
      },
    },
  ])(
    "returns $expected when args are $args and from_units is $from_units",
    ({ args, from_units, expected }) => {
      expect(units_converter(args, from_units)).toEqual(
        Object.fromEntries(
          Object.entries(expected).map(([key, value]) => [
            key,
            expect.closeTo(value, 2),
          ]),
        ),
      );
    },
  );
});

describe("running_mean_outdoor_temperature", () => {
  it.each([
    {
      temp_array: [20, 20],
      alpha: 0.7,
      from_units: undefined,
      expected: 20,
    },
    {
      temp_array: [20, 20],
      alpha: 0.9,
      from_units: undefined,
      expected: 20,
    },
    {
      temp_array: [20, 20, 20, 20],
      alpha: 0.7,
      from_units: undefined,
      expected: 20,
    },
    {
      temp_array: [20, 20, 20, 20],
      alpha: 0.5,
      from_units: undefined,
      expected: 20,
    },
    {
      temp_array: [77, 77, 77, 77, 77, 77, 77],
      alpha: 0.8,
      from_units: "IP",
      expected: 77,
    },
  ])(
    "returns $expected when temp_array is $temp_array, alpha is $alpha and from_units is $from_units",
    ({ temp_array, alpha, from_units, expected }) => {
      const result = running_mean_outdoor_temperature(
        temp_array,
        alpha,
        from_units,
      );

      expect(Math.abs(result - expected)).toBeLessThanOrEqual(
        DEFAULT_TOLERANCE,
      );
    },
  );
});

describe("f_svv", () => {
  it.each([
    { width: 30, height: 10, distance: 3.3, expected: 0.27 },
    { width: 150, height: 10, distance: 3.3, expected: 0.31 },
    { width: 30, height: 6, distance: 3.3, expected: 0.2 },
    { width: 150, height: 6, distance: 3.3, expected: 0.23 },
    { width: 30, height: 10, distance: 6, expected: 0.17 },
    { width: 150, height: 10, distance: 6, expected: 0.21 },
    { width: 30, height: 6, distance: 6, expected: 0.11 },
    { width: 150, height: 6, distance: 6, expected: 0.14 },
    { width: 6, height: 9, distance: 3.3, expected: 0.14 },
    { width: 6, height: 6, distance: 3.3, expected: 0.11 },
    { width: 6, height: 6, distance: 6, expected: 0.04 },
    { width: 4, height: 4, distance: 3.3, expected: 0.06 },
    { width: 4, height: 4, distance: 6, expected: 0.02 },
  ])(
    "resturns $expected when width is $width, height is $height and distance is $distance",
    ({ width, height, distance, expected }) => {
      const result = f_svv(width, height, distance);

      expect(Math.abs(result - expected)).toBeLessThanOrEqual(
        DEFAULT_TOLERANCE,
      );
    },
  );
});

describe("valid_range", () => {
  it.each([
    {
      range: [10, 20, 30, 40, 50, 60],
      valid: [15, 55],
      expected: [NaN, 20, 30, 40, 50, NaN],
    },
    {
      range: [1, 2, 3, 4, 5, 6],
      valid: [2, 5],
      expected: [NaN, 2, 3, 4, 5, NaN],
    },
  ])(
    "returns $expected when valid is $valid and range is $range",
    ({ range, valid, expected }) => {
      const result = valid_range(range, valid);
      expect(result).toStrictEqual(expected);
    },
  );
});

describe("clo_typical_ensembles", () => {
  it.each([
    { ensembles: "Walking shorts, short-sleeve shirt", expected: 0.36 },
    { ensembles: "Trousers, long-sleeve shirt", expected: 0.61 },
    { ensembles: "Sweat pants, long-sleeve sweatshirt", expected: 0.74 },
    { ensembles: "Typical winter indoor clothing", expected: 1.0 },
  ])("reads $expected for $ensembles", ({ ensembles, expected }) => {
    const result = clo_typical_ensembles[ensembles];
    expect(Math.abs(result - expected)).toBeLessThanOrEqual(DEFAULT_TOLERANCE);
  });

  it("carries the nine ensembles upstream lists, and nothing else", () => {
    // A table, not a function: an unknown key reads undefined rather than
    // throwing, so what pins the surface is the key set itself.
    expect(Object.keys(clo_typical_ensembles)).toHaveLength(9);
    expect(clo_typical_ensembles["Sweet pants, short-sleeve shirt"]).toBe(
      undefined,
    );
  });
});

// ---------------------------------------------------------------------------
// assertNumber
// ---------------------------------------------------------------------------
describe("assertNumber", () => {
  test.each(["25", true, null, undefined, NaN, Infinity, -Infinity])(
    "throws TypeError for %s",
    (value) => {
      expect(() => assertNumber(value, "x")).toThrow(TypeError);
    },
  );

  test("does not throw for a valid finite number", () => {
    expect(() => assertNumber(25, "x")).not.toThrow();
    expect(() => assertNumber(-10.5, "x")).not.toThrow();
    expect(() => assertNumber(0, "x")).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// validateInputs
// ---------------------------------------------------------------------------
describe("validateInputs", () => {
  describe("type: number", () => {
    test("throws TypeError when a required number param receives a string", () => {
      expect(() =>
        validateInputs({ tdb: "25" }, { tdb: { type: "number" } }),
      ).toThrow(TypeError);
    });

    test("does not throw for a valid number", () => {
      expect(() =>
        validateInputs({ tdb: 25 }, { tdb: { type: "number" } }),
      ).not.toThrow();
    });
  });

  describe("type: boolean", () => {
    test("throws TypeError when a boolean param receives a string", () => {
      expect(() =>
        validateInputs(
          { limit_inputs: "true" },
          { limit_inputs: { type: "boolean" } },
        ),
      ).toThrow(TypeError);
    });

    test("does not throw for a valid boolean", () => {
      expect(() =>
        validateInputs(
          { limit_inputs: true },
          { limit_inputs: { type: "boolean" } },
        ),
      ).not.toThrow();
    });
  });

  describe("enum", () => {
    test("throws Error when value is not in the enum list", () => {
      expect(() =>
        validateInputs({ units: "INVALID" }, { units: { enum: ["SI", "IP"] } }),
      ).toThrow(Error);
    });

    test("does not throw for a valid enum value", () => {
      expect(() =>
        validateInputs({ units: "SI" }, { units: { enum: ["SI", "IP"] } }),
      ).not.toThrow();
    });
  });

  describe("required: false", () => {
    test("skips validation when value is undefined", () => {
      expect(() =>
        validateInputs(
          { w_max: undefined },
          { w_max: { type: "number", required: false } },
        ),
      ).not.toThrow();
    });

    test("still validates type when value is defined", () => {
      expect(() =>
        validateInputs(
          { w_max: "0.5" },
          { w_max: { type: "number", required: false } },
        ),
      ).toThrow(TypeError);
    });
  });

  describe("multiple params", () => {
    test("throws on the first invalid param encountered", () => {
      expect(() =>
        validateInputs(
          { tdb: "25", tr: 25 },
          { tdb: { type: "number" }, tr: { type: "number" } },
        ),
      ).toThrow(TypeError);
    });

    test("does not throw when all params are valid", () => {
      expect(() =>
        validateInputs(
          { tdb: 25, tr: 30, units: "SI" },
          {
            tdb: { type: "number" },
            tr: { type: "number" },
            units: { enum: ["SI", "IP"] },
          },
        ),
      ).not.toThrow();
    });
  });
});

describe("check_standard_compliance", () => {
  describe("ASHRAE airspeed_control branch", () => {
    it("flags v > 0.8 with low clo and met when occupant has no airspeed control", () => {
      const warnings = check_standard_compliance("ASHRAE", {
        tdb: 26,
        tr: 26,
        v: 1.0,
        met: 1.2,
        clo: 0.5,
        airspeed_control: false,
      });
      expect(warnings.length).toBeGreaterThan(0);
    });

    it("flags v above the operative-temperature limit when 23 < to < 25.5", () => {
      const warnings = check_standard_compliance("ASHRAE", {
        tdb: 24,
        tr: 24,
        v: 0.4,
        met: 1.2,
        clo: 0.5,
        airspeed_control: false,
      });
      expect(warnings.length).toBeGreaterThan(0);
    });

    it("flags v > 0.2 when to <= 23 with low clo and met", () => {
      const warnings = check_standard_compliance("ASHRAE", {
        tdb: 20,
        tr: 20,
        v: 0.5,
        met: 1.2,
        clo: 0.5,
        airspeed_control: false,
      });
      expect(warnings.length).toBeGreaterThan(0);
    });

    it("does not flag the same inputs when airspeed_control is true", () => {
      const warnings = check_standard_compliance("ASHRAE", {
        tdb: 26,
        tr: 26,
        v: 1.0,
        met: 1.2,
        clo: 0.5,
        airspeed_control: true,
      });
      expect(warnings).toHaveLength(0);
    });
  });

  describe("ISO branch v range check", () => {
    it("returns no warnings when v is within [0, 1]", () => {
      const warnings = check_standard_compliance("ISO", {
        tdb: 25,
        tr: 25,
        v: 0.1,
        met: 1.2,
        clo: 0.5,
      });
      expect(warnings).toHaveLength(0);
    });

    it("flags v above 1 m/s", () => {
      const warnings = check_standard_compliance("ISO", {
        tdb: 25,
        tr: 25,
        v: 1.5,
        met: 1.2,
        clo: 0.5,
      });
      expect(warnings.length).toBeGreaterThan(0);
    });
  });
});

describe("range_violations", () => {
  it("returns the table's own row objects, in the caller's key order", () => {
    const rows = range_violations(
      { tdb: 45, tr: 25, v: 1.5, met: 1.2, clo: 0.5 },
      iso7730PmvLimits,
    );
    const tdbRow = iso7730PmvLimits.find((row) => row.quantity.key === "tdb");
    const vRow = iso7730PmvLimits.find(
      (row) => row.quantity.key === "v" && row.role === "input",
    );
    expect(rows).toEqual([tdbRow, vRow]);
    expect(rows[0]).toBe(tdbRow);
  });

  it("ignores non-numeric fields", () => {
    const rows = range_violations(
      { tdb: 25, tr: 25, v: 0.1, met: 1.2, clo: 0.5, airspeed_control: false },
      iso7730PmvLimits,
    );
    expect(rows).toEqual([]);
  });

  it("is what check_standard_compliance's sentences come from", () => {
    const kwargs = { tdb: 45, tr: 45, v: 0.1, met: 0.5, clo: 0.5 };
    expect(check_standard_compliance("ISO", kwargs)).toEqual(
      range_violations(kwargs, iso7730PmvLimits).map((row) => row.warning),
    );
  });
});
