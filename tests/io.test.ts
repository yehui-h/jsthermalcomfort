import { describe, expect, it } from "vitest";

import {
  adaptive_ashrae,
  adaptive_en,
  pmv_ppd_ashrae,
  pmv_ppd_iso,
} from "../src/index.js";
import {
  AdaptiveInputs,
  ComfortInterval,
  Measure,
  PmvPpdAshraeInputs,
  PmvPpdInputs,
  adaptiveAshrae,
  adaptiveEn,
  pmvPpdAshrae,
  pmvPpdIso,
  quantities,
} from "../src/io/index.js";
import {
  adaptiveAshraeOffsets,
  adaptiveEnOffsets,
} from "../src/reference/index.js";

// The I/O layer's contract is that it re-packages rather than recomputes: the
// numbers it hands out must be the ones the model functions already return, or
// the layer becomes a second, silently diverging implementation.

/** Object.is, so that NaN — the most common value out here — compares equal. */
function expectSame(actual: unknown, expected: unknown, path: string): void {
  expect(
    Object.is(actual, expected),
    `${path}: got ${String(actual)}, expected ${String(expected)}`,
  ).toBe(true);
}

const PMV_GRID = [
  { tdb: 25, tr: 25, vr: 0.1, rh: 50, met: 1.2, clo: 0.5 },
  { tdb: 27, tr: 25, vr: 0.6, rh: 60, met: 1.4, clo: 0.9 },
  { tdb: 19, tr: 22, vr: 0.15, rh: 35, met: 1, clo: 1.2 },
  // Outside every applicability limit: the layer has to carry NaN through.
  { tdb: 45, tr: 45, vr: 3, rh: 90, met: 5, clo: 3 },
  {
    tdb: 77,
    tr: 77,
    vr: 0.3,
    rh: 50,
    met: 1.2,
    clo: 0.5,
    units: "IP" as const,
  },
];

const ADAPTIVE_GRID = [
  { tdb: 25, tr: 25, t_running_mean: 20, v: 0.1 },
  { tdb: 28, tr: 28, t_running_mean: 30, v: 0.9 },
  { tdb: 25, tr: 25, t_running_mean: 9, v: 0.1 },
  { tdb: 77, tr: 77, t_running_mean: 68, v: 0.3, units: "IP" as const },
];

const SWITCHES = [
  {},
  { round_output: false },
  { limit_inputs: false },
  { limit_inputs: false, round_output: false },
];

describe("I/O layer matches the model functions", () => {
  it("pmvPpdIso returns pmv_ppd_iso's numbers", () => {
    for (const inputs of PMV_GRID) {
      for (const switches of SWITCHES) {
        const options = { ...inputs, ...switches };
        const direct = pmv_ppd_iso(
          options.tdb,
          options.tr,
          options.vr,
          options.rh,
          options.met,
          options.clo,
          0,
          options,
        );
        const viaIo = pmvPpdIso(options);
        const label = JSON.stringify(options);
        expectSame(viaIo.pmv, direct.pmv, `${label} pmv`);
        expectSame(viaIo.ppd, direct.ppd, `${label} ppd`);
      }
    }
  });

  it("pmvPpdAshrae returns pmv_ppd_ashrae's numbers", () => {
    for (const inputs of PMV_GRID) {
      for (const switches of SWITCHES) {
        const options = { ...inputs, ...switches };
        const direct = pmv_ppd_ashrae(
          options.tdb,
          options.tr,
          options.vr,
          options.rh,
          options.met,
          options.clo,
          0,
          options,
        );
        const viaIo = pmvPpdAshrae(options);
        const label = JSON.stringify(options);
        expectSame(viaIo.pmv, direct.pmv, `${label} pmv`);
        expectSame(viaIo.ppd, direct.ppd, `${label} ppd`);
      }
    }
  });

  it("adaptiveAshrae returns adaptive_ashrae's numbers", () => {
    for (const inputs of ADAPTIVE_GRID) {
      for (const switches of SWITCHES) {
        const options = { ...inputs, ...switches };
        const direct = adaptive_ashrae(
          options.tdb,
          options.tr,
          options.t_running_mean,
          options.v,
          options.units ?? "SI",
          options.limit_inputs ?? true,
          options.round_output ?? true,
        );
        const viaIo = adaptiveAshrae(options);
        for (const [key, expected] of Object.entries(direct)) {
          expectSame(
            viaIo[key as keyof typeof direct],
            expected,
            `${JSON.stringify(options)} ${key}`,
          );
        }
      }
    }
  });

  it("adaptiveEn returns adaptive_en's numbers", () => {
    for (const inputs of ADAPTIVE_GRID) {
      for (const switches of SWITCHES) {
        const options = { ...inputs, ...switches };
        const direct = adaptive_en(
          options.tdb,
          options.tr,
          options.t_running_mean,
          options.v,
          options.units ?? "SI",
          options.limit_inputs ?? true,
          options.round_output ?? true,
        );
        const viaIo = adaptiveEn(options);
        for (const [key, expected] of Object.entries(direct)) {
          expectSame(
            viaIo[key as keyof typeof direct],
            expected,
            `${JSON.stringify(options)} ${key}`,
          );
        }
      }
    }
  });

  it("toMeasures() carries the same numbers as the fields", () => {
    const pmv = pmvPpdIso({
      tdb: 25,
      tr: 25,
      vr: 0.1,
      rh: 50,
      met: 1.2,
      clo: 0.5,
    });
    const [pmvMeasure, ppdMeasure] = pmv.toMeasures();
    expect(pmvMeasure!.value).toBe(pmv.pmv);
    expect(ppdMeasure!.value).toBe(pmv.ppd);

    const en = adaptiveEn({ tdb: 25, tr: 25, t_running_mean: 20, v: 0.1 });
    const [cmf] = en.toMeasures();
    expect(cmf!.value).toBe(en.tmp_cmf);
    expect(cmf!.intervals.map((band) => band.low)).toEqual([
      en.tmp_cmf_cat_i_low,
      en.tmp_cmf_cat_ii_low,
      en.tmp_cmf_cat_iii_low,
    ]);
    expect(cmf!.intervals.map((band) => band.high)).toEqual([
      en.tmp_cmf_cat_i_up,
      en.tmp_cmf_cat_ii_up,
      en.tmp_cmf_cat_iii_up,
    ]);
  });
});

describe("inputs", () => {
  it("resolves the documented defaults", () => {
    const inputs = new PmvPpdAshraeInputs({
      tdb: 25,
      tr: 25,
      vr: 0.1,
      rh: 50,
      met: 1.2,
      clo: 0.5,
    });
    expect(inputs.wme).toBe(0);
    expect(inputs.units).toBe("SI");
    expect(inputs.limit_inputs).toBe(true);
    expect(inputs.round_output).toBe(true);
    expect(inputs.airspeed_control).toBe(true);
  });

  it("normalises the unit system to upper case", () => {
    const inputs = new AdaptiveInputs({
      tdb: 77,
      tr: 77,
      t_running_mean: 68,
      v: 0.3,
      units: "ip",
    });
    expect(inputs.units).toBe("IP");
    // And the model behind it agrees, which is the point of normalising.
    expect(adaptiveEn({ ...inputs, units: "ip" }).tmp_cmf).toBe(
      adaptiveEn(inputs).tmp_cmf,
    );
  });

  it("rejects an unknown unit system and a non-finite number", () => {
    expect(
      () =>
        new AdaptiveInputs({
          tdb: 25,
          tr: 25,
          t_running_mean: 20,
          v: 0.1,
          units: "metric" as never,
        }),
    ).toThrow(/must be one of/);
    expect(
      () =>
        new AdaptiveInputs({
          tdb: NaN,
          tr: 25,
          t_running_mean: 20,
          v: 0.1,
        }),
    ).toThrow(TypeError);
  });

  it("accepts an already-validated inputs object", () => {
    const inputs = new PmvPpdInputs({
      tdb: 25,
      tr: 25,
      vr: 0.1,
      rh: 50,
      met: 1.2,
      clo: 0.5,
    });
    expect(pmvPpdIso(inputs).inputs).toBe(inputs);
  });
});

describe("classification", () => {
  it("labels a PMV from the standard's own scale", () => {
    const neutral = pmvPpdIso({
      tdb: 25,
      tr: 25,
      vr: 0.1,
      rh: 50,
      met: 1.2,
      clo: 0.5,
    });
    expect(neutral.tsv).toBe("Neutral");
  });

  it("keeps the two standards' opposite closures visible", () => {
    // At tdb = tr = 23.029 the PMV rounds to exactly -0.5, the cut point the
    // two standards close from opposite sides.
    const shared = {
      tdb: 23.029,
      tr: 23.029,
      vr: 0.1,
      rh: 50,
      met: 1.2,
      clo: 0.5,
    };
    expect(pmvPpdIso(shared).pmv).toBe(-0.5);
    expect(pmvPpdAshrae(shared).pmv).toBe(-0.5);
    expect(pmvPpdIso(shared).tsv).toBe("Neutral");
    expect(pmvPpdAshrae(shared).tsv).toBe("Slightly Cool");
  });

  it("has no category when the model returned NaN", () => {
    const out = pmvPpdIso({
      tdb: 5,
      tr: 5,
      vr: 0.1,
      rh: 50,
      met: 1.2,
      clo: 0.5,
    });
    expect(out.pmv).toBeNaN();
    expect(out.tsv).toBeUndefined();
    expect(out.toMeasures()[0]!.category).toBeUndefined();
  });
});

describe("ASHRAE compliance", () => {
  const base = { tdb: 25, tr: 25, vr: 0.1, rh: 50, met: 1.2, clo: 0.5 };

  it("is true inside the band and false outside it", () => {
    expect(pmvPpdAshrae(base).compliance).toBe(true);
    expect(pmvPpdAshrae({ ...base, tdb: 29, tr: 29 }).compliance).toBe(false);
  });

  it("is judged on the unrounded PMV", () => {
    // Reported PMV is exactly -0.5, which is *not* compliant; the unrounded
    // -0.4999 is. pythermalcomfort evaluates compliance before rounding, so
    // the answer here is true.
    const out = pmvPpdAshrae({ ...base, tdb: 23.029, tr: 23.029 });
    expect(out.pmv).toBe(-0.5);
    expect(out.compliance).toBe(true);
  });

  it("does not depend on round_output", () => {
    for (const inputs of PMV_GRID) {
      const rounded = pmvPpdAshrae(inputs).compliance;
      const raw = pmvPpdAshrae({ ...inputs, round_output: false }).compliance;
      expect(raw, JSON.stringify(inputs)).toBe(rounded);
    }
  });

  it("has no verdict, and no interval, outside the applicability limits", () => {
    const out = pmvPpdAshrae({ ...base, met: 5 });
    expect(out.compliance).toBeUndefined();
    expect(out.toMeasures()[0]!.intervals).toEqual([]);
  });

  it("reports the band it used", () => {
    const [pmv] = pmvPpdAshrae(base).toMeasures();
    expect(pmv!.intervals).toEqual([
      new ComfortInterval("Compliant", -0.5, 0.5, true),
    ]);
  });
});

describe("adaptive comfort ranges", () => {
  it("names the ASHRAE ranges from the reference offsets", () => {
    const out = adaptiveAshrae({ tdb: 25, tr: 25, t_running_mean: 20, v: 0.1 });
    const [cmf] = out.toMeasures();
    expect(cmf!.intervals.map((band) => band.label)).toEqual(
      adaptiveAshraeOffsets.map((offset) => offset.label),
    );
    expect(cmf!.intervals.map((band) => band.satisfied)).toEqual([
      out.acceptability_80,
      out.acceptability_90,
    ]);
  });

  it("carries EN's three nested, asymmetric categories", () => {
    // The hardest shape the unified type has to hold: three ranges that are
    // nested (I inside II inside III) and asymmetric about tmp_cmf.
    const out = adaptiveEn({
      tdb: 25,
      tr: 25,
      t_running_mean: 20,
      v: 0.1,
      round_output: false,
    });
    const [cmf] = out.toMeasures();
    const bands = cmf!.intervals;
    expect(bands.map((band) => band.label)).toEqual(
      adaptiveEnOffsets.map((offset) => offset.label),
    );

    for (const [index, offset] of adaptiveEnOffsets.entries()) {
      const band = bands[index]!;
      // v = 0.1 keeps the cooling effect at zero, so the bounds are exactly
      // tmp_cmf plus the declared offsets.
      expect(band.low).toBeCloseTo(out.tmp_cmf + offset.low, 10);
      expect(band.high).toBeCloseTo(out.tmp_cmf + offset.up, 10);
      expect(band.high - out.tmp_cmf).not.toBeCloseTo(
        out.tmp_cmf - band.low,
        10,
      );
    }

    for (let index = 1; index < bands.length; index += 1) {
      expect(bands[index]!.low).toBeLessThan(bands[index - 1]!.low);
      expect(bands[index]!.high).toBeGreaterThan(bands[index - 1]!.high);
    }
  });
});

describe("warnings", () => {
  it("explains why a PMV result is NaN", () => {
    const out = pmvPpdIso({
      tdb: 45,
      tr: 45,
      vr: 0.1,
      rh: 50,
      met: 1.2,
      clo: 0.5,
    });
    expect(out.pmv).toBeNaN();
    expect(out.warnings.join(" ")).toMatch(/ISO air temperature/);
  });

  it("reports an out-of-range running mean for both adaptive models", () => {
    const outside = { tdb: 25, tr: 25, t_running_mean: 9, v: 0.1 };
    expect(adaptiveAshrae(outside).warnings.join(" ")).toMatch(
      /running mean outdoor temperature/,
    );
    expect(adaptiveEn(outside).warnings.join(" ")).toMatch(
      /running mean outdoor temperature/,
    );
    const inside = { ...outside, t_running_mean: 20 };
    expect(adaptiveEn(inside).warnings).toEqual([]);
  });

  it("checks EN's running mean after converting to SI", () => {
    // 50 °F is exactly 10 °C, the bottom of the range; 40 °F is below it.
    expect(
      adaptiveEn({
        tdb: 77,
        tr: 77,
        t_running_mean: 50,
        v: 0.3,
        units: "IP",
      }).warnings,
    ).toEqual([]);
    expect(
      adaptiveEn({
        tdb: 77,
        tr: 77,
        t_running_mean: 40,
        v: 0.3,
        units: "IP",
      }).warnings,
    ).toHaveLength(1);
  });
});

describe("units", () => {
  it("pins the unit each value is actually in", () => {
    const si = adaptiveAshrae({ tdb: 25, tr: 25, t_running_mean: 20, v: 0.1 });
    const ip = adaptiveAshrae({
      tdb: 77,
      tr: 77,
      t_running_mean: 68,
      v: 0.3,
      units: "IP",
    });
    expect(si.toMeasures()[0]!.unit).toBe("°C");
    expect(ip.toMeasures()[0]!.unit).toBe("°F");

    const pmv = pmvPpdIso({
      tdb: 77,
      tr: 77,
      vr: 0.3,
      rh: 50,
      met: 1.2,
      clo: 0.5,
      units: "IP",
    });
    const measures = pmv.toMeasures();
    // PMV is dimensionless and PPD is a percentage in either system.
    expect(measures[0]!.unit).toBe("");
    expect(measures[1]!.unit).toBe("%");
    expect(measures[0]!.quantity).toBe(quantities.pmv);
    expect(measures[0]).toBeInstanceOf(Measure);
  });
});
