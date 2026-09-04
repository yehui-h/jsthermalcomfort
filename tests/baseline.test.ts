import { describe, expect, it } from "vitest";

import baseline from "./fixtures/baseline-1.4.0.json" with { type: "json" };
import * as lib from "../src/index.js";
import { antoine } from "../src/psychrometrics/antoine.js";

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
  // Recorded under 1.4.0's name; the function is `operative_tmp` now, and the
  // equation is untouched, so the recorded values still have to match.
  "t_o.iso": (i) => call.operative_tmp!(i.tdb, i.tr, i.v, "ISO"),
  "t_o.ashrae": (i) => call.operative_tmp!(i.tdb, i.tr, i.v, "ASHRAE"),
  psy_ta_rh: (i) => call.psy_ta_rh!(i.tdb, i.rh),
  v_relative: (i) => call.v_relative!(i.v, i.met),
  "clo_dynamic.ashrae": (i) => call.clo_dynamic_ashrae!(i.clo, i.met),
  // No `clo_dynamic.iso` invoker: 1.4.0's "ISO" branch applied the ASHRAE
  // formula with the threshold moved to met > 1, which is neither standard's
  // equation. `clo_dynamic_iso` replaces it and does not even take the same
  // arguments, so the recorded shape has nothing to be replayed against — see
  // the divergence entry below.
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
  "t_o.iso": "operative_tmp",
  "t_o.ashrae": "operative_tmp",
  "clo_dynamic.ashrae": "clo_dynamic_ashrae",
};

/**
 * Result fields renamed since 1.4.0, per recorded group.
 *
 * A rename is not a divergence: the numbers are unchanged, only what they are
 * called. Exempting these cases would throw the value check away with the old
 * name, so the recorded object is re-keyed and still compared in full.
 */
const renamedFields: Readonly<
  Record<string, Readonly<Record<string, string>>>
> = {
  // `psy_ta_rh` now returns upstream's `PsychrometricValues` field names
  // (`pythermalcomfort/classes_return.py`).
  psy_ta_rh: { t_wb: "wet_bulb_tmp", t_dp: "dew_point_tmp" },
};

/** Applies {@link renamedFields} to one recorded result. */
function rekey(model: string, expected: unknown): unknown {
  const map = renamedFields[model];
  if (map === undefined || expected === null || typeof expected !== "object")
    return expected;
  return Object.fromEntries(
    Object.entries(expected as Record<string, unknown>).map(([key, value]) => [
      map[key] ?? key,
      value,
    ]),
  );
}

/**
 * Deliberate departures from 1.4.0, each aligning this package to a rule
 * upstream applies. A case an entry covers is expected to differ and is left
 * out of the byte comparison; every other case still has to match exactly.
 *
 * Written as predicates over the recorded inputs, not as edits to the fixture:
 * the fixture is generated from the published 1.4.0 package and must keep
 * saying what 1.4.0 did, so the divergence is recorded here instead.
 */
const divergences: readonly {
  readonly reason: string;
  readonly covers: (model: string, inputs: CaseInputs) => boolean;
}[] = [
  {
    // `met_valid = valid_range(met, (0.8, 4.0))` in the limit_inputs block of
    // pythermalcomfort/models/pmv_ppd_iso.py. 1.4.0 checked `met < 0` while its
    // own warning already said 0.8, so the lower bound never fired.
    reason: "ISO met lower bound corrected from 0 to 0.8",
    covers: (model, i) =>
      (model === "pmv_ppd_iso" ||
        (model === "check_standard_compliance" && i.standard === "ISO")) &&
      i.met < 0.8,
  },
  {
    // `pa_valid = valid_range(pa, (0.0, 2700.0))` in the same block. 1.4.0 did
    // not check the derived vapour pressure at all.
    reason: "ISO vapour-pressure bound (pa <= 2700 Pa) now enforced",
    covers: (model, i) =>
      model === "pmv_ppd_iso" && i.rh * 10 * antoine(i.tdb) > 2700,
  },
  {
    // `clo_dynamic(clo, met, "ISO")` applied the ASHRAE formula with the
    // threshold moved to met > 1 — neither standard's equation. Upstream split
    // the function in two (`clo_dynamic_ashrae`, `clo_dynamic_iso` in
    // pythermalcomfort/utilities.py) and the ISO one is the ISO 9920:2007
    // Annex C correction, which needs the air speed. Every recorded case of
    // this shape is superseded; the ASHRAE half still matches exactly.
    reason: "clo_dynamic's ISO branch replaced by clo_dynamic_iso",
    covers: (model) => model === "clo_dynamic.iso",
  },
];

const isDivergent = (model: string, inputs: CaseInputs): boolean =>
  divergences.some((d) => d.covers(model, inputs));

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

  it.each(divergences.map((d) => [d.reason, d] as const))(
    "deliberate divergence is still live: %s",
    (_reason, divergence) => {
      // An exemption that no longer changes any recorded case is dead weight
      // that silently widens what the parity check will accept. Require both
      // that it still covers cases and that at least one of them really differs.
      const covered = cases.filter((c) =>
        divergence.covers(c.model, c.inputs as unknown as CaseInputs),
      );
      expect(covered.length).toBeGreaterThan(0);

      const differing = covered.filter((c) => {
        const invoke = invokers[c.model];
        // No invoker registered: the recorded shape no longer exists at all,
        // which is itself the difference the entry claims.
        if (invoke === undefined) return true;
        try {
          return (
            sameValue(
              invoke(c.inputs as unknown as CaseInputs),
              rekey(c.model, revive(c.ok)),
              "",
            ) !== null
          );
        } catch {
          return true;
        }
      });
      expect(differing.length).toBeGreaterThan(0);
    },
  );

  it.each(groups)("%s", (model) => {
    const recorded = cases.filter((c) => c.model === model);
    const remaining = recorded.filter(
      (c) => !isDivergent(model, c.inputs as unknown as CaseInputs),
    );
    // A group every divergence entry covers is wholly superseded — the shape
    // it recorded no longer exists. The "still live" test above is what keeps
    // that claim honest, so there is nothing left to replay here.
    if (remaining.length === 0) return;

    const exportName = requiredExport[model] ?? model;
    expect(
      typeof call[exportName],
      `${exportName} is not exported — the 1.4.0 surface is incomplete`,
    ).toBe("function");

    const invoke = invokers[model];
    expect(invoke, `no invoker registered for ${model}`).toBeDefined();

    const failures: string[] = [];
    for (const testCase of remaining) {
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
        rekey(model, revive(testCase.ok)),
        JSON.stringify(inputs),
      );
      if (bad) failures.push(bad);
    }

    expect(
      failures.slice(0, 5),
      `${failures.length} of ${remaining.length} compared cases diverged (${recorded.length - remaining.length} deliberately excluded)`,
    ).toEqual([]);
  });
});
