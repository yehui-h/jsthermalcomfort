// Validation data loaded from the shared validation-data-comfort-models
// repository, the same rows upstream's tests/test_two_nodes_gagge.py checks.
//
// Until now no test in this repository compared the Gagge two-node kernel
// against upstream at all.
import { describe, test } from "vitest";
import { two_nodes_gagge } from "../../src/models/two_nodes_gagge.js";
import { testDataUrls } from "./comftest";
import { loadTestData, validateResult } from "./testUtils.js";

const { testData, tolerances } = await loadTestData(
  testDataUrls.twoNodesGagge,
  false,
);

describe("two_nodes_gagge", () => {
  test.each(testData.data)("Test case #%#", (testCase) => {
    const { inputs, outputs: expectedOutput } = testCase;
    const { tdb, tr, v, rh, met, clo, max_skin_blood_flow } = inputs;

    // Upstream flattens these as keyword arguments; here they live in the
    // kwargs object. Only copy across the keys the row actually sets —
    // Object.assign inside two_nodes_gagge would let an explicit `undefined`
    // overwrite the model's own default.
    const kwargs = {};
    if ("max_sweating" in inputs) kwargs.max_sweating = inputs.max_sweating;
    if ("w_max" in inputs) kwargs.w_max = inputs.w_max;

    const modelResult = two_nodes_gagge(
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
      max_skin_blood_flow ?? 90,
      kwargs,
    );

    validateResult(modelResult, expectedOutput, tolerances, inputs);
  });
});
