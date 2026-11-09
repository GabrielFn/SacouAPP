import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  addDays,
  exceptedPaths,
  loadQualityExceptions,
  MAX_EXCEPTION_DAYS,
  readQualityExceptions,
  readQualityExceptionsFile,
} from "./quality-exceptions.mjs";

const TODAY = "2026-11-07";
const VALID = {
  gate: "max-lines",
  path: "packages/match-engine/src/score/big.ts",
  reason: "Split tracked in E9.9.",
  expires: "2026-12-31",
};

const TRACKED = new Set([VALID.path, "other.ts"]);
const isTracked = (path) => TRACKED.has(path);

function read(entries) {
  return readQualityExceptions(JSON.stringify(entries), TODAY, isTracked);
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
    assert.match(readQualityExceptions("{", TODAY, isTracked).failures[0], /invalid/);
    assert.match(readQualityExceptions("{}", TODAY, isTracked).failures[0], /invalid/);
  });

  for (const path of ["**", "packages/*/src/a.ts", "a?.ts", "[ab].ts", "{a,b}.ts", "!a.ts"]) {
    it(`fails the glob path ${path} and relaxes nothing`, () => {
      const result = read([{ ...VALID, path }]);
      assert.deepEqual(result.exceptions, []);
      assert.match(result.failures[0], /cannot be a glob/);
    });
  }

  it("fails a path that is not a tracked file", () => {
    const result = read([{ ...VALID, path: "packages/match-engine/src/missing.ts" }]);
    assert.deepEqual(result.exceptions, []);
    assert.match(result.failures[0], /not a tracked file/);
  });

  it("accepts an entry that expires exactly 60 days from today", () => {
    assert.deepEqual(
      read([{ ...VALID, expires: addDays(TODAY, MAX_EXCEPTION_DAYS) }]).failures,
      [],
    );
  });

  it("fails an entry that expires more than 60 days from today", () => {
    const result = read([{ ...VALID, expires: addDays(TODAY, MAX_EXCEPTION_DAYS + 1) }]);
    assert.deepEqual(result.exceptions, []);
    assert.match(result.failures[0], /60 days at most/);
  });
});

describe("addDays", () => {
  it("crosses month and year ends", () => {
    assert.equal(addDays("2026-11-07", MAX_EXCEPTION_DAYS), "2027-01-06");
    assert.equal(addDays("2028-02-28", 1), "2028-02-29");
  });
});

describe("readQualityExceptionsFile", () => {
  it("checks a real path against git ls-files", () => {
    const dir = mkdtempSync(join(tmpdir(), "quality-exceptions-"));
    try {
      const file = join(dir, "exceptions.json");
      const entry = { ...VALID, expires: TODAY };
      writeFileSync(file, JSON.stringify([{ ...entry, path: "package.json" }]));
      assert.deepEqual(readQualityExceptionsFile(file, TODAY).failures, []);
      writeFileSync(file, JSON.stringify([{ ...entry, path: "no/such/file.ts" }]));
      assert.match(readQualityExceptionsFile(file, TODAY).failures[0], /not a tracked file/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
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
      isTracked,
    );
    assert.equal(failures.length, 1);
    assert.deepEqual(exceptedPaths(exceptions, "max-lines"), []);
  });
});
