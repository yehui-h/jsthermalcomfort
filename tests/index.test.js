import { expect, describe, it } from "vitest";
import jsthermalcomfort from "../src";
// The named surface, as a consumer sees it: the default export above only
// carries the three function namespaces.
import * as lib from "../src/index.js";

// The public model surface. Deliberately exhaustive: it is what catches an
// accidental export being dropped. Every name here is imported by the CBE
// comfort-tool, which is symlinked against this package — dropping one breaks
// that build, which is how the previous trim went unnoticed.
// `pmv_ppd` is not here on purpose: it is the shared kernel behind
// `pmv_ppd_iso` / `pmv_ppd_ashrae` and is no longer exported, matching
// upstream, which deleted the combined function (commit 61de959).
const MODELS = [
  "adaptive_ashrae",
  "adaptive_en",
  "cooling_effect",
  "pmv_ppd_ashrae",
  "pmv_ppd_iso",
  "set_tmp",
  "two_nodes_gagge",
];

const PSYCHROMETRICS = [
  "antoine",
  "p_sat",
  "p_sat_torr",
  "psy_ta_rh",
  "operative_tmp",
  "enthalpy_air",
  "wet_bulb_tmp",
  "dew_point_tmp",
  "mean_radiant_tmp",
];

const UTILITIES = [
  "body_surface_area",
  "v_relative",
  "clo_dynamic_ashrae",
  "clo_dynamic_iso",
  "units_converter",
  "running_mean_outdoor_temperature",
  "f_svv",
  "met_typical_tasks",
  "clo_typical_ensembles",
  "clo_individual_garments",
  "check_standard_compliance",
];

describe("NPM Package", () => {
  it("should be an object", () => {
    expect(jsthermalcomfort).toBeInstanceOf(Object);
  });

  it.each(["utilities", "psychrometrics", "models"])(
    "should have the %s namespace",
    (namespace) => {
      expect(jsthermalcomfort[namespace]).toBeInstanceOf(Object);
    },
  );

  it.each(MODELS)("should have models.%s", (name) => {
    expect(jsthermalcomfort.models).toHaveProperty(name);
    expect(typeof jsthermalcomfort.models[name]).toBe("function");
  });

  it("should expose exactly the retained models", () => {
    expect(Object.keys(jsthermalcomfort.models).sort()).toEqual(
      [...MODELS].sort(),
    );
  });

  it.each(PSYCHROMETRICS)("should have psychrometrics.%s", (name) => {
    expect(jsthermalcomfort.psychrometrics).toHaveProperty(name);
    expect(typeof jsthermalcomfort.psychrometrics[name]).toBe("function");
  });

  it.each(UTILITIES)("should have utilities.%s", (name) => {
    expect(jsthermalcomfort.utilities).toHaveProperty(name);
  });
});

// The lists above catch a name that goes missing. These catch the other half of
// a rename: an old name that comes back, or a new one that never reached the
// places that resolve names at runtime.
describe("names retired when this package caught up with pythermalcomfort", () => {
  it.each([
    "pmv_ppd",
    "clo_dynamic",
    "two_nodes",
    "t_o",
    "t_wb",
    "t_dp",
    "t_mrt",
    "enthalpy",
    "rh_from_humidity_ratio",
    "Standard",
  ])("%s is no longer exported", (name) => {
    expect(name in lib).toBe(false);
  });

  it.each([
    ["operative_tmp", "t_o"],
    ["wet_bulb_tmp", "t_wb"],
    ["dew_point_tmp", "t_dp"],
  ])("quantityFor resolves %s and not %s", (current, retired) => {
    // `quantityFor` is how `units_converter` and the applicability tables turn
    // a field name into its quantity. A rename that stopped here would leave
    // `psy_ta_rh`'s own output unresolvable, silently, with nothing throwing.
    expect(lib.io.quantityFor(current)?.key).toBe(current);
    expect(lib.io.quantityFor(retired)).toBeUndefined();
  });
});
