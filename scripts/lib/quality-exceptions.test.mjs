import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  exceptedPaths,
  loadQualityExceptions,
  readQualityExceptions,
} from "./quality-exceptions.mjs";

const TODAY = "2026-11-07";
const VALID = {
  gate: "max-lines",
  path: "packages/match-engine/src/score/big.ts",
  reason: "Split tracked in E9.9.",
  expires: "2026-12-31",
};

function read(entries) {
  return readQualityExceptions(JSON.stringify(entries), TODAY);
}

describe("readQualityExceptions", () => {
  it("accepts an empty list", () => {
    assert.deepEqual(read([]), { exceptions: [], failures: [] });
  });

  it("accepts a valid entry until the day it expires", () => {
    assert.deepEqual(read([{ ...VALID, expires: TODAY }]).failures, []);
  });

  it("fails an expired entry and relaxes nothing", () => {
    const result = read([{ ...VALID, expires: "2026-11-06" }]);
    assert.deepEqual(result.exceptions, []);
    assert.match(result.failures[0], /expired on 2026-11-06/);
  });

  for (const [name, entry] of [
    ["no reason", { ...VALID, reason: undefined }],
    ["empty reason", { ...VALID, reason: "" }],
    ["no path", { ...VALID, path: undefined }],
    ["unknown gate", { ...VALID, gate: "coverage" }],
    ["impossible date", { ...VALID, expires: "2026-02-30" }],
    ["non ISO date", { ...VALID, expires: "31/12/2026" }],
  ]) {
    it(`fails an entry with ${name}`, () => {
      const result = read([entry]);
      assert.deepEqual(result.exceptions, []);
      assert.match(result.failures[0], /invalid/);
    });
  }

  it("fails a file that is not a JSON list", () => {
    assert.match(readQualityExceptions("{", TODAY).failures[0], /invalid/);
    assert.match(readQualityExceptions("{}", TODAY).failures[0], /invalid/);
  });
});

describe("exceptedPaths", () => {
  it("frees only the path of the given gate", () => {
    const { exceptions } = read([VALID, { ...VALID, gate: "complexity", path: "other.ts" }]);
    assert.deepEqual(exceptedPaths(exceptions, "max-lines"), [VALID.path]);
    assert.deepEqual(exceptedPaths(exceptions, "duplication"), []);
  });
});

describe("scripts/quality-exceptions.json", () => {
  it("is valid and not expired", () => {
    assert.doesNotThrow(() => loadQualityExceptions());
  });
});

describe("expired exception in a gate", () => {
  it("frees nothing, so the size gate still fails the file", () => {
    const { exceptions, failures } = readQualityExceptions(
      JSON.stringify([{ ...VALID, expires: "2026-01-01" }]),
      TODAY,
    );
    assert.equal(failures.length, 1);
    assert.deepEqual(exceptedPaths(exceptions, "max-lines"), []);
  });
});
