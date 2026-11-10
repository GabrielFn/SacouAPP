import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, test } from "node:test";

import { BASE_CONTRACT, readBaseContract } from "./base-contract.mjs";

const PATH = "apps/api/openapi/v1.json";
const CONTENT = '{"openapi":"3.1.1"}\n';

/** A throwaway repository: tag "without" has no contract, tag "with" has it. */
function createRepository() {
  const cwd = mkdtempSync(join(tmpdir(), "sacou-base-contract-"));
  const git = (...args) =>
    execFileSync(
      "git",
      ["-c", "user.name=test", "-c", "user.email=test@example.invalid", ...args],
      { cwd, stdio: "ignore" },
    );
  git("init", "--quiet");
  writeFileSync(join(cwd, "README.md"), "base\n");
  git("add", ".");
  git("commit", "--quiet", "-m", "base");
  git("tag", "without");
  mkdirSync(join(cwd, "apps", "api", "openapi"), { recursive: true });
  writeFileSync(join(cwd, PATH), CONTENT);
  git("add", ".");
  git("commit", "--quiet", "-m", "contract");
  git("tag", "with");
  return cwd;
}

describe("base contract from a git ref (check:api-compat)", () => {
  const cwd = createRepository();
  after(() => rmSync(cwd, { recursive: true, force: true }));

  test("a missing ref is an error, not an empty base", () => {
    assert.deepEqual(readBaseContract({ cwd, ref: "origin/main", path: PATH }), {
      status: BASE_CONTRACT.MISSING_REF,
    });
  });

  test("a ref without the contract is the only case with nothing to compare", () => {
    assert.deepEqual(readBaseContract({ cwd, ref: "without", path: PATH }), {
      status: BASE_CONTRACT.ABSENT,
    });
  });

  test("a ref with the contract returns its text", () => {
    assert.deepEqual(readBaseContract({ cwd, ref: "with", path: PATH }), {
      status: BASE_CONTRACT.FOUND,
      text: CONTENT,
    });
  });
});
