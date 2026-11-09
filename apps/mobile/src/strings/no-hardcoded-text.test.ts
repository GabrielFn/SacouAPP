import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, test } from "vitest";

const SRC = join(__dirname, "..");
const SCANNED_DIRS = ["app", "ui", "features"];
/** Props that a screen reader or a user reads. */
const TEXT_PROPS = "accessibilityLabel|accessibilityHint|placeholder|title|label|alt";
/** Text between tags that is not an expression or whitespace. */
const JSX_TEXT = /[>}]\s*([^<>{}\s][^<>{}]*)</g;
const STRING_PROP = new RegExp(`\\b(?:${TEXT_PROPS})=("[^"]+"|'[^']+')`, "g");

/** Text that has code in it comes from a generic type such as useState<string | null>(null). */
const CODE_CHARACTERS = /[;()=]/;

function tsxFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return tsxFiles(path);
    return entry.name.endsWith(".tsx") ? [path] : [];
  });
}

function withoutTypeSyntax(source: string): string {
  // Generics and arrow types also contain "<" and ">": keep only what follows a JSX tag start.
  return source.replace(/=>/g, "").replace(/<[A-Z][A-Za-z0-9.]*(?:,\s*[A-Za-z0-9.[\]]+)*>/g, "");
}

describe("no text of the interface is written inside a component", () => {
  const files = SCANNED_DIRS.flatMap((dir) => tsxFiles(join(SRC, dir)));

  test("the scan sees the components", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  test.each(files.map((file) => [relative(SRC, file), file] as const))(
    "%s has no literal text nor literal label",
    (_name, file) => {
      const source = withoutTypeSyntax(readFileSync(file, "utf8"));
      const jsx = [...source.matchAll(JSX_TEXT)]
        .map((m) => m[1]?.trim() ?? "")
        .filter((text) => !CODE_CHARACTERS.test(text));
      const props = [...source.matchAll(STRING_PROP)].map((m) => m[1] ?? "");
      expect({ jsx, props }).toEqual({ jsx: [], props: [] });
    },
  );
});
