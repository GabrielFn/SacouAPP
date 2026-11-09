// Fails on any duplicated block of production code (ADR 0035). Settings in .jscpd.json.
// Usage: check-duplication.mjs [path ...] (default: the paths of .jscpd.json).
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { findDuplicationFailures } from "./lib/duplication.mjs";
import { exceptedPaths, readQualityExceptionsFile } from "./lib/quality-exceptions.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const FIRST_PATH_ARGUMENT = 2;

const jscpdManifest = createRequire(import.meta.url).resolve("jscpd/package.json");
const jscpd = join(dirname(jscpdManifest), "run-jscpd.js");

function runJscpd(paths, output) {
  execFileSync(
    process.execPath,
    [
      jscpd,
      "-c",
      ".jscpd.json",
      "--absolute",
      "--reporters",
      "json",
      "-o",
      output,
      "--no-tips",
      ...paths,
    ],
    { cwd: ROOT, stdio: ["ignore", "ignore", "inherit"] },
  );
  return JSON.parse(readFileSync(join(output, "jscpd-report.json"), "utf8"));
}

const output = mkdtempSync(join(tmpdir(), "jscpd-"));
try {
  const report = runJscpd(process.argv.slice(FIRST_PATH_ARGUMENT), output);
  const { exceptions, failures } = readQualityExceptionsFile();
  const clones = findDuplicationFailures({
    report,
    root: ROOT,
    exceptedPaths: exceptedPaths(exceptions, "duplication"),
  });
  const problems = [...failures, ...clones];
  if (problems.length > 0) {
    console.error(problems.join("\n"));
    process.exitCode = 1;
  } else {
    console.log(
      `check:duplication OK: no clone in ${report.statistics?.total?.sources ?? "the"} files.`,
    );
  }
} finally {
  rmSync(output, { recursive: true, force: true });
}
