import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { countLines, findSizeViolations } from "./file-size.mjs";

const SOURCE = "apps/api/src/Sacou.Api/Program.cs";
const TEST = "apps/api/tests/Sacou.Api.Tests/ProgramTests.cs";

function violations(files, exceptedPaths = []) {
  return findSizeViolations({ files, exceptedPaths });
}

describe("countLines", () => {
  it("counts physical lines like wc -l", () => {
    const cases = [
      { text: "", lines: 0 },
      { text: "a\n", lines: 1 },
      { text: "a\n\nb\n", lines: 3 },
      { text: "a\nb", lines: 2 },
    ];
    cases.forEach(({ text, lines }) => assert.equal(countLines(text), lines));
  });
});

describe("findSizeViolations", () => {
  it("passes a source file at 300 lines and a test file at 600", () => {
    assert.deepEqual(
      violations([
        { path: SOURCE, lines: 300 },
        { path: TEST, lines: 600 },
      ]),
      [],
    );
  });

  it("fails a source file at 301 lines", () => {
    assert.match(
      violations([{ path: SOURCE, lines: 301 }])[0],
      /301 lines. Maximum allowed is 300/,
    );
  });

  it("fails a test file at 601 lines", () => {
    assert.match(violations([{ path: TEST, lines: 601 }])[0], /Maximum allowed is 600/);
  });

  it("ignores files outside the API", () => {
    assert.deepEqual(violations([{ path: "tools/Big.cs", lines: 5000 }]), []);
  });

  it("skips only the excepted path", () => {
    const files = [
      { path: SOURCE, lines: 301 },
      { path: "apps/api/src/Other.cs", lines: 301 },
    ];
    assert.equal(violations(files, [SOURCE]).length, 1);
  });
});
