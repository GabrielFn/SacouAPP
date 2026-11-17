// Reads the changed files (one per line) from stdin and prints the CI areas as `key=value` lines
// for $GITHUB_OUTPUT. Rule and reasons: scripts/lib/ci-areas.mjs and ADRs 0004 and 0064.
import { readFileSync } from "node:fs";

import { ciAreas } from "./lib/ci-areas.mjs";

const STDIN = 0;

const areas = ciAreas(readFileSync(STDIN, "utf8").split("\n"));
for (const [key, value] of Object.entries(areas)) console.log(`${key}=${value}`);
