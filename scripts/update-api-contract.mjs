// `pnpm api:contract`: rewrites apps/api/openapi/v1.json from the real API (the contract test in update
// mode), then the app's types from it (ADR 0042, D3). Needs the .NET SDK, no database.
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const run = (command, args, env = process.env) =>
  execFileSync(command, args, { cwd: ROOT, stdio: "inherit", env });

run(
  "dotnet",
  [
    "test",
    "--project",
    "apps/api/tests/Sacou.Api.Tests",
    "--filter-method",
    "*.Document_matches_committed_file",
  ],
  { ...process.env, SACOU_UPDATE_OPENAPI: "1" },
);
run(process.execPath, ["scripts/generate-api-types.mjs"]);
