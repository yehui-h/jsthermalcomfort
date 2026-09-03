import { describe, expect, it } from "vitest";

import {
  p_sat,
  psy_ta_rh,
  rh_from_dew_point,
  rh_from_humidity_ratio,
  rh_from_vapour_pressure,
  rh_from_wet_bulb,
} from "../src/psychrometrics/index.js";

// Each inverse is checked by round trip: rh → psy_ta_rh → inverse → rh. How
// tight that can be is set by what the forward function rounds:
//
// - p_sat rounds to 0.1 Pa, but the same rounded p_sat(tdb) sits on both sides
//   of the hr and p_vap round trips, so it cancels: those are exact to floating
//   point.
// - t_dp and t_wb round to 0.1 °C, so the best any inverse can do is land in
//   the band of rh that rounds to the same value. Half a band is
//   0.05 °C ÷ (∂t/∂rh), which is what the bounds below come from.
const TDB = [0, 5, 10, 20, 25, 30, 40, 50];
const RH = [5, 10, 20, 30, 50, 70, 90, 99];
const P_ATM = [101325, 80000];

const grid = (tdbs: readonly number[]) =>
  tdbs.flatMap((tdb) => RH.map((rh) => ({ tdb, rh })));

describe("humidity ratio and vapour pressure round-trip exactly", () => {
  it.each(grid(TDB))("tdb $tdb, rh $rh", ({ tdb, rh }) => {
    for (const p_atm of P_ATM) {
      const { hr, p_vap } = psy_ta_rh(tdb, rh, p_atm);
      expect(rh_from_humidity_ratio(hr, tdb, p_atm)).toBeCloseTo(rh, 9);
      expect(rh_from_vapour_pressure(p_vap, tdb)).toBeCloseTo(rh, 9);
    }
  });
});

describe("wet bulb round-trips to within t_wb's 0.1 °C rounding", () => {
  // Stull's fit is only worth inverting from about 10 °C up: below that its
  // slope in rh collapses (0.01 °C per % rh at 5 °C) and at 0 °C it dips a full
  // degree over the first 10 % rh. On this grid the shallowest slope is
  // 0.085 °C per % rh, at 10 °C, so half a rounding band is at most 0.6 % rh.
  it.each(grid(TDB.filter((tdb) => tdb >= 10)))(
    "tdb $tdb, rh $rh",
    ({ tdb, rh }) => {
      const forward = psy_ta_rh(tdb, rh).t_wb;
      const back = rh_from_wet_bulb(forward, tdb);
      expect(Math.abs(back - rh)).toBeLessThanOrEqual(0.6);
      // Inside the band means the forward function cannot tell them apart.
      expect(psy_ta_rh(tdb, back).t_wb).toBe(forward);
    },
  );
});

describe("dew point round-trips to within t_dp's own error", () => {
  // rh_from_dew_point inverts the definition, p_vap = p_sat(t_dp). t_dp() is
  // not that inverse: it is a Magnus fit over water, rounded to 0.1 °C, and
  // its own error dominates the round trip:
  // - half a rounding band is 0.05 °C × rh × ∂ln(p_sat)/∂t, at most 0.5 % rh
  //   on this grid (rh 99, t_dp −30);
  // - p_sat follows the ice curve below 0 °C where the fit stays on water,
  //   which costs up to 4.4 % rh (tdb 0, rh 30, t_dp −15.6);
  // - the fit reads low when warm — t_dp(50, 100) is 49.3 °C — which costs
  //   3.4 % rh at (50, 99).
  // p_sat's 0.1 Pa rounding itself is worth under 0.02 % rh anywhere here.
  it.each(grid(TDB))("tdb $tdb, rh $rh", ({ tdb, rh }) => {
    const back = rh_from_dew_point(psy_ta_rh(tdb, rh).t_dp, tdb);
    expect(Math.abs(back - rh)).toBeLessThanOrEqual(4.5);
  });
});

describe("clamps", () => {
  it("dew point at or above tdb is saturation", () => {
    expect(rh_from_dew_point(25, 25)).toBe(100);
    expect(rh_from_dew_point(30, 25)).toBe(100);
  });

  it("no vapour is 0, more than saturation is 100", () => {
    expect(rh_from_humidity_ratio(0, 25)).toBe(0);
    expect(rh_from_humidity_ratio(-0.001, 25)).toBe(0);
    expect(rh_from_vapour_pressure(0, 25)).toBe(0);
    expect(rh_from_vapour_pressure(2 * p_sat(25), 25)).toBe(100);
  });

  it("wet bulb clamps at the fit's own extremes", () => {
    // Stull's saturation wet-bulb at tdb 25 is 25.05 °C, so 25 °C is a real
    // solution (99.7 %) and only above that is it a clamp.
    expect(rh_from_wet_bulb(30, 25)).toBe(100);
    expect(rh_from_wet_bulb(25, 25)).toBeCloseTo(99.66, 1);
    expect(rh_from_wet_bulb(-5, 25)).toBe(0);
    // At 0 °C the fit falls to −4.64 °C around rh 9 before rising. Below the
    // floor is the clamp; above it the rising branch is the one inverted.
    expect(rh_from_wet_bulb(-4.7, 0)).toBe(0);
    expect(rh_from_wet_bulb(-3.9, 0)).toBeCloseTo(41.1, 0);
  });
});
