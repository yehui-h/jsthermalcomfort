// Model expectations come from the upstream validation-data repository rather
// than being duplicated here, so this package and pythermalcomfort stay in step.
//
// Pin to a tag/branch/commit with VALIDATION_DATA_REF; CI should pin to a
// commit rather than tracking `main`, so an upstream edit cannot turn this
// repository's build red on its own.
const validationDataRef = process.env.VALIDATION_DATA_REF || "main";
const prefixURL = `https://raw.githubusercontent.com/FedericoTartarini/validation-data-comfort-models/${validationDataRef}/`;

// Only the datasets for the two models this package ships. Entries for the
// other models were removed along with them.
export const testDataUrls = {
  adaptiveAshrae: prefixURL + "ts_adaptive_ashrae.json",
  pmvPpd: prefixURL + "ts_pmv_ppd.json",
};
