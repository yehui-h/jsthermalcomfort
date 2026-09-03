---
title: Examples
---

# Examples

## Function API

The direct function API takes and returns plain numbers, so it works unchanged
from JavaScript or TypeScript, ESM or CommonJS.

```js
import { pmv_ppd_iso, adaptive_ashrae } from "jsthermalcomfort";

// PMV / PPD per ISO 7730.
// Note vr is the *relative* air speed and clo the *dynamic* insulation —
// use v_relative() and clo_dynamic() if you are starting from sensor readings.
pmv_ppd_iso(25, 25, 0.1, 50, 1.2, 0.5);
// → { pmv: 0.08, ppd: 5.1 }

// Adaptive comfort per ASHRAE 55.
adaptive_ashrae(25, 25, 20, 0.1);
// → { tmp_cmf: 24, tmp_cmf_80_low: 20.5, tmp_cmf_80_up: 27.5, … }
```

Inputs outside a standard's applicability range return `NaN` rather than
throwing, so a sweep over a grid never needs a try/catch:

```js
pmv_ppd_iso(25, 25, 0.1, 50, 0.5, 0.5).pmv;
// → NaN  (ISO 7730 applies from 0.8 met)
```

Starting from measured values rather than corrected ones:

```js
import { v_relative, clo_dynamic } from "jsthermalcomfort/utilities";

const met = 1.4;
const vr = v_relative(0.1, met); // adds the body-movement component
const clo = clo_dynamic(0.5, met, "ISO"); // corrects for activity
pmv_ppd_iso(25, 25, vr, 50, met, clo);
```

Psychrometrics:

```js
import { psy_ta_rh, t_dp, t_wb } from "jsthermalcomfort/psychrometrics";

psy_ta_rh(21, 56); // { p_sat, p_vap, hr, t_wb, t_dp, h }
t_dp(21, 56); // dew point, °C
t_wb(21, 56); // wet-bulb, °C
```

## Reference data

`jsthermalcomfort/reference` publishes the thresholds themselves: the thermal
sensation scales, the adaptive acceptability offsets, the EN category limits.
They are also attached to the model functions, so a result and the table that
labels it come from the same place.

```js
import { pmv_ppd_ashrae, pmv_ppd_iso } from "jsthermalcomfort";

pmv_ppd_iso.tsv.labelFor(-0.8); // "Slightly Cool"
pmv_ppd_iso.tsv.classify(-0.8).upper; // { value: -0.5, inclusive: false }
pmv_ppd_ashrae.COMPLIANCE_LIMIT; // 0.5
```

Both standards share one seven-point table but close it from opposite sides,
which is why every interval carries its own inclusivity rather than one flag
for the whole scale:

```js
pmv_ppd_iso.tsv.labelFor(-0.5); // "Neutral"        — [-0.5, 0.5)
pmv_ppd_ashrae.tsv.labelFor(-0.5); // "Slightly Cool"  — (-1.5, -0.5]
```

A value outside every band — NaN included, which is the normal result for an
out-of-range input — classifies as `undefined` rather than falling into the
band at the end of the scale.

## Unified inputs and outputs

`jsthermalcomfort/io` runs the same models through one input shape and one
output shape. It re-packages what the models return; it never recomputes, so
the numbers are identical to a direct call.

```js
import { io } from "jsthermalcomfort";

const result = io.pmvPpdIso({
  tdb: 25,
  tr: 25,
  vr: 0.1,
  rh: 50,
  met: 1.2,
  clo: 0.5,
});
result.pmv; // 0.08
result.tsv; // "Neutral"

for (const measure of result.toMeasures()) {
  measure.quantity.label; // "Predicted Mean Vote"
  measure.value; // 0.08
  measure.unit; // ""  — "%" for PPD, "°C"/"°F" for temperatures
  measure.category; // "Neutral", or undefined where a model has no scale
}
```

Comfort ranges arrive as evaluated intervals, carrying whether the conditions
met them. The EN adaptive model is the demanding case: three nested,
asymmetric categories on one value.

```js
const en = io.adaptiveEn({ tdb: 25, tr: 25, t_running_mean: 20, v: 0.1 });
const [comfort] = en.toMeasures();

comfort.value; // 25.4
comfort.intervals;
// [ { label: "Category I",   low: 22.4, high: 27.4, satisfied: true },
//   { label: "Category II",  low: 21.4, high: 28.4, satisfied: true },
//   { label: "Category III", low: 20.4, high: 29.4, satisfied: true } ]
```

`satisfied` is reported rather than left to be derived: the adaptive models
compare the _operative_ temperature against these bounds, and that temperature
is not in the result.

When a result is `NaN`, the warnings say why:

```js
const bad = io.adaptiveAshrae({ tdb: 25, tr: 25, t_running_mean: 5, v: 0.1 });

bad.tmp_cmf; // NaN
bad.warnings[0];
// "ASHRAE running mean outdoor temperature applicability limits between 10.0 and 33.5 °C"
```

## Chart geometry

`jsthermalcomfort/charts` computes the zones a tool draws. Output is SI,
unclipped and unstyled — unit conversion, viewport and colour stay with the
caller.

The adaptive bands are affine in the running mean temperature, so two
endpoints determine each boundary exactly:

```js
import { charts } from "jsthermalcomfort";

const [eighty, ninety] = charts.adaptiveAshraeZone();
eighty.label; // "80%"
eighty.upper; // boundary at trm = 10 and trm = 36
eighty.polygon; // closed: upper boundary out, lower boundary back

// Elevated air speed steps the upper boundary up where the operative
// temperature reaches 25 °C, adding the two vertices of the kink.
charts.adaptiveAshraeZone({ v: 0.9 })[0].upper.length; // 4
```

A PMV comfort zone is not a model output at all: for each relative humidity
the temperature at which PMV reaches ±`pmvLimit` has to be solved for. This is
a port of the CBE Thermal Comfort Tool's `findComfortBoundary`, secant method
with a bisection fallback.

```js
const zone = charts.psychrometricZone({
  tr: 25,
  vr: 0.13,
  met: 1.1,
  clo: 0.5,
});

zone.polygon; // [{ db, hr, rh }, …] in the tool's drawing order
zone.coolEdge; // the PMV = -0.5 edge on its own, ascending humidity
zone.unsolved; // rows where no root was found — reported, not clamped

// The three nested EN zones are the same call at three limits.
import { enCategoryPmvLimits } from "jsthermalcomfort/reference";

const nested = enCategoryPmvLimits.map(({ label, pmvLimit }) => ({
  label,
  zone: charts.psychrometricZone({
    tr: 25,
    vr: 0.13,
    met: 1.1,
    clo: 0.5,
    pmvLimit,
    standard: "ISO",
  }),
}));
```

The zones reproduce the published chart, including two defects in it: the
secant method clamps its candidates to `[0, 100]`, and the saturation segment
is always solved at ±0.5 whatever the limit is. Pass
`correctKnownDefects: true` for the geometry the algorithm was meant to
produce.
