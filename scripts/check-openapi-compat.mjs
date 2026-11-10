// Fails when the PR's apps/api/openapi/v1.json breaks /v1 against the one on origin/main (ADR 0042, D3).
// The exception is BREAKING-V1 in the PR body, read from the GitHub event. Usage:
// check-openapi-compat.mjs [base ref] (default origin/main). A missing ref fails; only a ref that exists without
// the contract has nothing to compare.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { BASE_CONTRACT, readBaseContract } from "./lib/base-contract.mjs";
import { findBreakingChanges, isBreakingAllowed } from "./lib/openapi-compat.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const CONTRACT = "apps/api/openapi/v1.json";
const DEFAULT_BASE = "origin/main";
const BASE_ARGUMENT = 2;

function pullRequestBody() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath || !existsSync(eventPath)) return undefined;
  return JSON.parse(readFileSync(eventPath, "utf8")).pull_request?.body ?? undefined;
}

const ref = process.argv[BASE_ARGUMENT] ?? DEFAULT_BASE;
const base = readBaseContract({ cwd: ROOT, ref, path: CONTRACT });
if (base.status === BASE_CONTRACT.MISSING_REF) {
  console.error(
    `check:api-compat: ${ref} not found; fetch it first (git fetch --depth=1 origin main).`,
  );
  process.exitCode = 1;
} else if (base.status === BASE_CONTRACT.ABSENT) {
  console.log(`check:api-compat OK: ${ref} has no ${CONTRACT} yet.`);
} else {
  const breaking = findBreakingChanges(
    JSON.parse(base.text),
    JSON.parse(readFileSync(resolve(ROOT, CONTRACT), "utf8")),
  );
  if (breaking.length === 0) {
    console.log(`check:api-compat OK: /v1 stays compatible with ${ref}.`);
  } else if (isBreakingAllowed(pullRequestBody())) {
    console.log(`check:api-compat: ${breaking.length} breaking change(s), allowed by BREAKING-V1:`);
    console.log(breaking.join("\n"));
  } else {
    console.error(`check:api-compat: /v1 breaks the installed app against ${ref}:`);
    console.error(breaking.join("\n"));
    console.error(
      "Keep /v1 compatible (ADR 0039) or write BREAKING-V1 in the PR body, with an ADR.",
    );
    process.exitCode = 1;
  }
}
