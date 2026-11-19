import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

/** The rating stays out of the app and the shared engine (ADR 0071): hidden, and off the bundle. */
const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const FORBIDDEN = /@sacou\/rating|packages\/rating/u;
const CONSUMERS = ["apps/mobile", "packages/match-engine", "packages/volley-rules"];
const SOURCE_FILE = /\.(ts|tsx|js|mjs|cjs|json)$/u;

function sourceFiles(folder: string): readonly string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) {
      return sourceFiles(join(folder, entry.name));
    }
    return SOURCE_FILE.test(entry.name) ? [join(folder, entry.name)] : [];
  });
}

describe("architecture", () => {
  test.each(CONSUMERS)("%s neither depends on nor imports the rating", (consumer) => {
    const files = [
      join(ROOT, consumer, "package.json"),
      ...sourceFiles(join(ROOT, consumer, "src")),
    ];
    const offenders = files.filter((file) => FORBIDDEN.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });
});
