import { expect, describe, it } from "vitest";
import jsthermalcomfort from "../src";

// The public model surface. Deliberately exhaustive: it is what catches an
// accidental export being dropped. Every name here is imported by the CBE
// comfort-tool, which is symlinked against this package — dropping one breaks
// that build, which is how the previous trim went unnoticed.
const MODELS = [
  "adaptive_ashrae",
  "adaptive_en",
  "cooling_effect",
  "pmv_ppd",
  "pmv_ppd_ashrae",
  "pmv_ppd_iso",
  "set_tmp",
  "two_nodes",
];

const PSYCHROMETRICS = [
  "p_sat",
  "p_sat_torr",
  "psy_ta_rh",
  "t_o",
  "enthalpy",
  "t_wb",
  "t_dp",
  "t_mrt",
];

const UTILITIES = [
  "body_surface_area",
  "v_relative",
  "clo_dynamic",
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
