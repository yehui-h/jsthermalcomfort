// Validation data loaded from the shared validation-data-comfort-models
// repository. The ISO half of `ts_pmv_ppd.json` was already checked by
// pmv_ppd_iso.test.js; the ASHRAE rows had no test at all.
import { describe, expect, test } from "vitest";
import { pmv_ppd_ashrae } from "../../src/models/pmv_ppd_ashrae.js";
import { testDataUrls } from "./comftest";
import {
  assertNonEmptyRows,
  loadTestData,
  validateResult,
} from "./testUtils.js";

const { testData, tolerances } = await loadTestData(testDataUrls.pmvPpd, false);

const ashraeData = assertNonEmptyRows(
  testData.data.filter((testCase) => testCase.inputs.standard === "ASHRAE"),
  "pmv_ppd_ashrae scalar ASHRAE rows",
);

describe("pmv_ppd_ashrae", () => {
  test.each(ashraeData)("ASHRAE test case #%#", (testCase) => {
    const { inputs, outputs: expectedOutput } = testCase;
    const { tdb, tr, vr, rh, met, clo, wme } = inputs;

    // `units`, `limit_inputs` and `airspeed_control` are flattened keyword
    // arguments upstream; here they live in the kwargs object. Only copy the
    // keys the row sets, so the model's own defaults survive.
    const kwargs = {};
    for (const key of ["units", "limit_inputs", "airspeed_control"]) {
      if (key in inputs) kwargs[key] = inputs[key];
    }

    const modelResult = pmv_ppd_ashrae(tdb, tr, vr, rh, met, clo, wme, kwargs);

    validateResult(modelResult, expectedOutput, tolerances, inputs);
  });
});

// ---------------------------------------------------------------------------
// Edition
// ---------------------------------------------------------------------------
describe("pmv_ppd_ashrae edition", () => {
  const args = [25, 25, 0.1, 50, 1.2, 0.5];

  test("defaults to 55-2023 and changes no numbers", () => {
    expect(pmv_ppd_ashrae(...args, 0, { edition: "55-2023" })).toEqual(
      pmv_ppd_ashrae(...args),
    );
  });

  test("rejects an edition it does not implement", () => {
    expect(() => pmv_ppd_ashrae(...args, 0, { edition: "55-2020" })).toThrow(
      /55-2023/,
    );
  });

  test("publishes the editions it accepts", () => {
    expect([...pmv_ppd_ashrae.editions]).toEqual(["55-2023"]);
  });
});
