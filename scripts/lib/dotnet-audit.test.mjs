import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, it } from "node:test";

import { findAuditFailures } from "./dotnet-audit.mjs";

const TODAY = "2026-10-30";
const ADVISORY = "https://github.com/advisories/GHSA-aaaa-bbbb-cccc";
const CLI = resolve(import.meta.dirname, "..", "check-dotnet-audit.mjs");

const CLEAN_REPORT = { version: 1, projects: [{ path: "Api.csproj" }] };

function reportWith(severity, packageList = "topLevelPackages") {
  return {
    version: 1,
    projects: [
      {
        path: "Api.csproj",
        frameworks: [
          {
            framework: "net10.0",
            [packageList]: [
              {
                id: "Some.Package",
                resolvedVersion: "1.0.0",
                vulnerabilities: [{ severity, advisoryurl: ADVISORY }],
              },
            ],
          },
        ],
      },
    ],
  };
}

function failuresOf(report, exceptions = []) {
  return findAuditFailures({
    rawReport: typeof report === "string" ? report : JSON.stringify(report),
    rawExceptions: typeof exceptions === "string" ? exceptions : JSON.stringify(exceptions),
    today: TODAY,
  });
}

const exceptionUntil = (expires) => ({ advisory: ADVISORY, reason: "No fix yet.", expires });

describe("findAuditFailures", () => {
  it("passes a report without vulnerabilities", () => {
    assert.deepEqual(failuresOf(CLEAN_REPORT), []);
  });

  it("passes Low and Moderate", () => {
    assert.deepEqual(failuresOf(reportWith("Low")), []);
    assert.deepEqual(failuresOf(reportWith("Moderate")), []);
  });

  it("blocks High and Critical, naming the package and the advisory", () => {
    const [failure] = failuresOf(reportWith("High"));
    assert.match(failure, /Some\.Package/);
    assert.match(failure, /GHSA-aaaa-bbbb-cccc/);
    assert.notDeepEqual(failuresOf(reportWith("Critical")), []);
  });

  it("blocks transitive packages too", () => {
    assert.notDeepEqual(failuresOf(reportWith("High", "transitivePackages")), []);
  });

  it("blocks an unknown or missing severity", () => {
    assert.notDeepEqual(failuresOf(reportWith("Severe")), []);
    assert.notDeepEqual(failuresOf(reportWith(undefined)), []);
  });

  it("passes High with a valid exception, including on its expiry day", () => {
    assert.deepEqual(failuresOf(reportWith("High"), [exceptionUntil("2026-12-31")]), []);
    assert.deepEqual(failuresOf(reportWith("High"), [exceptionUntil(TODAY)]), []);
  });

  it("blocks High with an expired exception", () => {
    assert.notDeepEqual(failuresOf(reportWith("High"), [exceptionUntil("2026-10-29")]), []);
  });

  it("blocks High when the exception is for another advisory", () => {
    const other = { ...exceptionUntil("2026-12-31"), advisory: "https://example.test/other" };
    assert.notDeepEqual(failuresOf(reportWith("High"), [other]), []);
  });

  it("rejects an exception valid for more than 90 days, even on a clean report", () => {
    assert.deepEqual(failuresOf(CLEAN_REPORT, [exceptionUntil("2027-01-28")]), []);
    const [failure] = failuresOf(CLEAN_REPORT, [exceptionUntil("2027-01-29")]);
    assert.match(failure, /over 90 days from today/);
  });

  it("rejects an impossible expiry date", () => {
    assert.notDeepEqual(failuresOf(CLEAN_REPORT, [exceptionUntil("2026-02-30")]), []);
    assert.notDeepEqual(failuresOf(CLEAN_REPORT, [exceptionUntil("2026-13-01")]), []);
  });

  it("rejects a malformed exceptions file", () => {
    assert.notDeepEqual(failuresOf(CLEAN_REPORT, "not json"), []);
    assert.notDeepEqual(failuresOf(CLEAN_REPORT, [{ advisory: ADVISORY }]), []);
    assert.notDeepEqual(failuresOf(CLEAN_REPORT, [exceptionUntil("soon")]), []);
  });

  it("rejects invalid or empty reports", () => {
    assert.notDeepEqual(failuresOf("not json"), []);
    assert.notDeepEqual(failuresOf(""), []);
    assert.notDeepEqual(failuresOf("null"), []);
    assert.notDeepEqual(failuresOf({ version: 1 }), []);
    assert.notDeepEqual(failuresOf({ version: 1, projects: [] }), []);
  });

  it("rejects a report with problems", () => {
    const problems = [{ project: "Api.csproj", level: "error", text: "No assets file." }];
    assert.notDeepEqual(failuresOf({ ...CLEAN_REPORT, problems }), []);
  });
});

describe("check-dotnet-audit CLI", () => {
  function exitCodeFor(content) {
    const directory = mkdtempSync(join(tmpdir(), "dotnet-audit-"));
    try {
      const file = join(directory, "report.json");
      writeFileSync(file, content);
      return spawnSync(process.execPath, [CLI, file]).status;
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }

  it("exits 0 on a clean report", () => {
    assert.equal(exitCodeFor(JSON.stringify(CLEAN_REPORT)), 0);
  });

  it("exits 1 on High and on invalid JSON", () => {
    assert.equal(exitCodeFor(JSON.stringify(reportWith("High"))), 1);
    assert.equal(exitCodeFor("not json"), 1);
  });

  it("fails without the report argument", () => {
    assert.notEqual(spawnSync(process.execPath, [CLI]).status, 0);
  });
});
