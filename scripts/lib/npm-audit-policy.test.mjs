import assert from "node:assert/strict";
import { globSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { findNpmAuditPolicyFailures } from "./npm-audit-policy.mjs";

const ROOT = resolve(import.meta.dirname, "..", "..");
const ISO_DATE_LENGTH = 10;
const TODAY = "2026-10-31";
const ADVISORY = "GHSA-aaaa-bbbb-cccc";
const WORKSPACE = `packages:\n  - apps/mobile\n\naudit:\n  ignore:\n    - ${ADVISORY}\n\ncatalog:\n  eslint: 9.39.5\n`;
const VALID_EXCEPTION = { advisory: ADVISORY, reason: "No fix yet.", expires: "2027-01-31" };

function failuresOf({
  workspaceYaml = WORKSPACE,
  exceptions = [VALID_EXCEPTION],
  manifests = [],
  today = TODAY,
} = {}) {
  return findNpmAuditPolicyFailures({
    workspaceYaml,
    rawExceptions: typeof exceptions === "string" ? exceptions : JSON.stringify(exceptions),
    manifests,
    today,
  });
}

function declaring(dependencies, field = "dependencies") {
  return { manifests: [{ path: "apps/mobile/package.json", manifest: { [field]: dependencies } }] };
}

describe("audit.ignore expiry", () => {
  it("passes before and on the expiry day", () => {
    assert.deepEqual(failuresOf(), []);
    assert.deepEqual(failuresOf({ today: "2027-01-31" }), []);
  });

  it("fails the day after the expiry", () => {
    const [failure] = failuresOf({ today: "2027-02-01" });
    assert.match(failure, /expired on 2027-01-31/);
  });

  it("fails when an ignored advisory has no entry", () => {
    assert.notDeepEqual(failuresOf({ exceptions: [] }), []);
  });

  it("fails when an entry is no longer in audit.ignore", () => {
    assert.notDeepEqual(failuresOf({ workspaceYaml: "packages:\n  - apps/mobile\n" }), []);
  });

  it("fails on a malformed list", () => {
    assert.notDeepEqual(failuresOf({ exceptions: "not json" }), []);
    assert.notDeepEqual(failuresOf({ exceptions: [{ advisory: ADVISORY }] }), []);
    assert.notDeepEqual(failuresOf({ exceptions: [{ ...VALID_EXCEPTION, expires: "soon" }] }), []);
  });
});

describe("direct zod declarations", () => {
  it("passes without zod and with accepted ranges", () => {
    assert.deepEqual(failuresOf(declaring({ expo: "58.0.21" })), []);
    ["4.6.6", "^4.6.6", "~4.7.0", ">=4.6.6", "5.0.0", "4.10.0"].forEach((spec) => {
      assert.deepEqual(failuresOf(declaring({ zod: spec })), [], spec);
    });
  });

  it("fails below 4.6.6, naming the file", () => {
    ["3.25.76", "^3.25.76", "4.6.5", "^4.0.0", "~4.6.5"].forEach((spec) => {
      const [failure] = failuresOf(declaring({ zod: spec }));
      assert.match(failure, /apps\/mobile\/package\.json/, spec);
    });
  });

  it("checks every dependency field", () => {
    ["devDependencies", "peerDependencies", "optionalDependencies"].forEach((field) => {
      assert.notDeepEqual(failuresOf(declaring({ zod: "3.25.76" }, field)), [], field);
    });
  });

  it("sees through an npm alias", () => {
    assert.notDeepEqual(failuresOf(declaring({ validator: "npm:zod@3.25.76" })), []);
    assert.deepEqual(failuresOf(declaring({ validator: "npm:zod@^4.6.6" })), []);
  });

  it("resolves the catalog", () => {
    const withCatalog = (version) => `${WORKSPACE}  zod: ${version}\n`;
    const zod = declaring({ zod: "catalog:" });
    assert.deepEqual(failuresOf({ ...zod, workspaceYaml: withCatalog("4.6.7") }), []);
    assert.notDeepEqual(failuresOf({ ...zod, workspaceYaml: withCatalog("3.25.76") }), []);
    assert.notDeepEqual(failuresOf({ ...zod, workspaceYaml: WORKSPACE }), []);
  });

  it("fails on a range it cannot read", () => {
    ["*", "latest", ">=3 <5", "^3.0.0 || ^4.6.6", "github:colinhacks/zod"].forEach((spec) => {
      assert.notDeepEqual(failuresOf(declaring({ zod: spec })), [], spec);
    });
  });
});

describe("repository", () => {
  it("follows the npm audit policy today", () => {
    const paths = globSync("{apps,packages}/**/package.json", {
      cwd: ROOT,
      exclude: (name) => name === "node_modules",
    });
    assert.ok(paths.some((path) => path.includes("mobile")));
    assert.ok(paths.some((path) => path.includes("volley-rules")));
    assert.ok(paths.every((path) => !path.includes("node_modules")));

    const failures = findNpmAuditPolicyFailures({
      workspaceYaml: readFileSync(resolve(ROOT, "pnpm-workspace.yaml"), "utf8"),
      rawExceptions: readFileSync(resolve(ROOT, "scripts/npm-audit-exceptions.json"), "utf8"),
      manifests: paths.map((path) => ({
        path,
        manifest: JSON.parse(readFileSync(resolve(ROOT, path), "utf8")),
      })),
      today: new Date().toISOString().slice(0, ISO_DATE_LENGTH),
    });
    assert.deepEqual(failures, []);
  });
});
