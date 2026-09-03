// Captures the comfort-zone geometry the deployed CBE Thermal Comfort Tool
// produces, so src/charts can be proven to reproduce it.
//
//   node scripts/generate-chart-baseline.mjs <path-to-comfort_tool> <out.json>
//   npx prettier --write <out.json>          # check:format covers fixtures
//
// The reference is CenterForTheBuiltEnvironment/comfort_tool — the d3 build
// running at comfort.cbe.berkeley.edu, not the Svelte rewrite.
//
// `findComfortBoundary` lives in static/js/psychchart.js, which cannot be
// imported here: it reaches for d3 and jQuery at module scope and reads the
// chart type out of the DOM. It is transcribed below instead, statement for
// statement, with the DOM branch resolved to the fixed-tr chart and the PMV
// model made a parameter (the ASHRAE page uses `comf.pmvElevatedAirspeed`, the
// EN page `comf.pmvEN`). Everything it calls — the root finders, the PMV
// models, the psychrometrics — is the tool's own code, loaded below.
//
// The adaptive vertices are literals in the tool's source, so they are
// transcribed as literals; the comments give the file and the line.
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const [, , comfortToolPath, outPath] = process.argv;
if (!comfortToolPath || !outPath) {
  console.error(
    "usage: node scripts/generate-chart-baseline.mjs <comfort_tool-dir> <out.json>",
  );
  process.exit(1);
}

const require = createRequire(import.meta.url);
const js = resolve(comfortToolPath, "static/js");
const { comf } = require(`${js}/comfort-models.js`);
const { psy } = require(`${js}/psychrometrics.js`);
const { util } = require(`${js}/util.js`);

// psychchart.js: this.getHumRatio
const getHumRatio = (db, rh) =>
  psy.humratio(psy.PROP.Patm, (rh * psy.satpress(db)) / 100);

// psychchart.js: this.findComfortBoundary
function findComfortBoundary(d, pmvlimit, standard) {
  let t;
  const tr = d.tr;
  const boundary = [];

  function rhclos(rhx, target) {
    return function (db) {
      return standard === "ASHRAE"
        ? comf.pmvElevatedAirspeed(db, tr, d.vel, rhx, d.met, d.clo, 0).pmv -
            target
        : comf.pmvEN(db, tr, d.vel, rhx, d.met, d.clo, 0).pmv - target;
    };
  }

  function solve(rhx, target) {
    const epsilon = 0.001; // ta precision
    const a = -50;
    const b = 50;
    const fn = rhclos(rhx, target);
    t = util.secant(a, b, fn, epsilon);
    if (isNaN(t)) {
      t = util.bisect(a, b, fn, epsilon, 0);
    }
    return { db: t, hr: getHumRatio(t, rhx) };
  }

  const incr = 10;
  for (let rhx = 0; rhx <= 100; rhx += incr) {
    boundary.push(solve(rhx, -pmvlimit));
  }

  const t_top_max = solve(100, 0.5).db;
  const t_min = solve(100, -0.5).db;

  for (let tx = t_min; tx <= t_top_max; tx += 0.5) {
    boundary.push({ db: tx, hr: getHumRatio(tx, 100) });
  }
  for (let rhx = 100; rhx >= 0; rhx -= incr) {
    boundary.push(solve(rhx, pmvlimit));
  }
  return boundary;
}

// The tool's PMV wrappers derive relative air speed and, for ASHRAE, dynamic
// clothing from the raw inputs; this package's models take them already
// derived. The fixture stores what the wrappers computed, so the comparison
// isolates the boundary algorithm from the input conventions.
const solverInputs = (d, standard) => ({
  tr: d.tr,
  vr: comf.relativeAirSpeed(d.vel, d.met),
  met: d.met,
  clo: standard === "ASHRAE" ? comf.dynamicClothing(d.clo, d.met) : d.clo,
  standard,
});

const zones = [];
const conditions = [
  { tr: 25, vel: 0.1, met: 1.1, clo: 0.5 },
  { tr: 25, vel: 0.1, met: 1.4, clo: 1 },
  // Elevated air speed: exercises the cooling-effect branch, which drags SET
  // into the root finding.
  { tr: 24, vel: 0.8, met: 1.2, clo: 0.6 },
  { tr: 28, vel: 0.2, met: 1, clo: 0.3 },
];

for (const d of conditions) {
  zones.push({
    conditions: d,
    pmvLimit: 0.5,
    ...solverInputs(d, "ASHRAE"),
    boundary: findComfortBoundary(d, 0.5, "ASHRAE"),
  });
  // The EN page draws three nested zones, one per category.
  for (const pmvLimit of [0.2, 0.5, 0.7]) {
    zones.push({
      conditions: d,
      pmvLimit,
      ...solverInputs(d, "ISO"),
      boundary: findComfortBoundary(d, pmvLimit, "ISO"),
    });
  }
}

const adaptive = {
  // ASHRAE/adaptive-chart-ashrae.js, this.drawChart — upper80d/upper90d and
  // lower80d/lower90d, with the cooling effect at zero.
  ashrae: {
    trmRange: [10, 36],
    bands: [
      {
        label: "80%",
        upper: [
          { trm: 10, t: 24.4 },
          { trm: 12, t: 25 },
          { trm: 36, t: 32.46 },
        ],
        lower: [
          { trm: 36, t: 25.46 },
          { trm: 10, t: 17.4 },
        ],
      },
      {
        label: "90%",
        upper: [
          { trm: 10, t: 23.4 },
          { trm: 15.16, t: 25 },
          { trm: 36, t: 31.46 },
        ],
        lower: [
          { trm: 36, t: 26.46 },
          { trm: 10, t: 18.4 },
        ],
      },
    ],
  },
  // EN/adapt-chart-en.js, this.drawChart — upperI/II/III and lowerI/II/III.
  en: {
    trmRange: [10, 30],
    bands: [
      {
        label: "Category I",
        upper: [
          { trm: 10, t: 24.1 },
          { trm: 30, t: 30.7 },
        ],
        lower: [
          { trm: 30, t: 25.7 },
          { trm: 10, t: 19.1 },
        ],
      },
      {
        label: "Category II",
        upper: [
          { trm: 10, t: 25.1 },
          { trm: 30, t: 31.7 },
        ],
        lower: [
          { trm: 30, t: 24.7 },
          { trm: 10, t: 18.1 },
        ],
      },
      {
        label: "Category III",
        upper: [
          { trm: 10, t: 26.1 },
          { trm: 30, t: 32.7 },
        ],
        lower: [
          { trm: 30, t: 23.7 },
          { trm: 10, t: 17.1 },
        ],
      },
    ],
  },
};

writeFileSync(
  outPath,
  `${JSON.stringify(
    {
      $comment:
        "Generated by scripts/generate-chart-baseline.mjs. Do not hand-edit — regenerate instead.",
      referenceProject: "CenterForTheBuiltEnvironment/comfort_tool",
      generatedBy: "scripts/generate-chart-baseline.mjs",
      zoneCount: zones.length,
      zones,
      adaptive,
    },
    (_key, value) =>
      typeof value === "number" && !Number.isFinite(value)
        ? { $nonFinite: String(value) }
        : value,
    2,
  )}\n`,
);

console.log(
  `wrote ${zones.length} psychrometric zones + adaptive vertices → ${outPath}`,
);
