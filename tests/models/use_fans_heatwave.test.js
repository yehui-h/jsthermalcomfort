import { describe, expect, test } from "@jest/globals";
import { use_fans_heatwaves } from "../../src/models/use_fans_heatwave";
import { testDataUrls } from "./comftest"; // Import all test URLs from comftest.js
import { loadTestData, validateResult } from "./testUtils";

let returnArray = false;

// use top-level await to load test data before tests are defined.
let { testData, tolerances } = await loadTestData(
  testDataUrls.use_fans_heatwaves,
  returnArray,
);

describe("use_fans_heatwaves", () => {
  test.each(testData.data)("Test case #%#", (testCase) => {
    const { inputs, outputs: expectedOutput } = testCase;
    const {
      tdb,
      tr,
      v,
      rh,
      met,
      clo,
      wme,
      body_surface_area,
      p_atm,
      position: body_position,
      units,
      max_skin_blood_flow,
      kwargs,
    } = inputs;

    const modelResult = use_fans_heatwaves(
      tdb,
      tr,
      v,
      rh,
      met,
      clo,
      wme,
      body_surface_area,
      p_atm,
      body_position,
      units,
      max_skin_blood_flow,
      kwargs,
    );

    validateResult(modelResult, expectedOutput, tolerances, inputs);
  });
});

// ---------------------------------------------------------------------------
// Input validation tests
// ---------------------------------------------------------------------------
describe("use_fans_heatwaves input validation", () => {
  test.each([
    ["tdb", "25", 25, 0.1, 50, 1.2, 0.5],
    ["tr", 25, "25", 0.1, 50, 1.2, 0.5],
    ["v", 25, 25, "0.1", 50, 1.2, 0.5],
    ["rh", 25, 25, 0.1, "50", 1.2, 0.5],
    ["met", 25, 25, 0.1, 50, "1.2", 0.5],
    ["clo", 25, 25, 0.1, 50, 1.2, "0.5"],
    ["wme", 25, 25, 0.1, 50, 1.2, 0.5, "0"],
  ])("throws TypeError if %s is not a number", (_, ...args) => {
    expect(() => use_fans_heatwaves(...args)).toThrow(TypeError);
  });

  test("throws Error if body_position is not a valid enum", () => {
    expect(() =>
      use_fans_heatwaves(
        25,
        25,
        0.1,
        50,
        1.2,
        0.5,
        0,
        undefined,
        undefined,
        "INVALID",
      ),
    ).toThrow(Error);
  });

  test("throws Error if units is not a valid enum", () => {
    expect(() =>
      use_fans_heatwaves(
        25,
        25,
        0.1,
        50,
        1.2,
        0.5,
        0,
        undefined,
        undefined,
        "standing",
        "INVALID",
      ),
    ).toThrow(Error);
  });

  test("throws TypeError if kwargs.round is not a boolean", () => {
    expect(() =>
      use_fans_heatwaves(
        25,
        25,
        0.1,
        50,
        1.2,
        0.5,
        0,
        undefined,
        undefined,
        "standing",
        "SI",
        80,
        {
          round: "true",
        },
      ),
    ).toThrow(TypeError);
  });

  test("round false returns snake_case fields and drops comfort indices", () => {
    const result = use_fans_heatwaves(
      25,
      25,
      0.1,
      50,
      1.2,
      0.5,
      0,
      undefined,
      undefined,
      "standing",
      "SI",
      80,
      { round: false, limit_inputs: false },
    );

    expect(Object.keys(result)).toEqual([
      "e_skin",
      "e_rsw",
      "e_max",
      "q_sensible",
      "q_skin",
      "q_res",
      "t_core",
      "t_skin",
      "m_bl",
      "m_rsw",
      "w",
      "w_max",
      "heat_strain_blood_flow",
      "heat_strain_w",
      "heat_strain_sweating",
      "heat_strain",
    ]);
    expect(result).not.toHaveProperty("pmvGagge");
    expect(result).not.toHaveProperty("pmv_gagge");
    expect(result).not.toHaveProperty("set");
    expect(typeof result.e_skin).toBe("number");
    expect(typeof result.heat_strain).toBe("boolean");
  });

  test("throws TypeError if kwargs.limit_inputs is not a boolean", () => {
    expect(() =>
      use_fans_heatwaves(
        25,
        25,
        0.1,
        50,
        1.2,
        0.5,
        0,
        undefined,
        undefined,
        "standing",
        "SI",
        80,
        {
          limit_inputs: "true",
        },
      ),
    ).toThrow(TypeError);
  });
});
