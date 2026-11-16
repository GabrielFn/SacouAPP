import assert from "node:assert/strict";
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
