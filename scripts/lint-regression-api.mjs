// The dotnet side of lint:regression: plants a method that breaks CA1502 and expects the build to fail.
// Runs in verify-api, so a PR that only touches apps/api/ still proves the analyzer rules hold.
import { resolve } from "node:path";

import { runComplexityProbe } from "./lib/quality-regression.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const PREFIX = "__lint-regression__";

const failures = runComplexityProbe(ROOT, PREFIX);
failures.forEach((failure) => console.error(`FAIL ${failure}`));
console.log(`lint:regression:api: probe ${failures.length === 0 ? "passed" : "failed"}.`);
process.exitCode = failures.length === 0 ? 0 : 1;
