// Fails when the PR's apps/api/openapi/v1.json breaks /v1 against the one on origin/main (ADR 0042, D3).
// The exception is BREAKING-V1 in the PR body, read from the GitHub event. Usage:
// check-openapi-compat.mjs [base ref] (default origin/main). No base contract yet: nothing to compare.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { findBreakingChanges, isBreakingAllowed } from "./lib/openapi-compat.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const CONTRACT = "apps/api/openapi/v1.json";
const DEFAULT_BASE = "origin/main";
const BASE_ARGUMENT = 2;

function baseContract(ref) {
  try {
    return execFileSync("git", ["show", `${ref}:${CONTRACT}`], {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return undefined;
  }
}

function pullRequestBody() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath || !existsSync(eventPath)) return undefined;
  return JSON.parse(readFileSync(eventPath, "utf8")).pull_request?.body ?? undefined;
}

const ref = process.argv[BASE_ARGUMENT] ?? DEFAULT_BASE;
const base = baseContract(ref);
if (base === undefined) {
  console.log(`check:api-compat OK: ${ref} has no ${CONTRACT} yet.`);
} else {
  const breaking = findBreakingChanges(
    JSON.parse(base),
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
