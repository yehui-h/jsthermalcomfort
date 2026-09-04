// Validation data loaded from the shared validation-data-comfort-models
// repository, the same rows upstream's tests/test_set.py checks.
//
// Until now no test in this repository compared set_tmp's ~400-line numerical
// kernel against upstream at all.
import { describe, test } from "vitest";
import { set_tmp } from "../../src/models/set_tmp.js";
import { testDataUrls } from "./comftest";
import { loadTestData, validateResult } from "./testUtils.js";

const { testData, tolerances } = await loadTestData(testDataUrls.set, false);

describe("set_tmp", () => {
  test.each(testData.data)("Test case #%#", (testCase) => {
    const { inputs, outputs: expectedOutput } = testCase;
    const { tdb, tr, v, rh, met, clo, calculate_ce } = inputs;

    // Upstream's test forces limit_inputs=False and round_output=True on every
    // row (tests/test_set.py), so the rows exercise the kernel rather than the
    // applicability gate.
    const modelResult = set_tmp(
      tdb,
      tr,
      v,
      rh,
      met,
      clo,
      0,
      undefined,
      undefined,
      "standing",
      false,
      { round: true, calculate_ce: calculate_ce ?? false },
    );

    validateResult(modelResult, expectedOutput, tolerances, inputs);
  });
});
