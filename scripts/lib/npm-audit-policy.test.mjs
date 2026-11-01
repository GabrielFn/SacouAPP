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
const NO_DEPENDENCIES_LOCKFILE = "---\nlockfileVersion: '9.0'\n\nimporters:\n\n  .: {}\n";
const INTEGRITY_RESOLUTION = "{integrity: sha512-abc==}";
const CODELOAD_URL = "https://codeload.github.com/colinhacks/zod/tar.gz/7baee4e";

function lockfileWith(name, version, packageKey, resolution = INTEGRITY_RESOLUTION) {
  return `---\nlockfileVersion: '9.0'\n\nimporters:\n\n  .:\n    dependencies:\n      ${name}:\n        specifier: any\n        version: ${version}\n\npackages:\n\n  ${packageKey}:\n    resolution: ${resolution}\n`;
}

function lockfileResolvedFrom(tarball) {
  return lockfileWith("expo", "58.0.21", "expo@58.0.21", `{tarball: ${tarball}}`);
}

function failuresOf({
  workspaceYaml = WORKSPACE,
  lockfileYaml = NO_DEPENDENCIES_LOCKFILE,
  exceptions = [VALID_EXCEPTION],
  manifests = [],
  today = TODAY,
} = {}) {
  return findNpmAuditPolicyFailures({
    workspaceYaml,
    lockfileYaml,
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

describe("audit.ignore forms that pnpm audit honors", () => {
  const FORMS = {
    "flow mapping": `audit: { ignore: [${ADVISORY}] }\n`,
    "blank line before the item": `audit:\n  ignore:\n\n    - ${ADVISORY}\n`,
  };

  Object.entries(FORMS).forEach(([label, workspaceYaml]) => {
    it(`requires a pair and checks the expiry: ${label}`, () => {
      assert.deepEqual(failuresOf({ workspaceYaml }), []);
      assert.match(failuresOf({ workspaceYaml, exceptions: [] })[0], /without an entry/);
      assert.match(failuresOf({ workspaceYaml, today: "2027-02-01" })[0], /expired on/);
    });
  });

  it("does not take an uppercase GHSA as the listed one", () => {
    const workspaceYaml = `audit:\n  ignore:\n    - ${ADVISORY.toUpperCase()}\n`;
    assert.match(failuresOf({ workspaceYaml, exceptions: [] })[0], /without an entry/);
    assert.notDeepEqual(failuresOf({ workspaceYaml }), []);
  });

  it("fails on a GHSA outside the list, in any case", () => {
    const workspaceYaml = `${WORKSPACE}auditConfig:\n  ignoreGhsas:\n    - GHSA-DDDD-EEEE-FFFF\n`;
    assert.match(failuresOf({ workspaceYaml })[0], /outside audit\.ignore/);
  });

  it("ignores a GHSA in a comment", () => {
    assert.deepEqual(failuresOf({ workspaceYaml: `# GHSA-dddd-eeee-ffff\n${WORKSPACE}` }), []);
  });

  it("fails on a workspace file it cannot read", () => {
    ["a: b: c: [", "- a\n- b\n", "audit: 1\naudit: 2\n"].forEach((workspaceYaml) => {
      const [failure] = failuresOf({ workspaceYaml });
      assert.match(failure, /pnpm-workspace\.yaml is invalid/, workspaceYaml);
    });
  });
});

describe("audit exception ceiling", () => {
  const expiring = (expires) => ({ exceptions: [{ ...VALID_EXCEPTION, expires }] });

  it("passes on the 180th day from today", () => {
    assert.deepEqual(failuresOf(expiring("2027-04-29")), []);
  });

  it("fails on the 181st day and on a far date", () => {
    assert.match(failuresOf(expiring("2027-04-30"))[0], /over 180 days/);
    assert.match(failuresOf(expiring("9999-12-31"))[0], /over 180 days/);
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

  it("accepts only the default catalog", () => {
    const workspaceYaml = `${WORKSPACE}  zod: 4.6.7\n`;
    assert.deepEqual(failuresOf({ ...declaring({ zod: "catalog:" }), workspaceYaml }), []);
    ["catalog:legacy", "catalog:nao-existe"].forEach((spec) => {
      const [failure] = failuresOf({ ...declaring({ zod: spec }), workspaceYaml });
      assert.match(failure, /only the default/, spec);
    });
    const [other] = failuresOf({ ...declaring({ validator: "catalog:legacy" }), workspaceYaml });
    assert.match(other, /only the default/);
  });

  it("resolves the catalog before identifying the package", () => {
    const withValidator = (spec) => `${WORKSPACE}  validator: ${spec}\n`;
    const validator = declaring({ validator: "catalog:" });
    const vulnerable = withValidator("npm:zod@3.25.76");
    assert.notDeepEqual(failuresOf({ ...validator, workspaceYaml: vulnerable }), []);
    const fixed = withValidator("npm:zod@4.6.7");
    assert.deepEqual(failuresOf({ ...validator, workspaceYaml: fixed }), []);
    assert.deepEqual(failuresOf({ ...validator, workspaceYaml: withValidator("1.0.0") }), []);
  });

  it("fails on an alias without a range, a tarball and a git source under another name", () => {
    [
      "npm:zod",
      "https://registry.npmjs.org/zod/-/zod-3.25.76.tgz",
      "github:colinhacks/zod",
    ].forEach((spec) => {
      assert.notDeepEqual(failuresOf(declaring({ validator: spec })), [], spec);
    });
  });

  it("does not take another package for zod", () => {
    ["npm:zod-validation-error@4.0.2", "npm:@acme/zod@1.0.0"].forEach((spec) => {
      assert.deepEqual(failuresOf(declaring({ validator: spec })), [], spec);
    });
    assert.deepEqual(failuresOf(declaring({ "zod-validation-error": "4.0.2" })), []);
  });

  it("fails on a range it cannot read", () => {
    ["*", "latest", ">=3 <5", "^3.0.0 || ^4.6.6", "github:colinhacks/zod"].forEach((spec) => {
      assert.notDeepEqual(failuresOf(declaring({ zod: spec })), [], spec);
    });
  });
});

describe("zod in the lockfile importers", () => {
  // Alias and registry tarball as written by pnpm 12.16.1. A git source as documented for
  // lockfile 9.0, because pnpm 12.16.1 fails to write that lockfile.
  it("fails on what the manifest does not show, under any name", () => {
    [
      lockfileWith("zod", "3.25.76", "zod@3.25.76"),
      lockfileWith("opaque", "zod@3.25.76", "zod@3.25.76"),
      lockfileWith("zod", CODELOAD_URL, `zod@${CODELOAD_URL}`),
      lockfileWith("opaque", `zod@${CODELOAD_URL}`, `zod@${CODELOAD_URL}`),
      lockfileWith("opaque", CODELOAD_URL, `zod@${CODELOAD_URL}`),
    ].forEach((lockfileYaml) => {
      const failures = failuresOf({ lockfileYaml });
      assert.ok(
        failures.some((failure) => /locks .* to zod/.test(failure)),
        lockfileYaml,
      );
    });
  });

  it("passes at the minimum version, with a peer suffix and for other packages", () => {
    [
      lockfileWith("zod", "4.6.6", "zod@4.6.6"),
      lockfileWith("validator", "zod@4.10.0(typescript@6.0.3)", "zod@4.10.0"),
      lockfileWith("zod-validation-error", "4.0.2(zod@3.25.76)", "zod-validation-error@4.0.2"),
    ].forEach((lockfileYaml) => {
      assert.deepEqual(failuresOf({ lockfileYaml }), [], lockfileYaml);
    });
  });

  it("does not fail on a transitive zod", () => {
    const lockfileYaml = lockfileWith("expo", "58.0.21", "zod@3.25.76");
    assert.deepEqual(failuresOf({ lockfileYaml }), []);
  });

  it("reads every document of the lockfile", () => {
    const lockfileYaml = `${NO_DEPENDENCIES_LOCKFILE}\n${lockfileWith("zod", "3.25.76", "zod@3.25.76")}`;
    assert.notDeepEqual(failuresOf({ lockfileYaml }), []);
  });

  it("fails on a lockfile it cannot read", () => {
    ["", "a: b: c: ["].forEach((lockfileYaml) => {
      assert.match(failuresOf({ lockfileYaml })[0], /pnpm-lock\.yaml is invalid/, lockfileYaml);
    });
  });
});

describe("tarball sources in the lockfile", () => {
  it("passes on the npm registry and without a tarball", () => {
    const fromRegistry = lockfileResolvedFrom("https://registry.npmjs.org/expo/-/expo-58.0.21.tgz");
    assert.deepEqual(failuresOf({ lockfileYaml: fromRegistry }), []);
    const withoutTarball = lockfileWith("expo", "58.0.21", "expo@58.0.21");
    assert.deepEqual(failuresOf({ lockfileYaml: withoutTarball }), []);
  });

  it("fails on any other source", () => {
    [
      "https://evil.example/expo.tgz",
      "https://registry.npmjs.org.evil.example/expo.tgz",
      "http://registry.npmjs.org/expo/-/expo-58.0.21.tgz",
      CODELOAD_URL,
    ].forEach((tarball) => {
      const [failure] = failuresOf({ lockfileYaml: lockfileResolvedFrom(tarball) });
      assert.match(failure, /outside registry\.npmjs\.org/, tarball);
    });
  });
});

describe("repository", () => {
  it("follows the npm audit policy today", () => {
    const paths = [
      "package.json",
      ...globSync("{apps,packages}/**/package.json", {
        cwd: ROOT,
        exclude: (name) => name === "node_modules",
      }),
    ];
    assert.ok(paths.some((path) => path.includes("mobile")));
    assert.ok(paths.some((path) => path.includes("volley-rules")));
    assert.ok(paths.every((path) => !path.includes("node_modules")));

    const failures = findNpmAuditPolicyFailures({
      workspaceYaml: readFileSync(resolve(ROOT, "pnpm-workspace.yaml"), "utf8"),
      lockfileYaml: readFileSync(resolve(ROOT, "pnpm-lock.yaml"), "utf8"),
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
