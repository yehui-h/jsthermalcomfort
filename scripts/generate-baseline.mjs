// Captures the behaviour of a reference jsthermalcomfort build as a fixture, so
// the TypeScript rewrite can be proven byte-identical to it.
//
// The grids deliberately run past every model's applicability range: NaN is the
// normal result for an out-of-range input, and silently changing *which* inputs
// produce NaN is the failure mode a happy-path test would never catch.
//
//   node scripts/generate-baseline.mjs <path-to-reference-package> <out.json>
//
// The reference is normally `npm i jsthermalcomfort@1.4.0` in a scratch dir.
// Re-run and diff whenever you need to re-establish the baseline.
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const [, , referencePath, outPath] = process.argv;
if (!referencePath || !outPath) {
  console.error(
    "usage: node scripts/generate-baseline.mjs <reference-package-dir> <out.json>",
  );
  process.exit(1);
}

// 1.4.0 ships no `exports` map, and ESM has no directory import, so resolve the
// entry from the package manifest rather than importing the directory.
const referenceManifest = createRequire(import.meta.url)(
  `${resolve(referencePath)}/package.json`,
);
const referenceVersion = referenceManifest.version;
const entry = resolve(
  referencePath,
  referenceManifest.module ?? referenceManifest.main ?? "index.js",
);
const lib = await import(pathToFileURL(entry).href);

const range = (from, to, step) => {
  const out = [];
  for (let v = from; v <= to + 1e-9; v += step) out.push(Number(v.toFixed(6)));
  return out;
};

/** Records the thrown error rather than aborting: throwing *is* part of the contract. */
function capture(fn) {
  try {
    return { ok: fn() };
  } catch (error) {
    return { threw: `${error.name}: ${error.message}` };
  }
}

const cases = [];
const add = (model, inputs, fn) =>
  cases.push({ model, inputs, ...capture(fn) });

// ── PMV family ────────────────────────────────────────────────────────────
// tdb spans 5–40 °C: ISO applies over 10–30, ASHRAE over 10–40, so the grid
// straddles both limits in both directions.
const pmvGrid = {
  tdb: range(5, 40, 5),
  vr: [0, 0.1, 0.5, 1.0, 1.5],
  rh: [10, 50, 90],
  met: [0.7, 1.2, 2.0, 4.5],
  clo: [0, 0.5, 1.0, 2.5],
};

for (const tdb of pmvGrid.tdb)
  for (const vr of pmvGrid.vr)
    for (const rh of pmvGrid.rh)
      for (const met of pmvGrid.met)
        for (const clo of pmvGrid.clo) {
          const args = [tdb, tdb, vr, rh, met, clo, 0];
          add("pmv_ppd_iso", { tdb, tr: tdb, vr, rh, met, clo, wme: 0 }, () =>
            lib.pmv_ppd_iso(...args),
          );
          add(
            "pmv_ppd_ashrae",
            { tdb, tr: tdb, vr, rh, met, clo, wme: 0 },
            () => lib.pmv_ppd_ashrae(...args),
          );
        }

// kwargs paths: unit system, limit suppression, and raw (unrounded) output.
for (const kwargs of [
  { units: "SI" },
  { units: "IP" },
  { limit_inputs: false },
  { round_output: false },
  { limit_inputs: false, round_output: false },
  { airspeed_control: false },
]) {
  for (const tdb of [15, 25, 35]) {
    add("pmv_ppd_iso.kwargs", { tdb, kwargs }, () =>
      lib.pmv_ppd_iso(tdb, tdb, 0.1, 50, 1.2, 0.5, 0, kwargs),
    );
    add("pmv_ppd_ashrae.kwargs", { tdb, kwargs }, () =>
      lib.pmv_ppd_ashrae(tdb, tdb, 0.1, 50, 1.2, 0.5, 0, kwargs),
    );
  }
}

// ── Adaptive family ───────────────────────────────────────────────────────
// t_running_mean spans 5–40: both standards apply over 10–33.5, so the grid
// crosses the limit at both ends. v crosses every cooling-effect step
// (0.6 / 0.9 / 1.2) and the to >= 25 gate.
const adaptiveGrid = {
  tdb: range(5, 45, 5),
  trm: range(5, 40, 5),
  v: [0, 0.3, 0.6, 0.9, 1.2, 2.5],
};

for (const tdb of adaptiveGrid.tdb)
  for (const trm of adaptiveGrid.trm)
    for (const v of adaptiveGrid.v) {
      add("adaptive_ashrae", { tdb, tr: tdb, t_running_mean: trm, v }, () =>
        lib.adaptive_ashrae(tdb, tdb, trm, v),
      );
      add("adaptive_en", { tdb, tr: tdb, t_running_mean: trm, v }, () =>
        lib.adaptive_en(tdb, tdb, trm, v),
      );
    }

// round_output is semantic here, not cosmetic: it rounds t_cmf *before* the
// bounds are derived, so it also moves the acceptability booleans.
for (const units of ["SI", "IP"])
  for (const limit_inputs of [true, false])
    for (const round_output of [true, false])
      for (const trm of [8, 20, 35]) {
        const flags = { units, limit_inputs, round_output };
        add("adaptive_ashrae.flags", { trm, ...flags }, () =>
          lib.adaptive_ashrae(
            25,
            25,
            trm,
            0.7,
            units,
            limit_inputs,
            round_output,
          ),
        );
        add("adaptive_en.flags", { trm, ...flags }, () =>
          lib.adaptive_en(25, 25, trm, 0.7, units, limit_inputs, round_output),
        );
      }

// ── Supporting functions comfort-tool imports directly ────────────────────
for (const tdb of range(10, 40, 5))
  for (const v of [0, 0.1, 0.5, 1.0]) {
    add("t_o.iso", { tdb, tr: tdb + 2, v }, () =>
      lib.t_o(tdb, tdb + 2, v, "ISO"),
    );
    add("t_o.ashrae", { tdb, tr: tdb + 2, v }, () =>
      lib.t_o(tdb, tdb + 2, v, "ASHRAE"),
    );
  }

for (const tdb of range(10, 40, 5))
  for (const rh of [0, 25, 50, 75, 100])
    add("psy_ta_rh", { tdb, rh }, () => lib.psy_ta_rh(tdb, rh));

for (const met of [0.8, 1.0, 1.2, 2.0, 4.0])
  for (const v of [0, 0.1, 0.5]) {
    add("v_relative", { v, met }, () => lib.v_relative(v, met));
    add("clo_dynamic.ashrae", { clo: 0.5, met }, () =>
      lib.clo_dynamic(0.5, met, "ASHRAE"),
    );
    add("clo_dynamic.iso", { clo: 0.5, met }, () =>
      lib.clo_dynamic(0.5, met, "ISO"),
    );
  }

for (const tdb of [15, 25, 35])
  for (const vr of [0.1, 0.5, 1.5]) {
    add("cooling_effect", { tdb, vr }, () =>
      lib.cooling_effect(tdb, tdb, vr, 50, 1.2, 0.5, 0),
    );
    add("set_tmp", { tdb, vr }, () => lib.set_tmp(tdb, tdb, vr, 50, 1.2, 0.5));
  }

for (const standard of ["ISO", "ASHRAE"])
  for (const tdb of [5, 25, 45])
    for (const met of [0.5, 1.2, 5])
      add("check_standard_compliance", { standard, tdb, met }, () =>
        lib.check_standard_compliance(standard, {
          tdb,
          tr: tdb,
          v: 0.1,
          met,
          clo: 0.5,
        }),
      );

writeFileSync(
  outPath,
  `${JSON.stringify(
    {
      $comment:
        "Generated by scripts/generate-baseline.mjs. Do not hand-edit — regenerate instead.",
      referencePackage: "jsthermalcomfort",
      referenceVersion,
      generatedBy: "scripts/generate-baseline.mjs",
      caseCount: cases.length,
      cases,
    },
    // NaN and Infinity are not valid JSON; the loader maps the sentinels back.
    (_key, value) =>
      typeof value === "number" && !Number.isFinite(value)
        ? { $nonFinite: String(value) }
        : value,
    2,
  )}\n`,
);

const threw = cases.filter((c) => c.threw).length;
console.log(
  `wrote ${cases.length} cases (${threw} throwing) from jsthermalcomfort@${referenceVersion} → ${outPath}`,
);
