import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { findDuplicationFailures } from "./duplication.mjs";

const ROOT = "D:/repo";
const FIRST = "packages/match-engine/src/a.ts";
const SECOND = "packages/match-engine/src/b.ts";

function clone(first, second) {
  return {
    format: "typescript",
    tokens: 60,
    firstFile: { name: `//?/${ROOT}/${first}`, start: 1, end: 9 },
    secondFile: { name: `${ROOT}/${second}`, start: 3, end: 11 },
  };
}

describe("findDuplicationFailures", () => {
  it("passes a report without clones", () => {
    assert.deepEqual(findDuplicationFailures({ report: { duplicates: [] }, root: ROOT }), []);
  });

  it("fails each clone with repository paths", () => {
    const failures = findDuplicationFailures({
      report: { duplicates: [clone(FIRST, SECOND)] },
      root: ROOT,
    });
    assert.deepEqual(failures, [`typescript clone of 60 tokens: ${FIRST}:1-9 and ${SECOND}:3-11`]);
  });

  it("skips a clone that touches an excepted path", () => {
    const report = { duplicates: [clone(FIRST, SECOND), clone(SECOND, "x.ts")] };
    assert.equal(findDuplicationFailures({ report, root: ROOT, exceptedPaths: [FIRST] }).length, 1);
  });

  it("fails an invalid report", () => {
    assert.match(findDuplicationFailures({ report: {}, root: ROOT })[0], /invalid/);
  });
});
