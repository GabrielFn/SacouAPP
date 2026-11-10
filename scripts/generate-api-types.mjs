// Writes the app's API types from the committed contract, or with --check fails when they are stale
// (ADR 0042, D3). Usage: generate-api-types.mjs [--check] [document] [output directory].
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { generateApiTypes, staleFiles } from "./lib/api-types.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const CHECK_FLAG = "--check";
const DEFAULT_DOCUMENT = join(ROOT, "apps", "api", "openapi", "v1.json");
const DEFAULT_OUTPUT = join(ROOT, "apps", "mobile", "src", "api", "generated");
const FIRST_ARGUMENT = 2;

const args = process.argv.slice(FIRST_ARGUMENT);
const check = args.includes(CHECK_FLAG);
const [documentPath = DEFAULT_DOCUMENT, outputDir = DEFAULT_OUTPUT] = args
  .filter((arg) => arg !== CHECK_FLAG)
  .map((arg) => resolve(arg));

const expected = await generateApiTypes(readFileSync(documentPath, "utf8"), outputDir);

if (check) {
  const stale = staleFiles(expected, (name) => {
    const path = join(outputDir, name);
    return existsSync(path) ? readFileSync(path, "utf8") : undefined;
  });
  if (stale.length > 0) {
    console.error(stale.join("\n"));
    process.exitCode = 1;
  } else {
    console.log("check:api-types OK: the app's types match the contract.");
  }
} else {
  mkdirSync(outputDir, { recursive: true });
  for (const [name, content] of Object.entries(expected)) {
    writeFileSync(join(outputDir, name), content);
  }
  console.log(`api:types wrote ${Object.keys(expected).length} files to ${outputDir}.`);
}
