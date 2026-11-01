// Fails on High/Critical NuGet advisories. Usage: check-dotnet-audit.mjs <report.json>.
// `dotnet list package --vulnerable` exits 0 even with findings, so the JSON decides.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { findAuditFailures } from "./lib/dotnet-audit.mjs";

const EXCEPTIONS_FILE = resolve(import.meta.dirname, "nuget-audit-exceptions.json");
const ISO_DATE_LENGTH = 10;
const REPORT_ARGUMENT_INDEX = 2;

const reportFile = process.argv[REPORT_ARGUMENT_INDEX];
if (reportFile === undefined) {
  throw new Error("Missing argument: path of the JSON report.");
}

const failures = findAuditFailures({
  rawReport: readFileSync(reportFile, "utf8"),
  rawExceptions: readFileSync(EXCEPTIONS_FILE, "utf8"),
  today: new Date().toISOString().slice(0, ISO_DATE_LENGTH),
});

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log("check-dotnet-audit OK: no High or Critical advisory.");
}
