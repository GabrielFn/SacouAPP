import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { ciAreas } from "./ci-areas.mjs";

const EVERYTHING = { code: true, api: true };
const NOTHING = { code: false, api: false };
const APP_ONLY = { code: true, api: false };

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
    assert.deepEqual(
      ciAreas(["apps/mobile/src/app/index.tsx", "docs/estado/progresso.md"]),
      APP_ONLY,
    );
  });

  it("runs the API for anything outside apps/mobile/", () => {
    const cases = [
      "apps/api/src/Sacou.Api/Program.cs",
      "apps/api/openapi/v1.json",
      "packages/volley-rules/src/formations/formations.json",
      "scripts/ci-areas.mjs",
      ".github/workflows/ci.yml",
      "package.json",
      "pnpm-lock.yaml",
      "Directory.Build.props",
      "docs/dominio/rotacoes.md",
      "apps/mobile-copy/file.ts",
    ];
    cases.forEach((file) =>
      assert.deepEqual(ciAreas(["apps/mobile/src/app/index.tsx", file]), EVERYTHING, file),
    );
  });
});

describe("scripts/ci-areas.mjs", () => {
  const SCRIPT = resolve(import.meta.dirname, "..", "ci-areas.mjs");
  const run = (input) => execFileSync(process.execPath, [SCRIPT], { input, encoding: "utf8" });

  it("prints both keys for $GITHUB_OUTPUT", () => {
    assert.equal(run("apps/mobile/src/app/index.tsx\n"), "code=true\napi=false\n");
    assert.equal(run("docs/decisoes.md\n"), "code=false\napi=false\n");
    assert.equal(run("\n"), "code=true\napi=true\n");
  });
});
