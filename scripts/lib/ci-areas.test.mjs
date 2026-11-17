import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { ciAreas } from "./ci-areas.mjs";

const EVERYTHING = { code: true, api: true, app: true };
const NOTHING = { code: false, api: false, app: false };
const APP_ONLY = { code: true, api: false, app: true };
const API_ONLY = { code: true, api: true, app: false };

const MOBILE_FILE = "apps/mobile/src/app/index.tsx";
const API_FILE = "apps/api/src/Sacou.Api/Program.cs";

// Read by both sides: the TS packages and the shared JSON, the contract, and the root and tooling files.
const SHARED_FILES = [
  "packages/volley-rules/src/formations/formations.json",
  "packages/volley-rules/src/index.ts",
  "packages/match-engine/test/golden/serve.json",
  "apps/api/openapi/v1.json",
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "turbo.json",
  "eslint.config.mjs",
  "tsconfig.base.json",
  "Directory.Build.props",
  "scripts/ci-areas.mjs",
  ".github/workflows/ci.yml",
  "docs/dominio/rotacoes.md",
  "apps/mobile-copy/file.ts",
];

describe("ciAreas", () => {
  it("runs everything when the diff is empty or failed", () => {
    assert.deepEqual(ciAreas([]), EVERYTHING);
    assert.deepEqual(ciAreas([""]), EVERYTHING);
  });

  it("skips the code when every file is in docs/ outside docs/dominio/", () => {
    assert.deepEqual(ciAreas(["docs/decisoes.md", "docs/estado/progresso.md", ""]), NOTHING);
  });

  it("counts docs/dominio/ as code, because tests read it", () => {
    assert.deepEqual(ciAreas(["docs/dominio/rotacoes.md"]), EVERYTHING);
  });

  it("skips the API when every code file is in apps/mobile/", () => {
    assert.deepEqual(ciAreas([MOBILE_FILE, "docs/estado/progresso.md"]), APP_ONLY);
  });

  it("skips the app when every code file is in apps/api/ outside the contract", () => {
    assert.deepEqual(ciAreas([API_FILE, "docs/estado/progresso.md"]), API_ONLY);
    assert.deepEqual(ciAreas([API_FILE, "apps/api/tests/Sacou.Integration.Tests/A.cs"]), API_ONLY);
  });

  it("runs both areas when the change touches the app and the API", () => {
    assert.deepEqual(ciAreas([MOBILE_FILE, API_FILE]), EVERYTHING);
  });

  it("runs both areas for shared files, alone or next to one side", () => {
    SHARED_FILES.forEach((file) => {
      assert.deepEqual(ciAreas([file]), EVERYTHING, file);
      assert.deepEqual(ciAreas([MOBILE_FILE, file]), EVERYTHING, `${file} with the app`);
      assert.deepEqual(ciAreas([API_FILE, file]), EVERYTHING, `${file} with the API`);
    });
  });
});

describe("scripts/ci-areas.mjs", () => {
  const SCRIPT = resolve(import.meta.dirname, "..", "ci-areas.mjs");
  const run = (input) => execFileSync(process.execPath, [SCRIPT], { input, encoding: "utf8" });

  it("prints the three keys for $GITHUB_OUTPUT", () => {
    assert.equal(run(`${MOBILE_FILE}\n`), "code=true\napi=false\napp=true\n");
    assert.equal(run(`${API_FILE}\n`), "code=true\napi=true\napp=false\n");
    assert.equal(run("docs/decisoes.md\n"), "code=false\napi=false\napp=false\n");
    assert.equal(run("\n"), "code=true\napi=true\napp=true\n");
  });
});
