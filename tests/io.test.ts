import { describe, expect, it } from "vitest";

import {
  adaptive_ashrae,
  adaptive_en,
  pmv_ppd_ashrae,
  pmv_ppd_iso,
} from "../src/index.js";
import {
  AdaptiveInputs,
  PmvPpdAshraeInputs,
  adaptiveAshrae,
  adaptiveEn,
  pmvPpdAshrae,
  pmvPpdIso,
  quantities,
} from "../src/io/index.js";
import {
  adaptiveAshraeOffsets,
  adaptiveEnOffsets,
  ashrae55AdaptiveLimits,
  en16798AdaptiveLimits,
  iso7730PmvLimits,
  iso7730VapourPressureLimit,
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
        expectSame(viaIo.result.pmv, direct.pmv, `${label} pmv`);
        expectSame(viaIo.result.ppd, direct.ppd, `${label} ppd`);
        // `result` is the model's return object: no field added, none lost.
        expect(Object.keys(viaIo.result).sort()).toEqual(
          Object.keys(direct).sort(),
        );
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
        expectSame(viaIo.result.pmv, direct.pmv, `${label} pmv`);
        expectSame(viaIo.result.ppd, direct.ppd, `${label} ppd`);
        // `result` is the model's return object: no field added, none lost.
        expect(Object.keys(viaIo.result).sort()).toEqual(
          Object.keys(direct).sort(),
        );
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
            viaIo.result[key as keyof typeof direct],
            expected,
            `${JSON.stringify(options)} ${key}`,
          );
        }
        expect(Object.keys(viaIo.result).sort()).toEqual(
          Object.keys(direct).sort(),
        );
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
            viaIo.result[key as keyof typeof direct],
            expected,
            `${JSON.stringify(options)} ${key}`,
          );
        }
        expect(Object.keys(viaIo.result).sort()).toEqual(
          Object.keys(direct).sort(),
        );
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
    expect(pmvMeasure!.value).toBe(pmv.result.pmv);
    expect(ppdMeasure!.value).toBe(pmv.result.ppd);

    const en = adaptiveEn({ tdb: 25, tr: 25, t_running_mean: 20, v: 0.1 });
    const [cmf] = en.toMeasures();
    expect(cmf!.value).toBe(en.result.tmp_cmf);
    expect(cmf!.intervals.map((band) => band.low)).toEqual([
      en.result.tmp_cmf_cat_i_low,
      en.result.tmp_cmf_cat_ii_low,
      en.result.tmp_cmf_cat_iii_low,
    ]);
    expect(cmf!.intervals.map((band) => band.high)).toEqual([
      en.result.tmp_cmf_cat_i_up,
      en.result.tmp_cmf_cat_ii_up,
      en.result.tmp_cmf_cat_iii_up,
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
    expect(adaptiveEn({ ...inputs, units: "ip" }).result.tmp_cmf).toBe(
      adaptiveEn(inputs).result.tmp_cmf,
    );
  });

  it("rejects an unknown unit system and a non-finite number at the model call", () => {
    // The input classes resolve defaults only; the model behind each factory
    // validates, so the same call throws the same error as a direct one.
    const bad = {
      tdb: 25,
      tr: 25,
      t_running_mean: 20,
      v: 0.1,
      units: "metric" as never,
    };
    expect(() => new AdaptiveInputs(bad)).not.toThrow();
    expect(() => adaptiveEn(bad)).toThrow(/must be one of/);
    expect(() => adaptiveAshrae(bad)).toThrow(/must be one of/);
    expect(() =>
      adaptiveEn({ tdb: NaN, tr: 25, t_running_mean: 20, v: 0.1 }),
    ).toThrow(TypeError);
    expect(() =>
      pmvPpdIso({ tdb: NaN, tr: 25, vr: 0.1, rh: 50, met: 1.2, clo: 0.5 }),
    ).toThrow(TypeError);
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

  it("labels a shared cut point the same way under both standards", () => {
    // At tdb = tr = 23.029 the PMV rounds to exactly -0.5, a band edge. Both
    // scales are left-closed, so the edge belongs to the band above it and the
    // two standards' pages agree. See the provenance note on
    // `ashraeThermalSensation` for why upstream's ASHRAE scale does not.
    const shared = {
      tdb: 23.029,
      tr: 23.029,
      vr: 0.1,
      rh: 50,
      met: 1.2,
      clo: 0.5,
    };
    expect(pmvPpdIso(shared).result.pmv).toBe(-0.5);
    expect(pmvPpdAshrae(shared).result.pmv).toBe(-0.5);
    expect(pmvPpdIso(shared).tsv).toBe("Neutral");
    expect(pmvPpdAshrae(shared).tsv).toBe("Neutral");
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
    expect(out.result.pmv).toBeNaN();
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
    expect(out.result.pmv).toBe(-0.5);
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
      { label: "Compliant", low: -0.5, high: 0.5, satisfied: true },
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
      out.result.acceptability_80,
      out.result.acceptability_90,
    ]);

    // Each label has to sit on its own numbers, not merely appear in the right
    // order: the two bands differ only in width, so checking labels alone would
    // pass with 80% and 90% swapped. v = 0.1 keeps the cooling effect at zero.
    for (const [index, offset] of adaptiveAshraeOffsets.entries()) {
      const band = cmf!.intervals[index]!;
      expect(band.low).toBeCloseTo(out.result.tmp_cmf + offset.low, 10);
      expect(band.high).toBeCloseTo(out.result.tmp_cmf + offset.up, 10);
    }
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
      expect(band.low).toBeCloseTo(out.result.tmp_cmf + offset.low, 10);
      expect(band.high).toBeCloseTo(out.result.tmp_cmf + offset.up, 10);
      expect(band.high - out.result.tmp_cmf).not.toBeCloseTo(
        out.result.tmp_cmf - band.low,
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
    expect(out.result.pmv).toBeNaN();
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
    // `Measure` is a plain shape, not a class, so assert the shape.
    expect(Object.keys(measures[0]!).sort()).toEqual([
      "category",
      "intervals",
      "quantity",
      "unit",
      "value",
    ]);
  });
});

describe("violations", () => {
  const inRange = { tdb: 25, tr: 25, vr: 0.1, rh: 50, met: 1.2, clo: 0.5 };

  it("is empty for an in-range run, on every outcome class", () => {
    expect(pmvPpdIso(inRange).violations).toEqual([]);
    expect(pmvPpdAshrae(inRange).violations).toEqual([]);
    expect(
      adaptiveAshrae({ tdb: 25, tr: 25, t_running_mean: 20, v: 0.1 })
        .violations,
    ).toEqual([]);
    expect(
      adaptiveEn({ tdb: 25, tr: 25, t_running_mean: 20, v: 0.1 }).violations,
    ).toEqual([]);
  });

  it("hands back the table row itself, so a consumer can read its role", () => {
    const out = pmvPpdIso({ ...inRange, tdb: 45 });
    const tdbRow = iso7730PmvLimits.find((row) => row.quantity.key === "tdb");
    expect(out.violations[0]).toBe(tdbRow);
  });

  it("reports the derived row with limit_inputs false", () => {
    // clo 0.3 keeps PMV inside ±2 so only the derived row fires.
    const derived = pmvPpdIso({
      ...inRange,
      tdb: 30,
      tr: 30,
      rh: 95,
      clo: 0.3,
      limit_inputs: false,
    });
    expect(derived.violations).toHaveLength(1);
    expect(derived.violations[0]).toBe(iso7730VapourPressureLimit);
  });

  it("keeps warnings as the sentences of violations", () => {
    const out = pmvPpdIso({ ...inRange, tdb: 45, rh: 95, limit_inputs: false });
    // Guards the equality below against passing on two empty arrays.
    expect(out.violations.length).toBeGreaterThan(0);
    expect(out.warnings).toEqual(out.violations.map((row) => row.warning));
  });

  it("adaptive models return their running-mean row", () => {
    const outside = { tdb: 25, tr: 25, t_running_mean: 9, v: 0.1 };
    const ashraeRow = ashrae55AdaptiveLimits.find(
      (row) => row.quantity.key === "t_running_mean",
    );
    expect(adaptiveAshrae(outside).violations[0]).toBe(ashraeRow);
    expect(adaptiveEn(outside).violations).toEqual(en16798AdaptiveLimits);
    expect(adaptiveEn(outside).warnings).toEqual(
      en16798AdaptiveLimits.map((row) => row.warning),
    );
    expect(adaptiveEn({ ...outside, t_running_mean: 20 }).violations).toEqual(
      [],
    );
  });
});

describe("edition", () => {
  const inputs = { tdb: 25, tr: 25, vr: 0.1, rh: 50, met: 1.2, clo: 0.5 };

  it("defaults to the newest edition and echoes it", () => {
    expect(pmvPpdIso(inputs).edition).toBe("7730-2025");
    expect(pmvPpdIso(inputs).inputs.edition).toBe("7730-2025");
  });

  it("echoes a pinned edition and changes no number", () => {
    const pinned = pmvPpdIso({ ...inputs, edition: "7730-2005" });
    expect(pinned.edition).toBe("7730-2005");
    expect(pinned.result).toEqual(pmvPpdIso(inputs).result);
  });

  it("rejects an edition the model does not implement", () => {
    expect(() =>
      pmvPpdIso({ ...inputs, edition: "7730-1994" as never }),
    ).toThrow(/7730-2005, 7730-2025/);
  });
});
