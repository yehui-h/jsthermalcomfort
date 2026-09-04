import { adaptive_ashrae } from "./adaptive_ashrae.js";
import { adaptive_en } from "./adaptive_en.js";
import { cooling_effect } from "./cooling_effect.js";
import { pmv_ppd_ashrae } from "./pmv_ppd_ashrae.js";
import { pmv_ppd_iso } from "./pmv_ppd_iso.js";
import { set_tmp } from "./set_tmp.js";
import { two_nodes_gagge } from "./two_nodes_gagge.js";

// `pmv_ppd` is deliberately absent. Upstream deleted the combined function
// outright (commit 61de959, "split pmv iso and ashrae; … replaced input
// standard with model; deleted pmv function"); here it survives as the shared
// kernel `pmv_ppd_iso` and `pmv_ppd_ashrae` delegate to, which in TypeScript
// means simply not exporting it — no `_` prefix, that is a Python convention
// with nothing to say here.
export type { PmvPpdKwargs, PmvPpdModel, PmvPpdResult } from "./pmv_ppd.js";
export type { AdaptiveAshraeResult } from "./adaptive_ashrae.js";
export type { AdaptiveEnResult } from "./adaptive_en.js";
export type { CoolingEffectResult } from "./cooling_effect.js";
export type { PmvPpdIsoEdition, PmvPpdIsoKwargs } from "./pmv_ppd_iso.js";
export type {
  PmvPpdAshraeEdition,
  PmvPpdAshraeKwargs,
} from "./pmv_ppd_ashrae.js";
export type { BodyPosition, SetTmpKwargs, SetTmpResult } from "./set_tmp.js";
export type {
  TwoNodesGaggeKwargs,
  TwoNodesGaggeResult,
} from "./two_nodes_gagge.js";

export { PMV_PPD_ISO_EDITIONS } from "./pmv_ppd_iso.js";
export { PMV_PPD_ASHRAE_EDITIONS } from "./pmv_ppd_ashrae.js";

/**
 * @public
 * @category Models
 */
export {
  adaptive_ashrae,
  adaptive_en,
  cooling_effect,
  pmv_ppd_ashrae,
  pmv_ppd_iso,
  set_tmp,
  two_nodes_gagge,
};

export default {
  adaptive_ashrae,
  adaptive_en,
  cooling_effect,
  pmv_ppd_ashrae,
  pmv_ppd_iso,
  set_tmp,
  two_nodes_gagge,
};
