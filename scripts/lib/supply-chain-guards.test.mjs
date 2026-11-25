import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { parseExceptions } from "./audit-exceptions.mjs";
import {
  findBuildScriptFailures,
  findLockFileFailures,
  findSuppressionFailures,
} from "./supply-chain-guards.mjs";

const ROOT = resolve(import.meta.dirname, "../..");
const TODAY = "2026-11-24";
const ADVISORY = "https://github.com/advisories/GHSA-aaaa-bbbb-cccc";
const WORKSPACE = "packages:\n  - apps/mobile\nallowBuilds:\n  unrs-resolver: false\n";

const trackedFiles = () =>
  execFileSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8" }).split("\n").filter(Boolean);
const readRoot = (path) => readFileSync(resolve(ROOT, path), "utf8");
const today = () => new Date().toISOString().slice(0, TODAY.length);

describe("lock file per project", () => {
  it("passes when each .csproj has its lock", () => {
    assert.deepEqual(findLockFileFailures(["a/A.csproj", "a/packages.lock.json"]), []);
  });

  it("fails on a .csproj whose lock was removed, even with a lock elsewhere", () => {
    const [failure] = findLockFileFailures(["a/A.csproj", "b/B.csproj", "b/packages.lock.json"]);
    assert.match(failure, /a\/A\.csproj has no packages\.lock\.json/);
  });

  it("holds in the repository", () => {
    const files = trackedFiles().filter((path) => existsSync(resolve(ROOT, path)));
    assert.ok(files.some((path) => path.endsWith(".csproj")));
    assert.deepEqual(findLockFileFailures(files), []);
  });
});

describe("NuGetAuditSuppress", () => {
  const props = `<ItemGroup><NuGetAuditSuppress Include="${ADVISORY}" /></ItemGroup>`;
  const entry = (expires) => [{ advisory: ADVISORY, reason: "No fix yet.", expires }];

  it("passes a suppression with a live exception", () => {
    const files = { "Directory.Build.props": props };
    assert.deepEqual(
      findSuppressionFailures({ files, exceptions: entry("2026-12-01"), today: TODAY }),
      [],
    );
  });

  it("fails on a suppression without an exception, or with an expired one", () => {
    const files = { "Directory.Build.props": props };
    assert.match(
      findSuppressionFailures({ files, exceptions: [], today: TODAY })[0],
      /without an entry/,
    );
    assert.match(
      findSuppressionFailures({ files, exceptions: entry("2026-11-23"), today: TODAY })[0],
      /expired on 2026-11-23/,
    );
  });

  it("holds in the repository", () => {
    const files = Object.fromEntries(
      trackedFiles()
        .filter((path) => /\.(props|targets|csproj)$/.test(path))
        .map((path) => [path, readRoot(path)]),
    );
    const exceptions = parseExceptions(readRoot("scripts/nuget-audit-exceptions.json"));
    assert.ok(exceptions, "nuget-audit-exceptions.json is valid");
    assert.deepEqual(findSuppressionFailures({ files, exceptions, today: today() }), []);
  });
});

describe("install scripts", () => {
  it("passes allowBuilds with false only", () => {
    assert.deepEqual(findBuildScriptFailures({ workspaceYaml: WORKSPACE, npmrc: "" }), []);
  });

  it("fails on an install script turned on", () => {
    const workspaceYaml = `${WORKSPACE}  protobufjs: true\n`;
    assert.match(findBuildScriptFailures({ workspaceYaml, npmrc: "" })[0], /lets protobufjs run/);
  });

  it("fails on a switch that turns the review off, in the workspace or in .npmrc", () => {
    const workspaceYaml = `${WORKSPACE}dangerouslyAllowAllBuilds: true\n`;
    assert.match(
      findBuildScriptFailures({ workspaceYaml, npmrc: "" })[0],
      /dangerouslyAllowAllBuilds/,
    );
    const npmrc = "strict-dep-builds=false\n";
    assert.match(
      findBuildScriptFailures({ workspaceYaml: WORKSPACE, npmrc })[0],
      /strict-dep-builds/,
    );
  });

  it("holds in the repository", () => {
    const npmrc = existsSync(resolve(ROOT, ".npmrc")) ? readRoot(".npmrc") : "";
    assert.deepEqual(
      findBuildScriptFailures({ workspaceYaml: readRoot("pnpm-workspace.yaml"), npmrc }),
      [],
    );
  });
});
