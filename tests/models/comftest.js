// Model expectations come from the upstream validation-data repository rather
// than being duplicated here, so this package and pythermalcomfort stay in step.
//
// Pin to a tag/branch/commit with VALIDATION_DATA_REF. The default matches the
// tag upstream's own tests/conftest.py pins, so both repositories read the same
// rows; tracking `main` would let an upstream edit turn this repository's build
// red on its own.
const validationDataRef = process.env.VALIDATION_DATA_REF || "v1.0.0";
const prefixURL = `https://raw.githubusercontent.com/FedericoTartarini/validation-data-comfort-models/${validationDataRef}/`;

// One entry per model this package ships. Upstream's conftest.py lists more
// (a_pmv, phs, utci, …); those are for models this package does not implement.
export const testDataUrls = {
  adaptiveAshrae: prefixURL + "ts_adaptive_ashrae.json",
  adaptiveEn: prefixURL + "ts_adaptive_en.json",
  coolingEffect: prefixURL + "ts_cooling_effect.json",
  pmvPpd: prefixURL + "ts_pmv_ppd.json",
  set: prefixURL + "ts_set.json",
  twoNodesGagge: prefixURL + "ts_two_nodes_gagge.json",
};
