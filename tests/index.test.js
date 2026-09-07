import { expect, describe, it } from "vitest";
import * as lib from "../src/index.js";
import * as models from "../src/models/index.js";
import * as psychrometrics from "../src/psychrometrics/index.js";
import * as utilities from "../src/utilities/index.js";

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
  "rh_from_dew_point",
  "hr_to_rh",
  "rh_from_vapour_pressure",
  "rh_from_wet_bulb",
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
  "valid_range",
  "ComplianceCheck",
  "UNIT_SYSTEMS",
];

// Runtime values the barrels export besides the functions above.
const MODEL_DATA = ["PMV_PPD_ISO_EDITIONS", "PMV_PPD_ASHRAE_EDITIONS"];

describe("named surface of each entry point", () => {
  it.each(MODELS)("models exports the function %s", (name) => {
    expect(typeof models[name]).toBe("function");
    expect(typeof lib[name]).toBe("function");
  });

  it("models exports exactly the retained models and their edition tables", () => {
    expect(Object.keys(models).sort()).toEqual(
      [...MODELS, ...MODEL_DATA].sort(),
    );
  });

  it.each(PSYCHROMETRICS)("psychrometrics exports the function %s", (name) => {
    expect(typeof psychrometrics[name]).toBe("function");
    expect(typeof lib[name]).toBe("function");
  });

  it("psychrometrics exports exactly the listed names", () => {
    expect(Object.keys(psychrometrics).sort()).toEqual(
      [...PSYCHROMETRICS].sort(),
    );
  });

  it.each(UTILITIES)("utilities exports %s", (name) => {
    expect(utilities).toHaveProperty(name);
    expect(lib).toHaveProperty(name);
  });

  it("utilities exports exactly the listed names", () => {
    expect(Object.keys(utilities).sort()).toEqual([...UTILITIES].sort());
  });

  // 1.4.0 also shipped `export default { models, utilities, psychrometrics }`
  // and a default object on each barrel. Those objects had drifted from the
  // named surface and are gone on this branch; named imports are the only surface.
  it.each([
    ["root", lib],
    ["models", models],
    ["psychrometrics", psychrometrics],
    ["utilities", utilities],
  ])("%s has no default export", (_label, ns) => {
    expect("default" in ns).toBe(false);
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
