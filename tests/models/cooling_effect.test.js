// Validation data loaded from the shared validation-data-comfort-models
// repository, the same rows upstream's tests/test_cooling_effect.py checks.
import { describe, test } from "vitest";
import { cooling_effect } from "../../src/models/cooling_effect.js";
import { testDataUrls } from "./comftest";
import { loadTestData, validateResult } from "./testUtils.js";

const { testData, tolerances } = await loadTestData(
  testDataUrls.coolingEffect,
  false,
);

describe("cooling_effect", () => {
  test.each(testData.data)("Test case #%#", (testCase) => {
    const { inputs, outputs: expectedOutput } = testCase;
    const { tdb, tr, vr, rh, met, clo, wme, units } = inputs;

    const modelResult = cooling_effect(
      tdb,
      tr,
      vr,
      rh,
      met,
      clo,
      wme ?? 0,
      units ?? "SI",
    );

    validateResult(modelResult, expectedOutput, tolerances, inputs);
  });
});
