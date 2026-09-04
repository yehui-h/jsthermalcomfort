// Validation data loaded from the shared validation-data-comfort-models
// repository, the same rows upstream's tests/test_adaptive_en.py checks.
import { describe, test } from "vitest";
import { adaptive_en } from "../../src/models/adaptive_en.js";
import { testDataUrls } from "./comftest";
import { loadTestData, validateResult } from "./testUtils.js";

const { testData, tolerances } = await loadTestData(
  testDataUrls.adaptiveEn,
  false,
);

describe("adaptive_en", () => {
  test.each(testData.data)("Test case #%#", (testCase) => {
    const { inputs, outputs: expectedOutput } = testCase;
    const { tdb, tr, t_running_mean, v } = inputs;

    // Upstream passes only the four positional arguments and leaves units,
    // limit_inputs and round_output at their defaults.
    const modelResult = adaptive_en(tdb, tr, t_running_mean, v);

    validateResult(modelResult, expectedOutput, tolerances, inputs);
  });
});
