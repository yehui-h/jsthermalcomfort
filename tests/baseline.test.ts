import { describe, expect, it } from "vitest";

import baseline from "./fixtures/baseline-1.4.0.json" with { type: "json" };
import * as lib from "../src/index.js";

// Proves the TypeScript rewrite returns byte-identical results to the published
// jsthermalcomfort@1.4.0. This is the executable form of "same as the old
// version" — without it that requirement is only a convention.
//
// Regenerate the fixture with:
//   node scripts/generate-baseline.mjs <ref-pkg-dir> tests/fixtures/baseline-1.4.0.json

type NonFinite = { $nonFinite: string };
type Captured = { ok?: unknown; threw?: string };
type Case = { model: string; inputs: Record<string, unknown> } & Captured;

/** JSON has no NaN/Infinity; the generator writes sentinels that we revive here. */
function revive(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(revive);
  const sentinel = (value as NonFinite).$nonFinite;
  if (typeof sentinel === "string") return Number(sentinel);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) out[k] = revive(v);
  return out;
}

/**
 * Object.is, applied structurally — so NaN equals NaN (the single most common
 * value in this fixture) and +0 does not equal -0.
 */
function sameValue(
  actual: unknown,
  expected: unknown,
  path: string,
): string | null {
  if (typeof expected === "number" || typeof actual === "number") {
    return Object.is(actual, expected)
      ? null
      : `${path}: got ${String(actual)}, expected ${String(expected)}`;
  }
  if (expected === null || typeof expected !== "object") {
    return Object.is(actual, expected)
      ? null
      : `${path}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`;
  }
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual))
      return `${path}: expected an array, got ${typeof actual}`;
    if (actual.length !== expected.length)
      return `${path}: length ${actual.length} !== ${expected.length}`;
    for (let i = 0; i < expected.length; i += 1) {
      const bad = sameValue(actual[i], expected[i], `${path}[${i}]`);
      if (bad) return bad;
    }
    return null;
  }
  if (actual === null || typeof actual !== "object")
    return `${path}: expected an object, got ${String(actual)}`;
  const expectedKeys = Object.keys(expected as object).sort();
  const actualKeys = Object.keys(actual as object).sort();
  if (expectedKeys.join() !== actualKeys.join())
    return `${path}: keys [${actualKeys}] !== [${expectedKeys}]`;
  for (const key of expectedKeys) {
    const bad = sameValue(
      (actual as Record<string, unknown>)[key],
      (expected as Record<string, unknown>)[key],
      `${path}.${key}`,
    );
    if (bad) return bad;
  }
  return null;
}

// The recorded cases are replayed positionally; the fixture, not the type
// system, is what pins each signature.
const call = lib as unknown as Record<
  string,
  (...args: readonly unknown[]) => unknown
>;

/**
 * Every field any recorded case can carry. Declared as required so invokers can
 * read them without `noUncheckedIndexedAccess` widening each one to `undefined`;
 * each invoker only touches the fields its own model recorded.
 */
interface CaseInputs {
  tdb: number;
  tr: number;
  vr: number;
  v: number;
  rh: number;
  met: number;
  clo: number;
  wme: number;
  t_running_mean: number;
  trm: number;
  units: "SI" | "IP";
  limit_inputs: boolean;
  round_output: boolean;
  standard: string;
  kwargs: Record<string, unknown>;
}

/** Replays one recorded case against the current implementation. */
const invokers: Record<string, (i: CaseInputs) => unknown> = {
  pmv_ppd_iso: (i) =>
    call.pmv_ppd_iso!(i.tdb, i.tr, i.vr, i.rh, i.met, i.clo, i.wme),
  pmv_ppd_ashrae: (i) =>
    call.pmv_ppd_ashrae!(i.tdb, i.tr, i.vr, i.rh, i.met, i.clo, i.wme),
  "pmv_ppd_iso.kwargs": (i) =>
    call.pmv_ppd_iso!(i.tdb, i.tdb, 0.1, 50, 1.2, 0.5, 0, i.kwargs),
  "pmv_ppd_ashrae.kwargs": (i) =>
    call.pmv_ppd_ashrae!(i.tdb, i.tdb, 0.1, 50, 1.2, 0.5, 0, i.kwargs),
  adaptive_ashrae: (i) =>
    call.adaptive_ashrae!(i.tdb, i.tr, i.t_running_mean, i.v),
  adaptive_en: (i) => call.adaptive_en!(i.tdb, i.tr, i.t_running_mean, i.v),
  "adaptive_ashrae.flags": (i) =>
    call.adaptive_ashrae!(
      25,
      25,
      i.trm,
      0.7,
      i.units,
      i.limit_inputs,
      i.round_output,
    ),
  "adaptive_en.flags": (i) =>
    call.adaptive_en!(
      25,
      25,
      i.trm,
      0.7,
      i.units,
      i.limit_inputs,
      i.round_output,
    ),
  "t_o.iso": (i) => call.t_o!(i.tdb, i.tr, i.v, "ISO"),
  "t_o.ashrae": (i) => call.t_o!(i.tdb, i.tr, i.v, "ASHRAE"),
  psy_ta_rh: (i) => call.psy_ta_rh!(i.tdb, i.rh),
  v_relative: (i) => call.v_relative!(i.v, i.met),
  "clo_dynamic.ashrae": (i) => call.clo_dynamic!(i.clo, i.met, "ASHRAE"),
  "clo_dynamic.iso": (i) => call.clo_dynamic!(i.clo, i.met, "ISO"),
  cooling_effect: (i) =>
    call.cooling_effect!(i.tdb, i.tdb, i.vr, 50, 1.2, 0.5, 0),
  set_tmp: (i) => call.set_tmp!(i.tdb, i.tdb, i.vr, 50, 1.2, 0.5),
  check_standard_compliance: (i) =>
    call.check_standard_compliance!(i.standard, {
      tdb: i.tdb,
      tr: i.tdb,
      v: 0.1,
      met: i.met,
      clo: 0.5,
    }),
};

/** The exported symbol each case group needs present. */
const requiredExport: Record<string, string> = {
  "pmv_ppd_iso.kwargs": "pmv_ppd_iso",
  "pmv_ppd_ashrae.kwargs": "pmv_ppd_ashrae",
  "adaptive_ashrae.flags": "adaptive_ashrae",
  "adaptive_en.flags": "adaptive_en",
  "t_o.iso": "t_o",
  "t_o.ashrae": "t_o",
  "clo_dynamic.ashrae": "clo_dynamic",
  "clo_dynamic.iso": "clo_dynamic",
};

const cases = (baseline as { cases: Case[] }).cases;
const groups = [...new Set(cases.map((c) => c.model))].sort();

describe(`parity with jsthermalcomfort@${(baseline as { referenceVersion: string }).referenceVersion}`, () => {
  it("fixture covers both valid and out-of-applicability inputs", () => {
    // A grid that drifted to all-valid or all-NaN would make the comparison
    // vacuous on one side without failing.
    const nanCases = cases.filter((c) =>
      JSON.stringify(c.ok ?? {}).includes("nonFinite"),
    ).length;
    expect(nanCases).toBeGreaterThan(0);
    expect(nanCases).toBeLessThan(cases.length);
  });

  it.each(groups)("%s", (model) => {
    const exportName = requiredExport[model] ?? model;
    expect(
      typeof call[exportName],
      `${exportName} is not exported — the 1.4.0 surface is incomplete`,
    ).toBe("function");

    const invoke = invokers[model];
    expect(invoke, `no invoker registered for ${model}`).toBeDefined();

    const failures: string[] = [];
    for (const testCase of cases.filter((c) => c.model === model)) {
      const inputs = testCase.inputs as unknown as CaseInputs;
      let actual: Captured;
      try {
        actual = { ok: invoke!(inputs) };
      } catch (error) {
        actual = {
          threw: `${(error as Error).name}: ${(error as Error).message}`,
        };
      }

      if (testCase.threw !== undefined) {
        if (actual.threw !== testCase.threw)
          failures.push(
            `${JSON.stringify(inputs)}: expected throw ${testCase.threw}, got ${
              actual.threw ?? JSON.stringify(actual.ok)
            }`,
          );
        continue;
      }
      if (actual.threw !== undefined) {
        failures.push(
          `${JSON.stringify(inputs)}: unexpected throw ${actual.threw}`,
        );
        continue;
      }
      const bad = sameValue(
        actual.ok,
        revive(testCase.ok),
        JSON.stringify(inputs),
      );
      if (bad) failures.push(bad);
    }

    expect(
      failures.slice(0, 5),
      `${failures.length} of ${cases.filter((c) => c.model === model).length} cases diverged`,
    ).toEqual([]);
  });
});
