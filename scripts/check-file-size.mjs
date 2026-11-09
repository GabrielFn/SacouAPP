// Fails when a tracked C# file is over its size limit (ADR 0035). ESLint covers TypeScript.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { countLines, findSizeViolations } from "./lib/file-size.mjs";
import { exceptedPaths, readQualityExceptionsFile } from "./lib/quality-exceptions.mjs";

const ROOT = resolve(import.meta.dirname, "..");

const trackedFiles = execFileSync("git", ["ls-files", "-z", "--", "apps/api/**/*.cs"], {
  cwd: ROOT,
  encoding: "utf8",
})
  .split("\0")
  .filter((path) => path.length > 0);

const files = trackedFiles.map((path) => ({
  path,
  lines: countLines(readFileSync(resolve(ROOT, path), "utf8")),
}));

const { exceptions, failures } = readQualityExceptionsFile();
const violations = [
  ...failures,
  ...findSizeViolations({ files, exceptedPaths: exceptedPaths(exceptions, "max-lines") }),
];

if (violations.length > 0) {
  console.error(violations.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`check:size OK: ${files.length} C# files within the limits.`);
}
