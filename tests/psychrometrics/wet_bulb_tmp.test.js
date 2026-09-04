import { expect, describe, it } from "vitest";
import { wet_bulb_tmp } from "../../src/psychrometrics/wet_bulb_tmp";

describe("wet_bulb_tmp", () => {
  it.each([
    { tdb: 27.1, rh: 66.4, expected: 22.4 },
    { tdb: 25, rh: 50, expected: 18.0 },
  ])(
    "returns $expected when bulbTemperature is $bulbTemperature and relativeHumidity is $relativeHumidity",
    ({ tdb, rh, expected }) => {
      const result = wet_bulb_tmp(tdb, rh);
      expect(Math.abs(result - expected)).toBeLessThanOrEqual(0.0001);
    },
  );
});
