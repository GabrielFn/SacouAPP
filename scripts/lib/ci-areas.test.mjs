import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
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
  "apps/api/Directory.Build.props",
  "apps/api/src/Sacou.Api/Directory.Build.targets",
  "apps/api/tests/Directory.Build.props",
  "apps/api/.editorconfig",
  "apps/api/src/.globalconfig",
  "apps/api/CodeMetricsConfig.txt",
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "turbo.json",
  "eslint.config.mjs",
  "tsconfig.base.json",
  "Directory.Build.props",
  "scripts/ci-areas.mjs",
  ".github/workflows/ci.yml",
  ".github/workflows/deploy-api.yml",
  ".github/actions/deploy-cloud-run/action.yml",
  "deploy/cloud-run/service.yaml",
  "Dockerfile",
  ".dockerignore",
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

// .github/workflows/deploy-api.yml deploys only when the `api` area is on (ADR 0068, D4).
describe("API deploy decision", () => {
  const SCRIPT = resolve(import.meta.dirname, "..", "ci-areas.mjs");
  const WORKFLOW = resolve(
    import.meta.dirname,
    "..",
    "..",
    ".github",
    "workflows",
    "deploy-api.yml",
  );
  const deploys = (files) =>
    execFileSync(process.execPath, [SCRIPT], { input: `${files.join("\n")}\n`, encoding: "utf8" })
      .split("\n")
      .includes("api=true");

  it("skips the deploy for a docs-only commit", () => {
    assert.equal(deploys(["docs/decisoes.md", "docs/estado/progresso.md"]), false);
  });

  it("skips the deploy for an app-only commit", () => {
    assert.equal(
      deploys([MOBILE_FILE, "apps/mobile/src/texts/pt-BR.ts", "docs/estado/progresso.md"]),
      false,
    );
  });

  it("deploys when the API, its image or the deploy itself changes", () => {
    [
      API_FILE,
      "apps/api/src/Sacou.Modules/Groups/Sacou.Modules.Groups.csproj",
      "packages/volley-rules/src/formations/formations.json",
      "Dockerfile",
      ".dockerignore",
      "deploy/cloud-run/service.yaml",
      ".github/workflows/deploy-api.yml",
      ".github/actions/deploy-cloud-run/action.yml",
    ].forEach((file) => {
      assert.equal(deploys([file]), true, file);
      assert.equal(
        deploys([MOBILE_FILE, "docs/decisoes.md", file]),
        true,
        `${file} with the app and docs`,
      );
    });
  });

  it("deploys when the diff is empty or failed", () => {
    assert.equal(deploys([]), true);
    assert.equal(deploys([""]), true);
  });

  it("is the rule the workflow runs, and the build waits for it", () => {
    const workflow = readFileSync(WORKFLOW, "utf8");
    assert.match(workflow, /node scripts\/ci-areas\.mjs \| tee -a "\$GITHUB_OUTPUT"/);
    assert.match(workflow, /\|\| files=""/);
    assert.match(
      workflow,
      /build:\n {4}needs: changes\n {4}if: needs\.changes\.outputs\.api != 'false'\n/,
    );
    assert.match(workflow, /github\.event\.workflow_run\.conclusion == 'success'/);
  });
});
